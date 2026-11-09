import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  Sparkles,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import { QRIS_IMAGE, WHATSAPP_ADMIN, formatRupiah } from '../constants';
import { useTripayChannels } from '../hooks/useTripayChannels';
import type { PaymentChannel } from '../services/tripay';

/** Ikon channel dengan fallback kalau gambar dari Tripay gagal dimuat. */
function ChannelIcon({ src, code }: { src?: string | null; code: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      {src && !failed ? (
        <img src={src} alt={code} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] font-black leading-tight text-slate-400 dark:text-slate-400">{code.slice(0, 4)}</span>
      )}
    </span>
  );
}

/** Ringkasan biaya channel untuk ditampilkan di kartu. */
function feeLabel(channel: PaymentChannel): string {
  const flat = channel.total_fee?.flat ?? 0;
  const percent = channel.total_fee?.percent ?? 0;
  if (flat && percent) return `${formatRupiah(flat)} + ${percent}%`;
  if (flat) return formatRupiah(flat);
  if (percent) return `${percent}%`;
  return 'Gratis';
}

/* ============================================================
   HALAMAN DEPOSIT — daftar channel pembayaran Tripay
   ------------------------------------------------------------
   • GET /merchant/payment-channel → channel aktif, dikelompokkan
     berdasarkan field `group` (Virtual Account, E-Wallet, dst).
   • Ada pencarian + tombol refresh.
   • Bila API gagal (CORS/API Key), dipakai FALLBACK_CHANNELS.
   • Kartu "Bayar Manual" terpisah → /deposit/manual (WhatsApp).
   ============================================================ */
export default function DepositPage() {
  const navigate = useNavigate();
  const { channels, fallback, loading, error } = useTripayChannels();
  const [query, setQuery] = useState('');

  /* Kelompokkan channel berdasarkan `group` sesuai urutan respon API */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? channels.filter(
          (channel) =>
            channel.name.toLowerCase().includes(q) ||
            channel.code.toLowerCase().includes(q) ||
            channel.group.toLowerCase().includes(q),
        )
      : channels;

    const map = new Map<string, PaymentChannel[]>();
    filtered.forEach((channel) => {
      const list = map.get(channel.group) ?? [];
      list.push(channel);
      map.set(channel.group, list);
    });
    return Array.from(map.entries());
  }, [channels, query]);

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6 lg:max-w-5xl">
      {/* Tombol kembali */}
      <Reveal>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {/* Judul */}
      <Reveal delay={30}>
        <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 sm:text-[32px] dark:text-white">Deposit</h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500 dark:text-slate-400">
          Pilih metode pembayaran untuk melakukan deposit saldo.
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-1.5 text-[11.5px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800/60">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            Bonus deposit aktif — 10% untuk QRIS
          </div>
          {fallback ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10.5px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40">
              <TriangleAlert className="h-3 w-3" strokeWidth={2.6} />
              Daftar bawaan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40">
              Tersedia · {channels.length} channel
            </span>
          )}
        </div>
      </Reveal>

      {/* ==========================================================
          MODAL PENCARIAN CHANNEL — diletakkan di atas Bayar Manual
         ========================================================== */}
      <Reveal delay={75}>
        <div className="mt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-400" strokeWidth={2.4} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari channel (QRIS, BNI, Alfamart…)"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-[13px] font-medium text-slate-800 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:text-slate-100 dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
        </div>
      </Reveal>

      {/* ==========================================================
          ALERT ERROR CHANNEL — merah.
          Muncul ketika pengambilan daftar channel gagal / fallback.
         ========================================================== */}
      {error ? (
        <Reveal delay={85}>
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 dark:bg-rose-950/40"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.8} />
            </span>
            <p className="text-[12px] font-semibold leading-relaxed text-rose-700">
              Fitur Deposit Lainnya seperti Qris 2 sedang ditutup sementara, Silakan gunakan Qris 1 untuk pembayaran
              Alternatif.
            </p>
          </div>
        </Reveal>
      ) : null}

      {/* ==========================================================
          MODAL BAYAR MANUAL — redirect WhatsApp admin
          Ikon memakai logo QRIS dari constants.ts
         ========================================================== */}
      <Reveal delay={95}>
        <button
          onClick={() => navigate('/deposit/manual')}
          className="group mt-5 flex w-full items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-5 dark:border-emerald-800/60"
        >
          {/* Ikon QRIS dari constants.ts */}
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <img
              src={QRIS_IMAGE}
              alt="Bayar Manual QRIS"
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-extrabold text-slate-900 dark:text-white">Bayar Manual</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-emerald-700">
                WhatsApp Admin
              </span>
            </span>
            <span className="mt-1 block text-[12px] text-slate-500 dark:text-slate-400">
              Konfirmasi langsung ke admin {WHATSAPP_ADMIN.display}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
        </button>
      </Reveal>

      {/* Skeleton saat memuat */}
      {loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          ))}
          <p className="flex items-center justify-center gap-2 text-[11.5px] font-semibold text-slate-400 dark:text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Memuat channel pembayaran…
          </p>
        </div>
      ) : null}

      {/* ======================================================
          MODAL DAFTAR CHANNEL — dikelompokkan per `group`
         ====================================================== */}
      {!loading && (
        <div className="mt-5 space-y-6">
          {groups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[12.5px] font-medium text-slate-500 dark:text-slate-400 dark:bg-slate-800/60 dark:border-slate-600">
              Tidak ada channel yang cocok dengan “{query}”.
            </p>
          ) : null}

          {groups.map(([groupName, list], groupIndex) => (
            <div key={groupName} className="space-y-3">
              {/* Header grup */}
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2.6} />
                </span>
                <h2 className="text-[13.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">{groupName}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 dark:bg-slate-800">
                  {list.length}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Kartu channel — grid card di desktop */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((channel, index) => (
                <Reveal key={channel.code} delay={groupIndex * 40 + index * 30} className="h-full">
                  <button
                    onClick={() => navigate(`/deposit/${channel.code}`)}
                    className="group flex h-full w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:bg-slate-900 dark:border-slate-700"
                  >
                    <ChannelIcon src={channel.icon_url} code={channel.code} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14.5px] font-extrabold text-slate-900 dark:text-white">{channel.name}</p>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-500 dark:text-slate-400 dark:bg-slate-800">
                          {channel.code}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                        Biaya {feeLabel(channel)}
                        {channel.minimum_amount ? ` · Min ${formatRupiah(channel.minimum_amount)}` : ''}
                      </p>
                      {/* Batas nominal channel */}
                      {channel.maximum_amount ? (
                        <p className="mt-1 text-[10.5px] font-medium text-slate-400 dark:text-slate-400">
                          Maks {formatRupiah(channel.maximum_amount)} · biaya dihitung otomatis
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-400" />
                  </button>
                </Reveal>
              ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
