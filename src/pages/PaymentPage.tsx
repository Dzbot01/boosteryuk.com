import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Clock3,
  XCircle,
  Info,
  X,
  ChevronDown,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  PAYMENT_INFO_TEXT,
  QRIS_IMAGE,
  WALLETS,
  socialIconUrl,
} from '../constants';

const QUICK_AMOUNTS = [25000, 50000, 100000, 250000];
const MONTHS = ['Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei'];
const SPEND = [82, 120, 96, 175, 148, 210];

const TRANSACTIONS = [
  {
    id: 'TRX-90231',
    title: 'Top up saldo — QRIS',
    amount: 150000,
    type: 'in' as const,
    date: '12 Mei 2025 · 14:22',
    status: 'success' as const,
  },
  {
    id: 'TRX-90118',
    title: 'Booster Followers Instagram · 1.000',
    amount: -38000,
    type: 'out' as const,
    date: '10 Mei 2025 · 09:05',
    status: 'success' as const,
  },
  {
    id: 'TRX-90044',
    title: 'Booster Views TikTok · 5.000',
    amount: -62000,
    type: 'out' as const,
    date: '8 Mei 2025 · 20:41',
    status: 'pending' as const,
  },
  {
    id: 'TRX-89976',
    title: 'Top up saldo — DANA',
    amount: 300000,
    type: 'in' as const,
    date: '4 Mei 2025 · 11:10',
    status: 'success' as const,
  },
  {
    id: 'TRX-89902',
    title: 'Refill Likes YouTube · 500',
    amount: -15000,
    type: 'out' as const,
    date: '1 Mei 2025 · 16:33',
    status: 'failed' as const,
  },
];

function rupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

const statusPill = {
  success: {
    icon: CheckCircle2,
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50',
    label: 'Berhasil',
  },
  pending: {
    icon: Clock3,
    cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/50',
    label: 'Menunggu',
  },
  failed: {
    icon: XCircle,
    cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:ring-rose-800/50',
    label: 'Gagal',
  },
};

export default function PaymentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(50000);
  const [openWallet, setOpenWallet] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dark = document.documentElement.classList.contains('dark');
    const gridColor = dark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.07)';
    const tickColor = dark ? '#94a3b8' : '#64748b';

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: MONTHS,
        datasets: [
          {
            label: 'Pengeluaran',
            data: SPEND,
            borderColor: '#0891b2',
            backgroundColor: (ctx) => {
              const { chart } = ctx;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return 'rgba(8,145,178,0.15)';
              const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, 'rgba(8,145,178,0.32)');
              gradient.addColorStop(1, 'rgba(8,145,178,0)');
              return gradient;
            },
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0891b2',
            pointBorderColor: dark ? '#0f172a' : '#ffffff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: dark ? '#1e293b' : '#0f172a',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: { label: (item) => `Rp ${item.parsed.y}rb` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 11, weight: 600 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            border: { display: false },
            ticks: {
              color: tickColor,
              font: { size: 11, weight: 600 },
              callback: (v) => `${v}rb`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  if (!user) return null;

  const balance = 248000;
  const monthSpend = SPEND[SPEND.length - 1];
  const prevSpend = SPEND[SPEND.length - 2];
  const delta = Math.round(((monthSpend - prevSpend) / prevSpend) * 100);

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied(null), 1600);
      },
      () => {},
    );
  };

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-3">

        <button
          onClick={() => setShowInfo(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-[12.5px] font-bold text-cyan-700 transition-all hover:bg-cyan-100 active:scale-95 dark:border-cyan-800/50 dark:bg-cyan-900/25 dark:text-cyan-400 dark:hover:bg-cyan-900/40"
        >
          <Info className="h-4 w-4" strokeWidth={2.4} />
          Info Pembayaran
        </button>
      </div>

      {/* ---------- Balance ---------- */}
      <div className="relative mt-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-6 shadow-[0_24px_60px_-30px_rgba(8,51,68,0.85)] sm:p-7">
        <div className="bg-dots absolute inset-0 opacity-20" />
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">
              Saldo tersedia
            </p>
            <p className="mt-2 font-display text-[34px] font-extrabold leading-none tracking-tight text-white sm:text-[42px]">
              {rupiah(balance)}
            </p>
            <p className="mt-2 text-[12px] font-semibold text-cyan-100/70">
              Pengeluaran bulan ini {rupiah(monthSpend * 1000)}
              <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 font-bold text-cyan-100">
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20">
            <Wallet className="h-6 w-6" strokeWidth={2} />
          </span>
        </div>
      </div>

      {/* ---------- QRIS ---------- */}
      <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
            <QrCode className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Bayar dengan QRIS
            </h2>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Scan menggunakan aplikasi bank atau e-wallet apa pun
            </p>
          </div>
          <a
            href={QRIS_IMAGE}
            download="qris-boosteryuk.jpeg"
            target="_blank"
            rel="noopener noreferrer"
            title="Unduh QRIS"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-cyan-300 hover:text-cyan-700 active:scale-90 dark:border-slate-700 dark:text-slate-400 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
          >
            <Download className="h-4 w-4" strokeWidth={2.2} />
          </a>
        </div>

        <div className="px-6 py-6">
          {/* nominal */}
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`rounded-xl border px-3.5 py-2 font-mono text-[12.5px] font-bold transition-all duration-200 ${
                  amount === a
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-400'
                    : 'border-slate-200 text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {rupiah(a)}
              </button>
            ))}
          </div>

          {/* qr frame */}
          <div className="relative mx-auto mt-6 w-full max-w-[300px]">
            <span className="absolute -left-1.5 -top-1.5 h-7 w-7 rounded-tl-xl border-l-[3px] border-t-[3px] border-cyan-500" />
            <span className="absolute -right-1.5 -top-1.5 h-7 w-7 rounded-tr-xl border-r-[3px] border-t-[3px] border-cyan-500" />
            <span className="absolute -bottom-1.5 -left-1.5 h-7 w-7 rounded-bl-xl border-b-[3px] border-l-[3px] border-cyan-500" />
            <span className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-br-xl border-b-[3px] border-r-[3px] border-cyan-500" />

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <img
                src={QRIS_IMAGE}
                alt="QRIS Boosteryuk"
                className="h-auto w-full rounded-lg object-contain"
                loading="lazy"
              />
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Nominal yang dibayarkan
            </p>
            <p className="mt-1.5 font-display text-[26px] font-extrabold leading-none text-slate-900 dark:text-white">
              {rupiah(amount)}
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Scan kode di atas, lalu konfirmasi pembayaran ke admin.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- E-wallet ---------- */}
      <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
        <p className="border-b border-slate-100 px-6 py-4 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
          Metode pembayaran lainnya
        </p>

        {WALLETS.map((w) => {
          const open = openWallet === w.id;
          return (
            <div
              key={w.id}
              className="border-b border-slate-100 last:border-b-0 dark:border-slate-700/50"
            >
              <button
                onClick={() => setOpenWallet(open ? null : w.id)}
                className={`flex w-full items-center gap-4 px-6 py-4 text-left transition-colors ${
                  open ? 'bg-cyan-50/60 dark:bg-cyan-900/15' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100 dark:bg-slate-700/60 dark:ring-slate-700">
                  <img
                    src={socialIconUrl(w.slug, w.color)}
                    alt={w.label}
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-slate-900 dark:text-white">
                    {w.label}
                  </span>
                  <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                    Transfer ke nomor di bawah
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 dark:text-slate-400 ${
                    open ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                  }`}
                  strokeWidth={2.4}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-6 pb-5">
                    <div className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-4 dark:border-cyan-800/60 dark:bg-cyan-900/20">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                            Nomor {w.label}
                          </p>
                          <p className="mt-1 font-mono text-[19px] font-extrabold leading-none text-slate-900 dark:text-white">
                            {w.number}
                          </p>
                          <p className="mt-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                            a.n. <span className="font-bold">{w.holder}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => copy(w.number)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-95"
                        >
                          {copied === w.number ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                          ) : (
                            <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />
                          )}
                          {copied === w.number ? 'Tersalin' : 'Salin nomor'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ---------- Chart ---------- */}
      <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 dark:border-slate-700/60 dark:bg-slate-800/80 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Aktivitas pengeluaran
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
              Enam bulan terakhir
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50">
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} />
            Tren naik
          </span>
        </div>
        <div className="mt-5 h-[190px]">
          <canvas ref={canvasRef} />
        </div>
      </section>

      {/* ---------- Transactions ---------- */}
      <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
        <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
          Riwayat transaksi
        </p>

        {TRANSACTIONS.map((t) => {
          const pill = statusPill[t.status];
          return (
            <div
              key={t.id}
              className="flex items-center gap-3.5 border-b border-slate-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  t.type === 'in'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                {t.type === 'in' ? (
                  <ArrowDownLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
                ) : (
                  <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
                  {t.title}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                  {t.id} · {t.date}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p
                  className={`font-mono text-[13.5px] font-bold ${
                    t.type === 'in'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {t.type === 'in' ? '+' : '−'}
                  {rupiah(Math.abs(t.amount))}
                </p>
                <span
                  className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ${pill.cls}`}
                >
                  <pill.icon className="h-2.5 w-2.5" strokeWidth={2.8} />
                  {pill.label}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* ---------- Info modal ---------- */}
      {showInfo && (
        <>
          <div
            className="fixed inset-0 z-50 animate-fade-in bg-slate-900/50 backdrop-blur-[3px]"
            onClick={() => setShowInfo(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0">
            <div className="w-full max-w-sm animate-slide-up overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/30 dark:border-slate-700/60 dark:bg-slate-900">
              <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
                  <Info className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Info Pembayaran
                  </h3>
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
                    Baca sebelum melakukan transfer
                  </p>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  aria-label="Tutup"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 active:scale-90 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <X className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>

              <p className="px-5 py-5 text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                {PAYMENT_INFO_TEXT}
              </p>

              <div className="px-5 pb-5">
                <button
                  onClick={() => {
                    setShowInfo(false);
                    navigate('/hubungi');
                  }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99]"
                >
                  Buka Hubungi Admin
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
