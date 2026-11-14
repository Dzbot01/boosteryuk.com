// lib/nexspace.js — NexSpace Started: membuat akun Linux (tanpa root) untuk pembeli.
// Dipanggil website lewat tunnel wa-origin → server.js (header x-agent-token wajib, dicek di server.js).
// server.js HARUS berjalan sebagai root (useradd/chpasswd/systemctl butuh root).
//
// Endpoint (didaftarkan oleh server.js):
//   POST /nexspace/create  { orderId, username, password, ramMb, cpuPct, tasks, diskGb, expiresAt:'YYYY-MM-DD' }
//   POST /nexspace/renew   { username, expiresAt }
//   POST /nexspace/cancel  { orderId }            → hapus akun milik order ini (rollback dari website)
//   GET  /nexspace/status/:username
//
// Batasan per akun (systemd user slice, tetap berlaku setelah reboot):
//   MemoryMax = RAM paket, MemorySwapMax = 0, CPUQuota = cpuPct%, TasksMax = tasks (anti fork-bomb)
// Masa aktif: `chage -E` (PAM menolak login setelah tanggal itu) + sweep 10 menit: kunci akun & hentikan prosesnya.
// Kuota disk dipasang bila `setquota` tersedia & filesystem mendukung (opsional).
// Akun masuk grup `nexspace` → blok Match di sshd_config (setup-nexspace.sh): tanpa port-forward/tunnel/X11.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'nexspace.json');
const GROUP = process.env.NEXSPACE_GROUP || 'nexspace';
const USER_RE = /^[a-z][a-z0-9_]{2,15}$/;
const RESERVED = new Set([
  'root', 'admin', 'administrator', 'ubuntu', 'debian', 'daemon', 'bin', 'sys', 'sync', 'games', 'man', 'lp', 'mail',
  'news', 'uucp', 'proxy', 'www', 'www_data', 'backup', 'list', 'irc', 'gnats', 'nobody', 'systemd', 'syslog', 'sshd',
  'messagebus', 'mysql', 'postgres', 'redis', 'nginx', 'apache', 'cloudflared', 'node', 'pm2', 'docker', 'git', 'ftp',
  'test', 'guest', 'user', 'support', 'boosteryuk', 'nexspace', 'paimon',
]);

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { accounts: {} }; }
}
function saveDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}

/** Jalankan perintah TANPA shell (argumen array → aman dari injeksi). */
function run(cmd, args, input) {
  return new Promise((resolve) => {
    const p = execFile(cmd, args, { timeout: 30000 }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: String(stdout || '').trim(), err: String(stderr || (err && err.message) || '').trim() }));
    if (input != null) p.stdin.end(input);
  });
}

const today = () => new Date().toISOString().slice(0, 10);
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

async function userExists(u) { return (await run('id', ['-u', u])).ok; }

async function applyLimits(username, { ramMb, cpuPct, tasks, diskGb }) {
  const uid = (await run('id', ['-u', username])).out;
  const props = [`MemoryMax=${ramMb}M`, 'MemorySwapMax=0', `CPUQuota=${cpuPct}%`, `TasksMax=${tasks}`];
  const lim = await run('systemctl', ['set-property', `user-${uid}.slice`, ...props]);
  let quota = false;
  if (diskGb > 0) {
    const kb = String(Math.round(diskGb * 1024 * 1024));
    const q = await run('setquota', ['-u', username, kb, kb, '0', '0', '-a']);
    quota = q.ok;
  }
  return { limits: lim.ok, limitsError: lim.ok ? undefined : lim.err, quota };
}

async function create(b) {
  const orderId = String(b.orderId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const username = String(b.username || '').toLowerCase();
  const password = String(b.password || '');
  const ramMb = Math.max(128, Math.min(65536, parseInt(b.ramMb, 10) || 0));
  const cpuPct = Math.max(10, Math.min(800, parseInt(b.cpuPct, 10) || 50));
  const tasks = Math.max(32, Math.min(4096, parseInt(b.tasks, 10) || 128));
  const diskGb = Math.max(0, Math.min(500, Number(b.diskGb) || 0));
  if (!orderId) return [400, { ok: false, message: 'orderId wajib' }];
  if (!USER_RE.test(username) || RESERVED.has(username)) return [400, { ok: false, code: 'BAD_USERNAME', message: 'Username tidak valid atau tidak boleh dipakai.' }];
  if (password.length < 8 || password.length > 64 || /[:\r\n]/.test(password)) return [400, { ok: false, message: 'Password 8–64 karakter, tanpa titik dua.' }];
  if (!validDate(b.expiresAt)) return [400, { ok: false, message: 'expiresAt tidak valid' }];

  const db = loadDb();
  const prev = db.accounts[username];
  if (prev && prev.orderId === orderId) return [200, { ok: true, username, already: true }]; // idempotent
  if (prev || (await userExists(username))) return [409, { ok: false, code: 'USERNAME_TAKEN', message: 'Username sudah dipakai. Pilih nama lain.' }];

  if (!(await run('getent', ['group', GROUP])).ok) await run('groupadd', [GROUP]);
  const add = await run('useradd', ['-m', '-s', '/bin/bash', '-G', GROUP, '-c', `NexSpace ${orderId}`, username]);
  if (!add.ok) return [500, { ok: false, message: 'Gagal membuat user: ' + add.err.slice(0, 160) }];
  const rollback = async (msg) => { await run('userdel', ['-r', username]); return [500, { ok: false, message: msg }]; };

  if (!(await run('chpasswd', [], `${username}:${password}\n`)).ok) return rollback('Gagal mengatur password.');
  await run('chmod', ['700', `/home/${username}`]);
  if (!(await run('chage', ['-E', b.expiresAt, username])).ok) return rollback('Gagal mengatur masa aktif.');
  const lim = await applyLimits(username, { ramMb, cpuPct, tasks, diskGb });
  if (!lim.limits) return rollback('Gagal memasang batas RAM/CPU: ' + (lim.limitsError || '').slice(0, 160));

  db.accounts[username] = { orderId, ramMb, cpuPct, tasks, diskGb, expiresAt: b.expiresAt, createdAt: new Date().toISOString(), locked: false };
  saveDb(db);
  console.log(`[nexspace] akun ${username} dibuat (order ${orderId}, ${ramMb}MB, CPU ${cpuPct}%, s/d ${b.expiresAt}, kuota disk ${lim.quota ? 'ya' : 'tidak'})`);
  return [200, { ok: true, username, quota: lim.quota }];
}

async function renew(b) {
  const username = String(b.username || '').toLowerCase();
  const db = loadDb();
  const acc = db.accounts[username];
  if (!acc) return [404, { ok: false, message: 'Akun tidak ditemukan' }];
  if (!validDate(b.expiresAt)) return [400, { ok: false, message: 'expiresAt tidak valid' }];
  await run('chage', ['-E', b.expiresAt, username]);
  await run('usermod', ['-U', username]);
  acc.expiresAt = b.expiresAt;
  acc.locked = false;
  saveDb(db);
  return [200, { ok: true, username, expiresAt: b.expiresAt }];
}

async function cancel(b) {
  const orderId = String(b.orderId || '');
  const db = loadDb();
  const entry = Object.entries(db.accounts).find(([, a]) => a.orderId === orderId);
  if (!entry) return [200, { ok: true, removed: false }];
  const [username] = entry;
  await run('pkill', ['-KILL', '-u', username]);
  await run('userdel', ['-r', username]);
  delete db.accounts[username];
  saveDb(db);
  return [200, { ok: true, removed: true, username }];
}

async function status(username) {
  const acc = loadDb().accounts[String(username || '').toLowerCase()];
  if (!acc) return [404, { ok: false, message: 'Akun tidak ditemukan' }];
  return [200, { ok: true, username, ...acc, expired: acc.expiresAt < today() }];
}

/** Akun lewat masa aktif: kunci password & hentikan semua prosesnya. */
async function sweep() {
  const db = loadDb();
  let changed = false;
  for (const [username, acc] of Object.entries(db.accounts)) {
    if (acc.expiresAt < today() && !acc.locked) {
      await run('usermod', ['-L', username]);
      await run('pkill', ['-KILL', '-u', username]);
      acc.locked = true;
      changed = true;
      console.log(`[nexspace] ${username} kedaluwarsa (${acc.expiresAt}) → dikunci`);
    }
  }
  if (changed) saveDb(db);
}

function startSweeper() {
  sweep().catch(() => {});
  setInterval(() => sweep().catch(() => {}), 10 * 60 * 1000);
}

/** Router: dipanggil server.js untuk path /nexspace/... (token sudah dicek). */
async function handle(req, res, parts, readBody, send) {
  try {
    if (req.method === 'POST' && parts[1] === 'create') { const [c, d] = await create(await readBody(req)); return send(res, c, d); }
    if (req.method === 'POST' && parts[1] === 'renew') { const [c, d] = await renew(await readBody(req)); return send(res, c, d); }
    if (req.method === 'POST' && parts[1] === 'cancel') { const [c, d] = await cancel(await readBody(req)); return send(res, c, d); }
    if (req.method === 'GET' && parts[1] === 'status' && parts[2]) { const [c, d] = await status(parts[2]); return send(res, c, d); }
    return send(res, 404, { ok: false, message: 'Not found' });
  } catch (e) {
    console.error('[nexspace]', e);
    return send(res, 500, { ok: false, message: 'Kesalahan server NexSpace' });
  }
}

module.exports = { handle, startSweeper, _uji: { create, renew, cancel, status, sweep, USER_RE, RESERVED } };
