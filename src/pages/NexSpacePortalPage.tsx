import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import Seo from '../components/Seo';
import { nexspaceApi, refreshNxBanner, type NxOrder } from '../services/nexspaceApi';

/** Baris "log" animasi terminal — hanya tampilan; status sebenarnya dari server (DB). */
const LINES = (u: string) => [
  `$ nexspace create --name ${u}`,
  '→ memverifikasi pembayaran ......... ok',
  '→ mengalokasikan sumber daya ....... ok',
  `→ menyiapkan sistem untuk ${u} ...`,
  '→ mengonfigurasi akses root & SSH ..',
  '→ menerapkan aturan keamanan .......',
  '→ menunggu verifikasi tim NexSpace .',
];

function Field({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="truncate font-mono text-[15px] font-bold text-slate-900 dark:text-white">{show ? value : '•'.repeat(Math.min(14, value.length))}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        {secret && (
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyikan' : 'Tampilkan'} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <button type="button" aria-label={`Salin ${label}`} onClick={() => void navigator.clipboard?.writeText(value).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1400); })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Animasi terminal: baris diketik satu per satu lalu kursor berkedip di baris terakhir. */
function TerminalWait({ username }: { username: string }) {
  const lines = LINES(username);
  const [n, setN] = useState(1);
  const [chars, setChars] = useState(0);
  useEffect(() => {
    const cur = lines[n - 1] || '';
    if (chars < cur.length) {
      const t = window.setTimeout(() => setChars((c) => c + 1), 28);
      return () => window.clearTimeout(t);
    }
    if (n < lines.length) {
      const t = window.setTimeout(() => { setN((x) => x + 1); setChars(0); }, 520);
      return () => window.clearTimeout(t);
    }
  }, [n, chars, lines]);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1117] shadow-[0_24px_60px_-30px_rgba(0,0,0,.7)]">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#161b22] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 font-mono text-[12px] text-slate-400">root@nexspace: ~</span>
      </div>
      <pre className="min-h-[230px] whitespace-pre-wrap px-5 py-4 font-mono text-[13px] leading-[1.8] text-emerald-300" aria-live="off">
        {lines.slice(0, n).map((l, i) => {
          const text = i === n - 1 ? l.slice(0, chars) : l;
          return <span key={i} className={i === 0 ? 'text-cyan-300' : undefined}>{text}{i === n - 1 ? <span className="ml-0.5 inline-block h-[1.05em] w-[0.6em] translate-y-[3px] animate-pulse bg-emerald-300" /> : null}{'\n'}</span>;
        })}
      </pre>
    </div>
  );
}

/**
 * Portal Server NexSpace Pro.
 * Status selalu dibaca dari server (DB) → halaman tunggu tetap sama walau di-refresh / ditutup.
 * Banner di bawah header (setiap halaman) mengarah ke sini selama pesanan belum diambil.
 */
export default function NexSpacePortalPage() {
  const [order, setOrder] = useState<NxOrder | null | undefined>(undefined);
  const [hasUnclaimed, setHasUnclaimed] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const r = await nexspaceApi.portal();
    if (!r.ok) return setErr(r.message || 'Gagal memuat portal.');
    setOrder(r.order ?? null);
    setHasUnclaimed(!!r.has_unclaimed);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Selama menunggu: cek status tiap 15 detik (data login otomatis muncul begitu admin mengirimnya).
  useEffect(() => {
    if (order?.status !== 'pending') return;
    const t = window.setInterval(async () => {
      const r = await nexspaceApi.portal(order.order_id);
      if (r.ok && r.order && r.order.status !== 'pending') {
        setOrder(r.order);
        refreshNxBanner();
      }
    }, 15000);
    return () => window.clearInterval(t);
  }, [order?.status, order?.order_id]);

  const claim = async () => {
    setBusy(true);
    setErr('');
    const r = await nexspaceApi.claim(code);
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Kode tidak valid.');
    const p = await nexspaceApi.portal(r.order_id);
    setOrder(p.order ?? null);
    refreshNxBanner();
  };

  const ack = async () => {
    if (!order) return;
    await nexspaceApi.ack(order.order_id);
    setSaved(true);
    refreshNxBanner();
  };

  const formatCode = (v: string) => {
    const s = v.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^NXP/, '').slice(0, 8);
    return 'NXP-' + s.slice(0, 4) + (s.length > 4 ? '-' + s.slice(4) : '');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-36 pt-10 sm:px-6">
      <Seo title="Portal Server NexSpace" noindex />
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">NexSpace Pro</p>
      <h1 className="font-display text-[28px] font-black tracking-tight text-slate-900 dark:text-white">Portal Server</h1>

      {order === undefined && !err && <div className="mt-6 h-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />}

      {/* Belum ada pesanan yang diklaim → masukkan kode unik */}
      {order === null && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white"><KeyRound className="h-5 w-5 text-cyan-600" /> Masukkan kode unik</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {hasUnclaimed ? 'Kode unik sudah dikirim ke email akunmu setelah pembayaran NexSpace Pro.' : 'Kode unik dikirim ke email setelah kamu membeli NexSpace Pro.'}
          </p>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void claim(); }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value ? formatCode(e.target.value) : '')}
              placeholder="NXP-XXXX-XXXX"
              aria-label="Kode unik"
              autoComplete="one-time-code"
              className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 font-mono text-[17px] tracking-[0.15em] text-slate-900 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button disabled={busy || code.length < 13} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-[14px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Masuk
            </button>
          </form>
          {!hasUnclaimed && <p className="mt-3 text-[12.5px] text-slate-500">Belum punya? <Link to="/nexspace" className="font-bold text-cyan-700 underline">Pesan NexSpace Pro</Link></p>}
        </section>
      )}

      {/* Halaman tunggu */}
      {order?.status === 'pending' && (
        <section className="mt-6">
          <p className="mb-3 text-[14px] text-slate-600 dark:text-slate-300">
            Server <b className="font-mono text-slate-900 dark:text-white">{order.username}</b> sedang dibuat · {order.plan_name} · {order.months} bulan
          </p>
          <TerminalWait username={order.username} />
          <div className="mt-4 flex gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-[13px] leading-relaxed text-cyan-900 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">
            <Mail className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Jika proses ini sudah selesai, kamu akan diberi tahu melalui email. Halaman ini boleh ditutup — kamu bisa kembali kapan saja lewat banner di bawah header atau menu NexSpace.</p>
          </div>
        </section>
      )}

      {/* Data login siap */}
      {order?.status === 'ready' && order.login && (
        <section className="mt-6 space-y-3">
          <p className="flex items-center gap-2 text-[16px] font-extrabold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /> Server {order.username} sudah siap</p>
          <Field label="Perintah SSH" value={order.login.ssh} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Host" value={order.login.host} />
            <Field label="Port" value={String(order.login.port)} />
            <Field label="Username" value={order.login.user} />
            {order.login.password && <Field label="Password" value={order.login.password} secret />}
          </div>
          {order.note && <p className="rounded-xl bg-slate-100 px-4 py-3 text-[13px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">Catatan admin: {order.note}</p>}
          <p className="text-[12.5px] text-slate-500">Segera ganti password setelah login pertama (perintah <code className="font-mono">passwd</code>). Ingat: dilarang menjalankan Pterodactyl dan VPN.</p>
          {saved ? (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600"><Check className="h-4 w-4" /> Tersimpan. Data ini tetap bisa dibuka dari menu NexSpace → Server saya.</p>
          ) : (
            <button onClick={() => void ack()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-[13.5px] font-bold text-white dark:bg-white dark:text-slate-900">
              <Check className="h-4 w-4" /> Saya sudah menyimpan data login
            </button>
          )}
        </section>
      )}

      {order?.status === 'rejected' && (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13.5px] text-rose-700">Pesanan dibatalkan: {order.note || '-'} Saldo sudah dikembalikan.</p>
      )}
      {err && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-950/40">{err}</p>}
    </div>
  );
}
