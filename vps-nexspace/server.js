// server.js — Control server Agen Sewa.
// Website (via Cloudflare tunnel wa-origin.boosteryuk.com + PHP proxy) memanggil
// endpoint ini untuk MEMBUAT sesi agen per user. Tiap sesi = 1 proses bot (index.js)
// dengan nomor, folder sesi, dan folder data sendiri. Kode pairing ditangkap dari stdout
// bot lalu dikirim ke email user via Worker Resend.
//
// Batas waktu tautan: AGENT_PAIR_TIMEOUT_MIN (bawaan 10 menit). Bila nomor belum tertaut
// sampai batas itu, proses bot dihentikan (tidak membuat kode pairing lagi), folder sesinya
// dihapus, dan status menjadi 'expired' → website mengembalikan saldo user di database.
//
// Folder agen (TERPISAH dari bot admin yang memakai 'sessions/' + 'data/'):
//   agen-sewa/<orderId>/sesi/        ← sesi WhatsApp agen
//   agen-sewa/<orderId>/data/        ← orders.json, deposits.json, contacts.json agen
//   agen-sewa/<orderId>/state.json   ← status terakhir (tetap ada walau server.js restart)
//
// Jalankan:  AGENT_TOKEN=xxxx node server.js   (atau pakai pm2/ecosystem)
// Endpoint (semua butuh header x-agent-token = settings.agentToken):
//   POST /session            { orderId, phone, email, nama?, paket? } -> mulai sesi + kirim kode
//   POST /session/:id/resend                                          -> restart & kirim kode baru (jendela 10 menit baru)
//   GET  /session/:id                                                 -> { status, hasCode, expiresAt, remainingSec, log }
//   POST /nexspace/create|renew|cancel, GET /nexspace/status/:username  (lib/nexspace.js)
//   GET  /health                                                      -> { ok:true }  (tanpa token)

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const config = require('./config');
const { sendPairingCode } = require('./lib/resend');
const nexspace = require('./lib/nexspace'); // NexSpace Started: buat akun Linux pembeli

const PORT = config.agentPort || 8787;
const TOKEN = config.agentToken || '';
const PAIR_TIMEOUT_MS = Math.max(0.05, Number(process.env.AGENT_PAIR_TIMEOUT_MIN || 10)) * 60 * 1000;
const BOT_SCRIPT = path.join(__dirname, process.env.AGENT_BOT_SCRIPT || 'index.js'); // ganti hanya untuk uji
const AGENTS_ROOT = path.resolve(__dirname, process.env.AGENTS_ROOT || 'agen-sewa');
const ADMIN_SESSION = path.resolve(__dirname, config.sessionDir || 'sessions');
fs.mkdirSync(AGENTS_ROOT, { recursive: true });

if (AGENTS_ROOT === ADMIN_SESSION || ADMIN_SESSION.startsWith(AGENTS_ROOT + path.sep)) {
  console.error('❌ AGENTS_ROOT bentrok dengan folder sesi bot admin. Ubah AGENTS_ROOT.');
  process.exit(1);
}

/** Registry sesi aktif: orderId -> rec */
const sessions = new Map();

function onlyDigits(s) { return String(s || '').replace(/\D/g, ''); }
function normalizePhone(s) {
  let n = onlyDigits(s);
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  return n;
}
function safeId(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, ''); }
function agentDir(orderId) { return path.join(AGENTS_ROOT, safeId(orderId)); }
function pushLog(rec, line) {
  rec.log.push(line);
  if (rec.log.length > 60) rec.log.shift();
}

/** Simpan status ke disk agar website tetap tahu hasilnya walau server.js restart. */
function saveState(orderId, rec) {
  try {
    fs.mkdirSync(agentDir(orderId), { recursive: true });
    fs.writeFileSync(path.join(agentDir(orderId), 'state.json'), JSON.stringify({
      status: rec.status, phone: rec.phone, expiresAt: rec.expiresAt, updatedAt: Date.now(),
      info: rec.info, // dipakai untuk menjalankan ulang agen yang sudah tertaut setelah restart
    }));
  } catch (e) { console.error(`[${orderId}] gagal simpan state:`, e.message); }
}
function readState(orderId) {
  try { return JSON.parse(fs.readFileSync(path.join(agentDir(orderId), 'state.json'), 'utf8')); } catch { return null; }
}
/** Sesi sudah tertaut bila creds.json menyatakan registered. */
function isRegistered(orderId) {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(agentDir(orderId), 'sesi', 'creds.json'), 'utf8'));
    return !!creds.registered;
  } catch { return false; }
}

function setStatus(orderId, rec, status) {
  rec.status = status;
  saveState(orderId, rec);
}

function startBot(orderId, info) {
  const base = agentDir(orderId);
  const sessionDir = path.join(base, 'sesi');
  const dataDir = path.join(base, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const expiresAt = Date.now() + PAIR_TIMEOUT_MS;

  const proc = spawn(process.execPath, [BOT_SCRIPT], {
    cwd: __dirname,
    env: {
      ...process.env,
      PAIRING_NUMBER: info.phone,
      SESSION_DIR: sessionDir, // absolut, di luar folder sesi admin
      ORDER_DATA_FILE: path.join(dataDir, 'orders.json'),
      DEPOSIT_DATA_FILE: path.join(dataDir, 'deposits.json'),
      CONTACTS_DATA_FILE: path.join(dataDir, 'contacts.json'),
      AGENT_MODE: '1',
      ORDER_ID: orderId,
      AGENT_DEADLINE: String(expiresAt), // index.js juga berhenti sendiri bila lewat batas
    },
  });

  const rec = { proc, status: 'starting', code: null, phone: info.phone, info, log: [], startedAt: Date.now(), expiresAt, timer: null };
  sessions.set(orderId, rec);
  saveState(orderId, rec);
  pushLog(rec, `Menyiapkan agen untuk nomor ${info.phone}… (batas tautan ${Math.round(PAIR_TIMEOUT_MS / 60000)} menit)`);

  // Batas waktu: belum tertaut → hentikan bot & tandai expired.
  // Sesi yang sudah tertaut (dipulihkan setelah restart) tidak memakai batas waktu.
  if (isRegistered(orderId)) {
    rec.expiresAt = 0;
    setStatus(orderId, rec, 'linked');
    pushLog(rec, 'Memulihkan agen yang sudah tertaut…');
  } else {
    rec.timer = setTimeout(() => expire(orderId, rec), PAIR_TIMEOUT_MS);
  }

  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith('@@PHONE@@')) {
        rec.phone = line.slice('@@PHONE@@'.length).trim();
        pushLog(rec, `Nomor WhatsApp yang dipakai: ${rec.phone}`);
      } else if (line.startsWith('@@PAIR@@')) {
        // jangan kirim kode setelah batas waktu / untuk sesi yang sudah tertaut
        if (rec.status === 'expired' || rec.status === 'linked' || isRegistered(orderId)) continue;
        const code = line.slice('@@PAIR@@'.length).trim();
        rec.code = code;
        setStatus(orderId, rec, 'pairing');
        pushLog(rec, `Kode pairing dibuat untuk ${rec.phone}. Mengirim ke email…`);
        sendPairingCode(info.email, code, { ...info, phone: rec.phone }).then((r) => {
          if (!r.ok) { pushLog(rec, `Gagal kirim email: ${r.error || r.status}`); console.error(`[${orderId}] gagal kirim email pairing:`, r.error || r.status); }
          else { pushLog(rec, `Kode pairing terkirim ke ${info.email}.`); console.log(`[${orderId}] kode pairing terkirim ke ${info.email}`); }
        });
      } else if (line.includes('@@LINKED@@')) {
        clearTimeout(rec.timer);
        setStatus(orderId, rec, 'linked');
        pushLog(rec, 'WhatsApp berhasil tertaut! Agen aktif.');
      } else if (line.includes('@@EXPIRED@@')) {
        expire(orderId, rec);
      } else if (line.includes('@@CLOSED@@')) {
        if (rec.status !== 'expired') setStatus(orderId, rec, 'closed');
        pushLog(rec, 'Sesi ditutup/logout.');
      } else if (line.includes('Koneksi terputus') || line.includes('menyambung')) {
        pushLog(rec, line.replace(/^[^A-Za-z0-9]+/, ''));
      }
    }
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', (c) => process.stderr.write(`[${orderId}] ${c}`));
  proc.on('exit', (codeExit) => {
    clearTimeout(rec.timer);
    if (rec.status !== 'linked' && rec.status !== 'expired') setStatus(orderId, rec, 'closed');
    pushLog(rec, `Proses bot berhenti (code ${codeExit}).`);
    console.log(`[${orderId}] proses bot keluar (code ${codeExit}), status=${rec.status}`);
  });

  return rec;
}

/** Waktu tunggu habis: hentikan bot, hapus sesi yang belum tertaut, status 'expired'. */
function expire(orderId, rec) {
  if (rec.status === 'linked' || rec.status === 'expired') return;
  clearTimeout(rec.timer);
  setStatus(orderId, rec, 'expired');
  pushLog(rec, `Waktu tautan ${Math.round(PAIR_TIMEOUT_MS / 60000)} menit habis. Bot dihentikan, kode pairing tidak dibuat lagi.`);
  console.log(`[${orderId}] waktu tautan habis → bot dihentikan`);
  if (rec.proc && !rec.proc.killed) { try { rec.proc.kill('SIGTERM'); } catch { /* abaikan */ } }
  try { fs.rmSync(path.join(agentDir(orderId), 'sesi'), { recursive: true, force: true }); } catch { /* abaikan */ }
}

function stopBot(orderId) {
  const rec = sessions.get(orderId);
  if (!rec) return;
  clearTimeout(rec.timer);
  if (rec.proc && !rec.proc.killed) {
    try { rec.proc.kill('SIGTERM'); } catch { /* abaikan */ }
  }
}

function view(orderId, rec) {
  const remaining = rec.status === 'linked' || rec.status === 'expired' ? 0 : Math.max(0, Math.round((rec.expiresAt - Date.now()) / 1000));
  return { ok: true, orderId, status: rec.status, hasCode: !!rec.code, phone: rec.phone, expiresAt: rec.expiresAt, remainingSec: remaining, log: rec.log || [] };
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ['session', ':id', 'resend']

  if (url.pathname === '/health') return send(res, 200, { ok: true, up: true, pairTimeoutMin: PAIR_TIMEOUT_MS / 60000 });

  // Auth
  if (TOKEN && req.headers['x-agent-token'] !== TOKEN) {
    return send(res, 401, { ok: false, message: 'Token tidak valid' });
  }

  // POST /session
  if (req.method === 'POST' && parts.length === 1 && parts[0] === 'session') {
    const body = await readBody(req);
    const phone = normalizePhone(body.phone);
    const email = String(body.email || '').trim();
    const orderId = safeId(body.orderId || ('AI' + Date.now()));
    if (!phone || !email) return send(res, 400, { ok: false, message: 'phone & email wajib' });
    if (sessions.has(orderId)) stopBot(orderId);
    const rec = startBot(orderId, { phone, email, nama: body.nama || '', paket: body.paket || '' });
    return send(res, 200, view(orderId, rec));
  }

  // POST /session/:id/resend — kirim ulang kode (jendela 10 menit baru). Tidak untuk sesi yang sudah tertaut.
  if (req.method === 'POST' && parts.length === 3 && parts[0] === 'session' && parts[2] === 'resend') {
    const orderId = safeId(parts[1]);
    const prev = sessions.get(orderId);
    if (!prev) return send(res, 404, { ok: false, message: 'Sesi tidak ditemukan' });
    if (prev.status === 'linked') return send(res, 409, { ok: false, message: 'WhatsApp sudah tertaut.' });
    if (prev.status === 'expired') return send(res, 410, { ok: false, status: 'expired', message: 'Waktu tautan sudah habis. Silakan pesan ulang.' });
    stopBot(orderId);
    // hapus folder sesi agar pairing benar-benar baru
    try { fs.rmSync(path.join(agentDir(orderId), 'sesi'), { recursive: true, force: true }); } catch { /* abaikan */ }
    const rec = startBot(orderId, prev.info);
    return send(res, 200, view(orderId, rec));
  }

  // GET /session/:id
  if (req.method === 'GET' && parts.length === 2 && parts[0] === 'session') {
    const orderId = safeId(parts[1]);
    const rec = sessions.get(orderId);
    if (rec) return send(res, 200, view(orderId, rec));
    // server.js sempat restart: baca status terakhir dari disk
    const st = readState(orderId);
    if (st) {
      let status = st.status;
      if (isRegistered(orderId)) status = 'linked';
      else if (status !== 'linked' && status !== 'expired' && Date.now() > (st.expiresAt || 0)) status = 'expired';
      return send(res, 200, { ok: true, orderId, status, hasCode: false, phone: st.phone, expiresAt: st.expiresAt, remainingSec: 0, log: [], fromDisk: true });
    }
    return send(res, 404, { ok: false, message: 'Sesi tidak ditemukan' });
  }

  // NexSpace: /nexspace/create | /nexspace/renew | /nexspace/cancel | /nexspace/status/:username
  if (parts[0] === 'nexspace') return nexspace.handle(req, res, parts, readBody, send);

  return send(res, 404, { ok: false, message: 'Not found' });
});

/** Saat server.js menyala: jalankan ulang semua agen yang SUDAH tertaut (mis. setelah VPS reboot). */
function restoreLinkedAgents() {
  let n = 0;
  for (const id of fs.readdirSync(AGENTS_ROOT)) {
    const st = readState(id);
    if (!st || !st.info || !isRegistered(id)) continue;
    startBot(id, st.info);
    n++;
  }
  if (n) console.log(`♻️  ${n} agen tertaut dijalankan ulang.`);
}

server.listen(PORT, '127.0.0.1', () => {
  restoreLinkedAgents();
  nexspace.startSweeper(); // kunci akun NexSpace yang masa aktifnya habis (tiap 10 menit)
  console.log(`🟢 Agen control server di http://127.0.0.1:${PORT} · batas tautan ${PAIR_TIMEOUT_MS / 60000} menit · folder agen ${AGENTS_ROOT}`);
  if (!TOKEN || TOKEN === 'GANTI_TOKEN_RAHASIA') {
    console.warn('⚠️  AGENT_TOKEN belum diganti! Set env AGENT_TOKEN atau edit settings.js.');
  }
});
