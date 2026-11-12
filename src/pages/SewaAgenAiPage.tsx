import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, LoaderCircle, CheckCircle2, AlertCircle, Smartphone, Bot } from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import AiAssistantCard from '../components/AiAssistantCard';
import { SERVICE_SLIDES, socialIconUrl } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useOrderHistory } from '../context/OrderHistoryContext';
import { isValidEmail } from '../services/otp';
import { createAgent, resendAgentCode, getAgentStatus } from '../services/agentApi';

const SLIDE_INTERVAL = 4500;

const formatRupiah = (v: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);

/* Platform di tiap sudut belah ketupat (urutan sinar: WA -> Discord -> Telegram -> Facebook -> WA) */
const PLATFORMS = [
  { id: 'whatsapp', name: 'WhatsApp', slug: 'whatsapp', color: '#25D366', corner: 'left' },
  { id: 'discord', name: 'Discord', slug: 'discord', color: '#5865F2', corner: 'top' },
  { id: 'telegram', name: 'Telegram', slug: 'telegram', color: '#229ED9', corner: 'right' },
  { id: 'facebook', name: 'Facebook', slug: 'facebook', color: '#1877F2', corner: 'bottom' },
] as const;

type PlatformId = (typeof PLATFORMS)[number]['id'];

const CORNER_POS: Record<string, string> = {
  top: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  bottom: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2',
  left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
};

/* ===== Paket Agen AI WhatsApp ===== */
const WA_FEATURES = [
  'Jaga Grup',
  'Auto Respon',
  'Auto Order',
  'Reply Status Verified Meta',
  'Database User',
  'Fitur Multi Media',
  'API Payment Gateway',
];

interface Tier {
  id: string;
  name: string;
  price: number;
  badge: string;
  desc: string;
  featureCount: number; // berapa fitur awal yang aktif
  paymentGateway: boolean;
}

const WA_TIERS: Tier[] = [
  { id: 'starter', name: 'Starter', price: 10000, badge: 'Pemula', desc: 'Cocok untuk pemula yang baru mulai pakai Agen AI WhatsApp.', featureCount: 3, paymentGateway: false },
  { id: 'medium', name: 'Medium', price: 35000, badge: 'Populer', desc: 'Untuk yang mulai serius — fitur lebih lengkap & verified.', featureCount: 5, paymentGateway: false },
  { id: 'bisnis', name: 'Bisnis', price: 75000, badge: 'Terlengkap', desc: 'Paket terlengkap untuk bisnis — semua fitur + payment gateway.', featureCount: 7, paymentGateway: true },
];

const PROCESS_STEPS = [
  'Memvalidasi pesanan…',
  'Menyiapkan lingkungan Agen AI…',
  'Membangun database pengguna…',
  'Menghubungkan nomor WhatsApp…',
  'Mengaktifkan fitur paket…',
  'Mengirim kode verifikasi ke email…',
];

type Phase = 'select' | 'beam' | 'packages' | 'form' | 'processing' | 'pairing' | 'done';

export default function SewaAgenAiPage() {
  const navigate = useNavigate();
  const { user, topUp } = useAuth();
  const { addOrder } = useOrderHistory();

  // slider
  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  const next = useCallback(() => setIndex((i) => (i + 1) % SERVICE_SLIDES.length), []);
  useEffect(() => {
    const t = window.setInterval(() => { if (!paused.current) next(); }, SLIDE_INTERVAL);
    return () => window.clearInterval(t);
  }, [next]);

  // flow
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [phase, setPhase] = useState<Phase>('select');
  const [beamKey, setBeamKey] = useState(0);
  const [tierIdx, setTierIdx] = useState<number | null>(null);

  // form
  const [namaAi, setNamaAi] = useState('');
  const [nomor, setNomor] = useState('');
  const [ewallet, setEwallet] = useState('');
  const [toko, setToko] = useState('');
  const [durasi, setDurasi] = useState('1');

  // processing / pairing
  const [stepIdx, setStepIdx] = useState(0);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const [resending, setResending] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ name: string; total: number; due: number } | null>(null);
  const orderIdRef = useRef<string>('');
  const [waStatus, setWaStatus] = useState<'starting' | 'pairing' | 'linked' | 'closed'>('starting');
  const [waLog, setWaLog] = useState<string[]>([]);
  const [waPhone, setWaPhone] = useState('');
  const finishedRef = useRef(false);

  const firstName = user?.username?.split(' ')[0] || user?.email?.split('@')[0] || 'Bos';

  const pickPlatform = (id: PlatformId) => {
    if (phase === 'beam' || phase === 'processing') return;
    setPlatform(id);
    setTierIdx(null);
    setPhase('beam');
    setBeamKey((k) => k + 1);
    // sinar mengelilingi belah ketupat lalu kembali -> tampilkan paket
    window.setTimeout(() => setPhase('packages'), 2600);
  };

  const months = Math.max(1, Number(durasi) || 1);
  const tier = tierIdx != null ? WA_TIERS[tierIdx] : null;
  const total = tier ? tier.price * months : 0;

  // Sinar keluar dari ikon yang DIPILIH, lalu lanjut searah siklus (WA->Discord->Telegram->Facebook).
  // Segmen i mulai dari sudut i; delay diputar agar segmen dari ikon terpilih animasi duluan.
  const selIdx = Math.max(0, PLATFORMS.findIndex((p) => p.id === platform));
  const beamDelay = (i: number) => `${((i - selIdx + 4) % 4) * 0.62}s`;

  const chooseTier = (i: number) => {
    setTierIdx(i);
    setPhase('form');
    setNotice(null);
  };

  const platformName = () => PLATFORMS.find((p) => p.id === platform)?.name ?? 'WhatsApp';

  // Saldo sudah dipotong & pesanan disimpan saat klik Pesan (lihat runProcessing).
  // Saat WA tertaut, cukup tampilkan layar selesai.
  const finishOrder = useCallback(() => {
    setPhase('done');
  }, []);

  const runProcessing = async () => {
    if (!tier) return;
    if (!user) { setNotice({ ok: false, msg: 'Silakan login dulu untuk memesan.' }); return; }
    if (!namaAi.trim() || !nomor.trim()) { setNotice({ ok: false, msg: 'Nama AI & nomor pemilik wajib diisi.' }); return; }
    if (!ewallet.trim() || !toko.trim()) { setNotice({ ok: false, msg: 'Alamat e-wallet & nama toko wajib diisi (fitur Store).' }); return; }
    if (user.balance < total) { setNotice({ ok: false, msg: `Saldo tidak cukup. Butuh ${formatRupiah(total)}.` }); return; }
    if (!isValidEmail(user.email || '')) { setNotice({ ok: false, msg: 'Email akun tidak valid untuk kirim kode pairing.' }); return; }

    setNotice(null);
    finishedRef.current = false;
    setPhase('processing');
    setStepIdx(0);
    for (let i = 0; i < PROCESS_STEPS.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 850));
      setStepIdx(i + 1);
    }
    // Panggil VPS (via PHP proxy -> tunnel): spawn bot + kirim kode pairing ke email
    const orderId = 'AI' + Date.now();
    orderIdRef.current = orderId;
    const due = Date.now() + months * 30 * 24 * 3600 * 1000;
    setPendingOrder({ name: `Agen AI ${platformName()} ${tier.name}`, total, due });
    const res = await createAgent({
      orderId,
      phone: nomor.replace(/\D/g, ''),
      email: user.email,
      nama: namaAi.trim(),
      paket: `${platformName()} ${tier.name}`,
    });
    if (!res?.ok) {
      setNotice({ ok: false, msg: res?.message || 'Gagal memulai agen di server. Coba lagi.' });
      setPhase('form');
      return;
    }
    // Potong saldo & simpan ke Riwayat Pesanan SAAT pesan dibuat (seperti order Layanan).
    topUp(-total);
    const dueStr = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(due);
    addOrder({
      serviceName: `Agen AI ${platformName()} ${tier.name} · Jatuh tempo ${dueStr}`,
      orderId,
      quantity: months,
      price: total,
      createdAt: Date.now(),
      status: 'proses',
    });
    setWaStatus(res.status || 'pairing');
    setWaPhone(nomor);
    setWaLog([]);
    setPhase('pairing');
  };

  // Polling status agen saat fase pairing -> kalau WA sudah tertaut, selesaikan pesanan.
  useEffect(() => {
    if (phase !== 'pairing' || !orderIdRef.current) return;
    const t = window.setInterval(async () => {
      const r = await getAgentStatus(orderIdRef.current);
      if (r.ok && r.status) {
        setWaStatus(r.status);
        if (Array.isArray(r.log)) setWaLog(r.log);
        if (r.phone) setWaPhone(r.phone);
        if (r.status === 'linked') { window.clearInterval(t); finishOrder(); }
      }
    }, 4000);
    return () => window.clearInterval(t);
  }, [phase, finishOrder]);

  const resendCode = async () => {
    if (!orderIdRef.current) return;
    setResending(true);
    const r = await resendAgentCode(orderIdRef.current);
    setResending(false);
    setNotice(r?.ok ? { ok: true, msg: 'Kode pairing baru sudah dikirim ke email.' } : { ok: false, msg: r?.message || 'Gagal kirim ulang kode.' });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6">
      <Seo title="Sewa Agen AI" description="Sewa Agen AI WhatsApp, Telegram, Facebook & Discord dari Boosteryuk. Pilih paket, atur fitur, langsung aktif." noindex />

      <Reveal>
        <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Kembali
        </button>
      </Reveal>

      {/* Slider (sama seperti halaman Buat Pesanan) */}
      <Reveal delay={40}>
        <div
          className="relative mx-auto aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-[22px] border border-slate-200 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.5)] dark:border-slate-700/60 sm:aspect-[21/8] lg:!aspect-[21/7]"
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
        >
          <div className="flex h-full transition-transform duration-500 ease-out" style={{ width: `${SERVICE_SLIDES.length * 100}%`, transform: `translateX(-${index * (100 / SERVICE_SLIDES.length)}%)` }}>
            {SERVICE_SLIDES.map((s) => (
              <div key={s.url} className="h-full" style={{ width: `${100 / SERVICE_SLIDES.length}%` }}>
                <img src={s.url} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 right-5 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
            {SERVICE_SLIDES.map((s, i) => (
              <button key={s.url} onClick={() => setIndex(i)} aria-label={`Slide ${i + 1}`} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white dark:bg-slate-900' : 'w-1.5 bg-white/50 hover:bg-white/80 dark:bg-slate-900/50'}`} />
            ))}
          </div>
        </div>
      </Reveal>

      {/* Guri Booster card (sama seperti layanan) */}
      <Reveal delay={80} className="mt-8">
        <AiAssistantCard userName={firstName} category="" serviceName={null} hasTarget={false} qty={0} priceText="" ordering={false} orderNotice={null} />
      </Reveal>

      {/* Judul */}
      <Reveal delay={100}>
        <div className="mt-2 text-center">
          <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">Sewa Agen AI</h1>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-slate-500 dark:text-slate-400">Pilih platform untuk melihat paket Agen AI.</p>
        </div>
      </Reveal>

      {/* ===== Belah ketupat + ikon ===== */}
      <Reveal delay={120}>
        <div className="relative mx-auto mt-8 aspect-square w-full max-w-[340px]">
          <svg viewBox="0 0 300 300" className={`h-full w-full ${phase === 'beam' ? 'beam-run' : ''}`} key={beamKey}>
            {/* garis dasar belah ketupat */}
            <polygon points="150,24 276,150 150,276 24,150" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-700" />
            {/* 4 segmen sinar neon (WA->Discord->Telegram->Facebook->WA) */}
            <path d="M24,150 L150,24" pathLength={100} fill="none" strokeWidth="3.5" className="beam-seg" style={{ stroke: '#25D366', color: '#25D366', animationDelay: beamDelay(0) }} />
            <path d="M150,24 L276,150" pathLength={100} fill="none" strokeWidth="3.5" className="beam-seg" style={{ stroke: '#5865F2', color: '#5865F2', animationDelay: beamDelay(1) }} />
            <path d="M276,150 L150,276" pathLength={100} fill="none" strokeWidth="3.5" className="beam-seg" style={{ stroke: '#229ED9', color: '#229ED9', animationDelay: beamDelay(2) }} />
            <path d="M150,276 L24,150" pathLength={100} fill="none" strokeWidth="3.5" className="beam-seg" style={{ stroke: '#1877F2', color: '#1877F2', animationDelay: beamDelay(3) }} />
          </svg>

          {/* ikon di tiap sudut */}
          {PLATFORMS.map((p) => {
            const activeSel = platform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => pickPlatform(p.id)}
                aria-label={p.name}
                className={`absolute flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-white shadow-lg transition-all hover:scale-110 active:scale-95 dark:bg-slate-900 ${CORNER_POS[p.corner]} ${activeSel ? 'scale-110' : ''}`}
                style={{ borderColor: p.color, boxShadow: activeSel ? `0 0 0 3px ${p.color}40, 0 0 18px ${p.color}80` : undefined }}
              >
                <img src={socialIconUrl(p.slug, p.color.replace('#', ''))} alt={p.name} className="h-7 w-7 object-contain" />
              </button>
            );
          })}

          {/* indikator loading di tengah saat beam */}
          {phase === 'beam' && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-slate-400" />
              <p className="mt-1 text-[11px] font-semibold text-slate-400">Memuat paket…</p>
            </div>
          )}
          {phase === 'select' && (
            <p className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 text-center text-[11.5px] font-semibold text-slate-400">Ketuk salah satu ikon</p>
          )}
        </div>
      </Reveal>

      {/* ===== Paket / Form / Proses / Verifikasi ===== */}
      <div className="mt-10">
        {phase === 'packages' && platform === 'whatsapp' && (
          <PackageCarousel onPick={chooseTier} />
        )}
        {phase === 'packages' && platform !== 'whatsapp' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <Bot className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-[14px] font-bold text-slate-900 dark:text-white">Agen AI {platformName()} segera hadir</p>
            <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">Saat ini baru paket WhatsApp yang tersedia. Pilih ikon WhatsApp untuk memesan.</p>
          </div>
        )}

        {phase === 'form' && tier && (
          <OrderForm
            tier={tier}
            platformName={platformName()}
            namaAi={namaAi} setNamaAi={setNamaAi}
            nomor={nomor} setNomor={setNomor}
            ewallet={ewallet} setEwallet={setEwallet}
            toko={toko} setToko={setToko}
            durasi={durasi} setDurasi={setDurasi}
            total={total}
            notice={notice}
            onBack={() => { setPhase('packages'); setNotice(null); }}
            onSubmit={runProcessing}
          />
        )}

        {phase === 'processing' && (
          <ProcessingCard steps={PROCESS_STEPS} active={stepIdx} />
        )}

        {phase === 'pairing' && (
          <PairingCard
            email={user?.email || ''}
            phone={waPhone || nomor}
            status={waStatus}
            log={waLog}
            onResend={resendCode}
            resending={resending}
            notice={notice}
          />
        )}

        {phase === 'done' && pendingOrder && (
          <DoneCard order={pendingOrder} onGo={() => navigate('/riwayat-pesanan')} />
        )}
      </div>
    </div>
  );
}

/* ===================== Sub-komponen ===================== */

function PackageCarousel({ onPick }: { onPick: (i: number) => void }) {
  return (
    <Reveal>
      <p className="mb-3 text-center text-[12px] font-semibold text-slate-500 dark:text-slate-400">Geser untuk lihat paket lain →</p>
      <div className="swipe-row px-1 pb-2">
        {WA_TIERS.map((t, i) => (
          <div key={t.id} className="swipe-item w-[86%] max-w-[340px] sm:w-[340px]">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <img src={socialIconUrl('whatsapp', '25D366')} alt="WhatsApp" className="h-8 w-8" />
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{t.badge}</span>
              </div>
              <h3 className="mt-3 font-display text-xl font-black tracking-tight text-slate-900 dark:text-white">{t.name}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t.desc}</p>
              <p className="mt-3">
                <span className="font-display text-[26px] font-extrabold text-emerald-600 dark:text-emerald-400">{formatRupiah(t.price)}</span>
                <span className="text-[12px] font-semibold text-slate-400"> /bulan</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {WA_FEATURES.map((f, fi) => {
                  const on = fi < t.featureCount;
                  return (
                    <li key={f} className={`flex items-center gap-2 text-[12.5px] ${on ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through dark:text-slate-500'}`}>
                      {on ? <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.6} /> : <X className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" strokeWidth={2.6} />}
                      {f}
                    </li>
                  );
                })}
              </ul>
              <button onClick={() => onPick(i)} className="mt-5 h-11 w-full rounded-xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99]">
                Pilih {t.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function OrderForm(props: {
  tier: Tier; platformName: string;
  namaAi: string; setNamaAi: (v: string) => void;
  nomor: string; setNomor: (v: string) => void;
  ewallet: string; setEwallet: (v: string) => void;
  toko: string; setToko: (v: string) => void;
  durasi: string; setDurasi: (v: string) => void;
  total: number;
  notice: { ok: boolean; msg: string } | null;
  onBack: () => void; onSubmit: () => void;
}) {
  const { tier } = props;
  return (
    <Reveal>
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[17px] font-extrabold text-slate-900 dark:text-white">Form Agen AI {props.platformName} · {tier.name}</h3>
          <button onClick={props.onBack} className="text-[12px] font-bold text-emerald-600 hover:underline dark:text-emerald-400">Ganti paket</button>
        </div>

        <div className="space-y-4">
          <L label="Nama AI">
            <input value={props.namaAi} onChange={(e) => props.setNamaAi(e.target.value)} placeholder="mis. Guri Store Bot" className={inp} />
          </L>
          <L label="Nomor Pemilik (WhatsApp)">
            <input value={props.nomor} onChange={(e) => props.setNomor(e.target.value)} placeholder="628xxxxxxxxxx" inputMode="numeric" className={inp} />
          </L>

          {/* Fitur Store */}
          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
            <p className="mb-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">Fitur Store (Auto Order)</p>
            <div className="space-y-3">
              <L label="Alamat e-wallet (mis. DANA)">
                <input value={props.ewallet} onChange={(e) => props.setEwallet(e.target.value)} placeholder="08xx (nomor DANA)" inputMode="numeric" className={inp} />
              </L>
              <L label="Nama Toko">
                <input value={props.toko} onChange={(e) => props.setToko(e.target.value)} placeholder="Nama toko kamu" className={inp} />
              </L>
            </div>
          </div>

          {/* API Payment Gateway */}
          <L label="API Payment Gateway">
            {tier.paymentGateway ? (
              <div className="flex h-11 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="h-4 w-4" strokeWidth={2.6} /> Aktif otomatis (termasuk paket {tier.name})
              </div>
            ) : (
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13px] font-semibold text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800">
                <X className="h-4 w-4 no-underline" strokeWidth={2.6} /> Tidak termasuk paket ini
              </div>
            )}
          </L>

          <L label="Durasi Sewa (bulan)">
            <input type="number" min={1} value={props.durasi} onChange={(e) => props.setDurasi(e.target.value)} className={inp} />
          </L>

          <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/60 p-3.5 dark:bg-emerald-950/30">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total bayar</p>
            <p className="font-display text-[22px] font-extrabold text-emerald-600 dark:text-emerald-400">{formatRupiah(props.total)}</p>
          </div>

          {props.notice && (
            <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${props.notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40'}`}>
              {props.notice.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              {props.notice.msg}
            </div>
          )}

          <button onClick={props.onSubmit} className="h-12 w-full rounded-xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99]">
            Pesan Sekarang
          </button>
        </div>
      </div>
    </Reveal>
  );
}

function ProcessingCard({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
      <p className="mb-4 font-display text-[16px] font-extrabold text-slate-900 dark:text-white">Memproses pesanan…</p>
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const done = i < active;
          const now = i === active;
          return (
            <li key={s} className="flex items-center gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : now ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-slate-100 text-slate-300 dark:bg-slate-800'}`}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : now ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={`text-[13px] ${done || now ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{s}</span>
            </li>
          );
        })}
      </ol>
      {/* garis loading */}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(active / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

function PairingCard(props: {
  email: string; phone: string;
  status: 'starting' | 'pairing' | 'linked' | 'closed';
  log: string[];
  onResend: () => void; resending: boolean;
  notice: { ok: boolean; msg: string } | null;
}) {
  const waiting = props.status !== 'linked';
  return (
    <Reveal>
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_44px_-26px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Smartphone className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <h3 className="mt-3 font-display text-[17px] font-extrabold text-slate-900 dark:text-white">Kode pairing dikirim ke email</h3>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Cek email <b className="text-slate-700 dark:text-slate-200">{props.email}</b>, lalu tautkan WhatsApp nomor <b className="text-slate-700 dark:text-slate-200">{props.phone}</b>.
        </p>
        <ol className="mx-auto mt-4 max-w-xs space-y-1.5 text-left text-[12.5px] text-slate-600 dark:text-slate-300">
          <li>1. Buka <b>WhatsApp</b> di HP kamu</li>
          <li>2. Menu <b>Perangkat tertaut → Tautkan perangkat</b></li>
          <li>3. Pilih <b>Tautkan dengan nomor telepon</b></li>
          <li>4. Masukkan <b>kode pairing</b> dari email</li>
        </ol>

        <div className={`mt-5 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-bold ${waiting ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
          {waiting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Menunggu WhatsApp tertaut…</> : <><CheckCircle2 className="h-4 w-4" /> WhatsApp tertaut!</>}
        </div>

        {/* Log dari bot di VPS (nomor yang dipakai + progres) */}
        {props.log.length > 0 && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-xl bg-slate-900 p-3 text-left font-mono text-[11px] leading-relaxed text-emerald-300 dark:bg-black">
            {props.log.map((l, i) => (
              <p key={i} className="whitespace-pre-wrap"><span className="text-slate-500">›</span> {l}</p>
            ))}
          </div>
        )}

        {props.notice && (
          <p className={`mt-3 text-[12px] font-semibold ${props.notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{props.notice.msg}</p>
        )}

        <p className="mt-3 text-[11px] text-slate-400">Kode kedaluwarsa? Tekan kirim ulang — sesi lama dihapus & dibuat kode pairing baru.</p>
        <button onClick={props.onResend} disabled={props.resending} className="mt-2 h-11 w-full rounded-xl border border-emerald-300 text-[13px] font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40">
          {props.resending ? 'Mengirim…' : 'Kirim ulang kode pairing'}
        </button>
      </div>
    </Reveal>
  );
}

function DoneCard({ order, onGo }: { order: { name: string; due: number }; onGo: () => void }) {
  const dueStr = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(order.due);
  return (
    <Reveal>
      <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center shadow-sm dark:border-emerald-700/50 dark:from-emerald-950/30 dark:to-slate-900">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <h3 className="mt-3 font-display text-[18px] font-extrabold text-emerald-800 dark:text-emerald-300">Pesanan selesai!</h3>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{order.name} aktif. Jatuh tempo sewa: <b>{dueStr}</b>.</p>
        <button onClick={onGo} className="mt-4 h-11 w-full rounded-xl bg-emerald-600 text-[14px] font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.99]">
          Lihat Riwayat Pesanan
        </button>
      </div>
    </Reveal>
  );
}

const inp = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13.5px] text-slate-800 outline-none transition-colors focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
