import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Check, CheckCircle2, Copy, Cpu, Crown, Eye, EyeOff, HardDrive, KeyRound, Loader2, MemoryStick, Repeat2, Server, ShieldCheck, ShieldOff, Terminal, Wallet, X,
} from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import { nexspaceApi, refreshNxBanner, type NxOrder, type NxPlan, type NxTier } from '../services/nexspaceApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const tgl = (s: string | null) => (s ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s.slice(0, 10) + 'T00:00:00')) : '—');
const USER_RE = /^[a-z][a-z0-9_]{2,15}$/;
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ready: { label: 'Siap', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pending: { label: 'Sedang dibuat', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  provisioning: { label: 'Memproses', cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  failed: { label: 'Gagal', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  rejected: { label: 'Dibatalkan', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

function CopyBtn({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1500); })}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {ok ? 'Disalin' : label}
    </button>
  );
}

/**
 * NexSpace (pengganti menu VPS):
 *  - Started: akun Linux tanpa root, dibuat otomatis setelah saldo terpotong.
 *  - Pro: akses root & boleh dijual lagi, disiapkan admin (kode unik via email → Portal Server).
 */
export default function NexSpacePage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState<NxPlan[] | null>(null);
  const [months, setMonths] = useState<number[]>([1, 3, 6, 12]);
  const [rules, setRules] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [tier, setTier] = useState<NxTier>('started');
  const [planId, setPlanId] = useState('');
  const [dur, setDur] = useState(1);
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ order: NxOrder; email?: string; message?: string } | null>(null);
  const [mine, setMine] = useState<NxOrder[]>([]);

  const loadMine = useCallback(async () => {
    const r = await nexspaceApi.mine();
    if (r.ok) setMine(r.orders || []);
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await nexspaceApi.plans();
      if (!r.ok) return setLoadErr(r.message || 'Paket belum bisa dimuat.');
      setPlans(r.plans);
      setMonths(r.months);
      setRules(r.rules);
    })();
    void loadMine();
  }, [loadMine]);

  const list = useMemo(() => (plans || []).filter((p) => p.tier === tier), [plans, tier]);
  const plan = plans?.find((p) => p.id === planId) || null;
  const total = plan ? plan.price * dur : 0;
  const balance = user?.balance ?? 0;
  const isStarted = plan ? plan.tier === 'started' : tier === 'started';

  const problem = (() => {
    if (!plan) return 'Pilih paket dulu.';
    if (!USER_RE.test(username)) return 'Username 3–16 karakter: huruf kecil, angka, garis bawah; diawali huruf.';
    if (isStarted) {
      if (pw.length < 8) return 'Password minimal 8 karakter.';
      if (pw.includes(':')) return 'Password tidak boleh mengandung titik dua (:).';
      if (pw !== pw2) return 'Konfirmasi password tidak sama.';
    }
    if (!agree) return 'Centang persetujuan aturan penggunaan.';
    if (balance < total) return `Saldo kurang ${rupiah(total - balance)}.`;
    return '';
  })();

  const order = async () => {
    if (!plan || problem) return setErr(problem);
    setBusy(true);
    setErr('');
    const r = await nexspaceApi.order(plan.id, dur, username, isStarted ? pw : undefined);
    setBusy(false);
    await refresh();
    if (!r.ok || !r.order) return setErr(r.message || 'Pesanan gagal.');
    setDone({ order: r.order, email: r.email, message: r.message });
    setPw('');
    setPw2('');
    refreshNxBanner();
    void loadMine();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inp = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
  const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-6">
      <Seo title="NexSpace — Server Linux" description="NexSpace Boosteryuk: akun server Linux Started tanpa root dan NexSpace Pro dengan akses root, dibayar dari saldo akun." noindex />

      <Reveal>
        <div className="mb-5">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300 dark:bg-white/10">
            <Terminal className="h-3 w-3" strokeWidth={2.6} /> Boosteryuk NexSpace
          </p>
          <h1 className="font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">Server Linux siap pakai</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
            Jalankan bot, script, dan aplikasi 24 jam. <b>Started</b> langsung aktif setelah bayar; <b>Pro</b> dengan akses root disiapkan tim kami.
          </p>
        </div>
      </Reveal>

      {/* Aturan — di luar card paket */}
      <div role="note" className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="text-[13px] leading-relaxed text-rose-800 dark:text-rose-200">
          <p className="font-bold">Aturan penggunaan NexSpace</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {(rules.length ? rules : ['Dilarang menjalankan Pterodactyl dan VPN.']).map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      </div>

      {done && (
        <section className={`${card} mb-6 border-emerald-300 p-5 dark:border-emerald-800`} aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 text-[16px] font-extrabold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> {done.order.tier === 'started' ? 'Server kamu sudah aktif!' : 'Pembayaran berhasil!'}
            </p>
            <button onClick={() => setDone(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          {done.order.tier === 'started' && done.order.login ? (
            <div className="mt-3 space-y-2 text-[13.5px]">
              <p className="text-slate-600 dark:text-slate-300">Login dengan password yang kamu buat. Simpan data ini baik-baik.</p>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-4 py-3 font-mono text-[13.5px] text-emerald-300">
                <span className="min-w-0 truncate">$ {done.order.login.ssh}</span>
                <CopyBtn text={done.order.login.ssh} />
              </div>
              <p className="text-[12.5px] text-slate-500">
                Host <b>{done.order.login.host}</b> · Port <b>{done.order.login.port}</b> · Username <b>{done.order.login.user}</b> · Aktif s/d <b>{tgl(done.order.expires_at)}</b>
              </p>
            </div>
          ) : (
            <div className="mt-3 text-[13.5px] text-slate-600 dark:text-slate-300">
              <p>{done.message}</p>
              <p className="mt-1">Buka email, salin <b>kode unik</b> (format NXP-XXXX-XXXX), lalu masukkan di Portal Server untuk memantau pembuatan server <b>{done.order.username}</b>.</p>
              <button onClick={() => navigate('/nexspace/portal')} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                <KeyRound className="h-4 w-4" /> Buka Portal Server
              </button>
            </div>
          )}
        </section>
      )}

      {/* Pilih tipe */}
      <div className="mb-4 inline-flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800" role="tablist">
        {(['started', 'pro'] as NxTier[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tier === t}
            onClick={() => { setTier(t); setPlanId(''); setErr(''); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-bold transition ${tier === t ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
          >
            {t === 'pro' ? <Crown className="h-4 w-4 text-amber-500" /> : <Server className="h-4 w-4" />} NexSpace {t === 'pro' ? 'Pro' : 'Started'}
          </button>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-slate-500 dark:text-slate-400">
        {tier === 'started'
          ? 'Akun Linux tanpa akses root — langsung aktif dalam hitungan detik setelah pembayaran. Cocok untuk bot WhatsApp/Telegram, script, dan aplikasi Node.js/Python.'
          : 'Akses root penuh dan boleh dijual lagi. Server disiapkan tim kami; kode unik dikirim ke email dan data login muncul di Portal Server.'}
      </p>

      {loadErr && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{loadErr}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* Card list paket */}
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Paket NexSpace">
          {plans === null && [0, 1, 2].map((i) => <div key={i} className={`${card} h-48 animate-pulse`} />)}
          {list.map((p) => {
            const on = p.id === planId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => { setPlanId(p.id); setErr(''); }}
                className={`${card} p-4 text-left transition hover:border-cyan-300 ${on ? 'border-cyan-500 ring-2 ring-cyan-500/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Boosteryuk NexSpace {p.tier === 'pro' ? 'Pro' : 'Started'}</p>
                    <p className="mt-0.5 font-display text-[26px] font-black leading-none text-slate-900 dark:text-white">{p.ram}</p>
                  </div>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-[12.5px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2"><MemoryStick className="h-3.5 w-3.5 text-slate-400" /> RAM {p.ram}</li>
                  <li className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5 text-slate-400" /> {p.cpu}</li>
                  <li className="flex items-center gap-2"><HardDrive className="h-3.5 w-3.5 text-slate-400" /> Disk {p.disk_gb} GB</li>
                  {p.tier === 'pro' ? (
                    <>
                      <li className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" /> Akses root</li>
                      <li className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><Repeat2 className="h-3.5 w-3.5" /> Boleh dijual lagi</li>
                    </>
                  ) : (
                    <li className="flex items-center gap-2"><ShieldOff className="h-3.5 w-3.5 text-slate-400" /> Non-root (user Linux)</li>
                  )}
                </ul>
                <p className="mt-4 border-t border-slate-100 pt-3 text-[13px] text-slate-500 dark:border-slate-800">
                  <span className="font-display text-[20px] font-extrabold text-slate-900 dark:text-white">{rupiah(p.price)}</span> /bulan
                </p>
              </button>
            );
          })}
        </div>

        {/* Form order */}
        <aside className={`${card} p-5 lg:sticky lg:top-24`} aria-label="Form pesanan NexSpace">
          <p className="text-[15px] font-extrabold text-slate-900 dark:text-white">{plan ? plan.name : 'Pilih paket'}</p>
          <p className="text-[12px] text-slate-500">{plan ? `${plan.ram} · ${plan.cpu} · ${plan.disk_gb} GB` : 'Klik salah satu card paket.'}</p>

          <p className="mb-1.5 mt-4 text-[12px] font-semibold text-slate-600 dark:text-slate-300">Durasi</p>
          <div className="grid grid-cols-4 gap-1.5">
            {months.map((m) => (
              <button key={m} type="button" onClick={() => setDur(m)} className={`h-10 rounded-lg border text-[12.5px] font-bold ${dur === m ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
                {m} bln
              </button>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">{isStarted ? 'Username SSH' : 'Nama server / username'}</span>
            <input className={`${inp} font-mono`} value={username} maxLength={16} autoCapitalize="none" autoComplete="off" spellCheck={false}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="mis. tokobudi" />
            <span className="mt-1 block text-[11px] text-slate-500">3–16 karakter: huruf kecil, angka, garis bawah.</span>
          </label>

          {isStarted && (
            <>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">Password SSH</span>
                <div className="relative">
                  <input className={`${inp} pr-10`} type={showPw ? 'text' : 'password'} value={pw} maxLength={64} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} placeholder="Minimal 8 karakter" />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">Ulangi password</span>
                <input className={inp} type={showPw ? 'text' : 'password'} value={pw2} maxLength={64} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
              </label>
            </>
          )}

          {!isStarted && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Password & data login Pro diberikan tim kami. Setelah bayar, kode unik dikirim ke email untuk membuka Portal Server.
            </p>
          )}
          {username && USER_RE.test(username) && plan && isStarted && (
            <p className="mt-3 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-emerald-300">
              $ ssh {isStarted ? username : 'root'}@185.205.222.202 -p 10892
            </p>
          )}

          <label className="mt-4 flex items-start gap-2 text-[12px] text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-600" />
            Saya setuju tidak menjalankan Pterodactyl, VPN, dan aktivitas terlarang lainnya.
          </label>

          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[13px] dark:border-slate-800">
            <div className="flex justify-between"><dt className="text-slate-500">Harga</dt><dd>{plan ? `${rupiah(plan.price)} × ${dur} bln` : '—'}</dd></div>
            <div className="flex justify-between font-bold"><dt>Total</dt><dd className="text-[16px] text-cyan-700 dark:text-cyan-400">{rupiah(total)}</dd></div>
            <div className="flex justify-between text-[12px] text-slate-500"><dt className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Saldo</dt><dd>{rupiah(balance)}</dd></div>
          </dl>

          {err && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700 dark:bg-rose-950/40">{err}</p>}
          {plan && balance < total && (
            <Link to="/deposit" className="mt-3 block text-center text-[12.5px] font-bold text-cyan-700 underline">Saldo kurang — deposit dulu</Link>
          )}

          <button
            onClick={() => void order()}
            disabled={busy || !plan}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[14px] font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {isStarted ? 'Membuat server…' : 'Memproses…'}</> : <><Server className="h-4 w-4" /> Bayar {rupiah(total)}</>}
          </button>
        </aside>
      </div>

      {/* Server saya */}
      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="nx-mine">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="nx-mine" className="font-display text-[18px] font-extrabold text-slate-900 dark:text-white">Server saya</h2>
            <Link to="/nexspace/portal" className="text-[12.5px] font-bold text-cyan-700 hover:underline dark:text-cyan-400">Portal Server</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((o) => {
              const st = STATUS[o.status] || STATUS.failed;
              return (
                <div key={o.order_id} className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[14px] font-bold text-slate-900 dark:text-white">{o.username}</p>
                      <p className="text-[11.5px] text-slate-500">{o.plan_name} · {o.months} bln · s/d {tgl(o.expires_at)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  {o.tier === 'started' && o.login && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 font-mono text-[12px] text-emerald-300">
                      <span className="min-w-0 truncate">$ {o.login.ssh}</span>
                      <CopyBtn text={o.login.ssh} />
                    </div>
                  )}
                  {o.tier === 'pro' && (o.status === 'pending' || o.status === 'ready') && (
                    <Link to="/nexspace/portal" className="mt-3 inline-block text-[12.5px] font-bold text-cyan-700 hover:underline dark:text-cyan-400">
                      {o.status === 'ready' ? 'Lihat data login →' : 'Pantau status →'}
                    </Link>
                  )}
                  {o.note && o.status !== 'ready' && <p className="mt-2 text-[11.5px] text-slate-500">{o.note}{o.refunded ? ' — saldo dikembalikan.' : ''}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
