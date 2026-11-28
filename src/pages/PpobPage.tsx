import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Coins,
  Eye,
  EyeOff,
  Gamepad2,
  Globe,
  Info,
  LayoutGrid,
  Megaphone,
  Plus,
  Receipt,
  Send,
  ShoppingCart,
  Smartphone,
  Wallet,
  Wifi,
} from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  PPOB_BANNERS,
  PPOB_BERITA,
  PPOB_MENU,
  PPOB_PENGUMUMAN,
  PPOB_POINT_FALLBACK,
  rupiahTitik,
  type PpobMenuIcon,
} from '../data/ppob';

/** Peta ikon Menu Service (data berupa nama ikon supaya file data bebas JSX). */
const IKON_MENU: Record<PpobMenuIcon, typeof Smartphone> = {
  smartphone: Smartphone,
  send: Send,
  wifi: Wifi,
  wallet: Wallet,
  gamepad: Gamepad2,
  receipt: Receipt,
  globe: Globe,
  grid: LayoutGrid,
};

/**
 * Beranda PPOB — pulsa, paket data, e-money, dan bayar tagihan.
 * Mobile-first (360–414px), tanpa bottom navbar & tanpa tombol scan QR;
 * padding bawah ±100px supaya konten tidak tertutup bila navbar ditambah nanti.
 * Semua data (nama, saldo, poin, banner, berita) berupa variabel/props dari
 * src/data/ppob.ts + context user, jadi mudah disambungkan ke API.
 */
export default function PpobPage() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const namaApp = settings.brandName || 'Boosteryuk';

  const [lihatSaldo, setLihatSaldo] = useState(false);
  const [slide, setSlide] = useState(0);
  const [catatan, setCatatan] = useState('');
  const scroller = useRef<HTMLDivElement | null>(null);

  const saldo = Number(user?.balance) || 0;
  /** Poin user — bila API belum mengirim, pakai nilai mock di data/ppob.ts. */
  const poin = PPOB_POINT_FALLBACK;

  const bukaLayanan = (id: string, to?: string, pesan?: string) => {
    if (to) {
      setCatatan('');
      navigate(to);
      return;
    }
    const menu = PPOB_MENU.find((m) => m.id === id);
    setCatatan(pesan || menu?.catatan || 'Layanan ini segera hadir.');
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-[100px] dark:bg-slate-950">
      <Seo
        title="PPOB"
        description={`PPOB ${namaApp} — isi pulsa, paket data, top up e-money, voucher streaming & game, sampai bayar tagihan pascabayar, listrik, BPJS, dan internet. Proses otomatis 24 jam, harga tampil jelas sebelum bayar.`}
        noindex
      />


      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
        {/* ============ CARD SALDO (overlap header) ============ */}
        <section className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_10px_30px_-14px_rgba(37,99,235,0.45)] dark:bg-slate-900 md:p-5">
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="pr-3">
              <p className="text-[11px] font-bold text-slate-400">Balance:</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="truncate font-mono text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">
                  {lihatSaldo ? `IDR ${saldo.toLocaleString('id-ID')}` : 'IDR ••••••••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setLihatSaldo((v) => !v)}
                  aria-label={lihatSaldo ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
                  className="shrink-0 text-slate-400 transition active:scale-90 hover:text-slate-600"
                >
                  {lihatSaldo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-0.5 text-[10.5px] text-slate-400">{lihatSaldo ? rupiahTitik(saldo) : 'Ketuk ikon mata untuk melihat saldo'}</p>
            </div>
            <div className="pl-3 text-right">
              <p className="text-[11px] font-bold text-slate-400">Point</p>
              <p className="mt-0.5 flex items-center justify-end gap-1.5 text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">
                <Coins className="h-4 w-4 text-[#F5B73B]" strokeWidth={2.2} />
                {poin}
              </p>
              <Link to="/event/daily-streak" className="mt-0.5 inline-block text-[10.5px] font-bold text-[#2563EB]">
                Tukar poin
              </Link>
            </div>
          </div>

          <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

          {/* 3 aksi cepat */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Transfer', ikon: Send, to: '/payment' },
              { label: 'Top up', ikon: Plus, to: '/deposit' },
              { label: 'Exchange', ikon: ArrowLeftRight, to: '/event/daily-streak' },
            ].map(({ label, ikon: Ikon, to }) => (
              <Link
                key={label}
                to={to}
                className="flex flex-col items-center gap-1 rounded-xl py-2 text-[#2563EB] transition active:scale-95 active:bg-blue-50 dark:active:bg-slate-800"
              >
                <Ikon className="h-[18px] w-[18px]" strokeWidth={2.3} />
                <span className="text-[11px] font-bold">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ============ BANNER INFO BERJALAN ============ */}
        <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-xl border border-blue-200 bg-[#E0EEFF] px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/30">
          <Megaphone className="h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={2.2} />
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="ppob-marquee">
              <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#1D4ED8] dark:text-blue-300">
                {PPOB_PENGUMUMAN} · PPOB {namaApp}: pulsa, data, e-money & tagihan diproses otomatis 24 jam&nbsp;&nbsp;•&nbsp;&nbsp;
              </span>
              <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#1D4ED8] dark:text-blue-300" aria-hidden="true">
                {PPOB_PENGUMUMAN} · PPOB {namaApp}: pulsa, data, e-money & tagihan diproses otomatis 24 jam&nbsp;&nbsp;•&nbsp;&nbsp;
              </span>
            </div>
          </div>
        </div>

        {/* ============ CARD MENU SERVICE ============ */}
        <section className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] dark:bg-slate-900">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6] px-3 py-1 text-[11px] font-extrabold text-white">
            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
            Menu Service
          </span>

          <div className="mt-3.5 grid grid-cols-4 gap-x-2 gap-y-3.5 md:grid-cols-8">
            {PPOB_MENU.map((m) => {
              const Ikon = IKON_MENU[m.icon];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => bukaLayanan(m.id, m.to, m.catatan)}
                  title={m.desc}
                  className="group flex flex-col items-center gap-1.5 transition active:scale-95"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3B82F6] text-white shadow-sm shadow-blue-600/30 transition group-active:bg-[#2563EB]">
                    <Ikon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span className="w-full truncate text-center text-[10.5px] font-bold leading-tight text-slate-600 dark:text-slate-300">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <p aria-live="polite" className={`mt-3 text-[11.5px] font-semibold leading-relaxed text-[#2563EB] ${catatan ? '' : 'hidden'}`}>
            {catatan}
          </p>
        </section>

        {/* ============ BANNER PROMO (carousel swipe) ============ */}
        <section className="mt-4">
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.clientWidth > 0) setSlide(Math.round(el.scrollLeft / el.clientWidth));
            }}
            className="ppob-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
          >
            {PPOB_BANNERS.map((b) => (
              <article
                key={b.id}
                className="relative flex h-[104px] w-full shrink-0 snap-center flex-col justify-center overflow-hidden rounded-2xl px-4 text-white shadow-sm md:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
                style={{ background: b.gradien }}
              >
                <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
                <p className="relative text-[13px] font-extrabold leading-tight">{b.judul}</p>
                <p className="relative mt-0.5 text-[11.5px] font-semibold text-white/85">{b.sub.replace('{APP}', namaApp)}</p>
              </article>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {PPOB_BANNERS.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Banner ${i + 1}`}
                onClick={() => scroller.current?.scrollTo({ left: i * (scroller.current.clientWidth || 0), behavior: 'smooth' })}
                className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-[#2563EB]' : 'w-1.5 bg-slate-300'}`}
              />
            ))}
          </div>
        </section>

        {/* ============ NEWS UPDATES ============ */}
        <section id="berita-ppob" className="mt-5 scroll-mt-28">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">
              <Info className="h-4 w-4 text-[#2563EB]" strokeWidth={2.3} />
              News Updates
            </h2>
            <Link to="/artikel" className="text-[11px] font-extrabold uppercase tracking-wide text-[#2563EB] transition active:opacity-70">
              View All
            </Link>
          </div>

          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {PPOB_BERITA.map((n) => (
              <Link
                key={n.id}
                to={n.to}
                className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.45)] transition active:scale-[0.99] dark:bg-slate-900"
              >
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white"
                  style={{ backgroundColor: n.warna }}
                >
                  {n.kategori}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">{n.judul}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{n.tanggal}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .ppob-marquee { display: flex; width: max-content; animation: ppob-marquee 22s linear infinite; }
        @keyframes ppob-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ppob-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .ppob-scroll::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .ppob-marquee { animation: none; } }
      `}</style>
    </div>
  );
}
