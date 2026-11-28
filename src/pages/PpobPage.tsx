import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Coins, Eye, EyeOff, Info, Megaphone, Plus, Send, ShoppingCart, X } from 'lucide-react';
import { IKON_LAYANAN } from '../lib/ppobIkon';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { hargaMarkup, markupPpobPct } from '../lib/panelMarkup';
import { tvLayanan, type TvLayananKelompok } from '../services/tokovoucherApi';
import {
  PPOB_GRADIEN_BAWAAN,
  PPOB_MENU_LAINNYA,
  PPOB_MENU_LOKAL,
  PPOB_NEWS_DEFAULT,
  PPOB_PENGUMUMAN,
  PPOB_POINT_FALLBACK,
  RUTE_LAYANAN_PPOB,
  ikonLayanan,
  rupiahTitik,
  type PpobBeritaAdmin,
} from '../data/ppob';

/** Rute layanan e-money: tujuan aksi cepat Top up & Transfer di card saldo. */
const RUTE_E_MONEY = `${RUTE_LAYANAN_PPOB}/e-money`;

/** Jumlah layanan live maksimum di card Menu (sisanya lewat tile "Lainnya"). */
const MAKS_LAYANAN_MENU = 6;

/* Peta ikon Menu dipindah ke src/lib/ppobIkon.ts (dipakai juga halaman /ppob/layanan). */

/**
 * Beranda PPOB — pulsa, paket data, e-money, dan bayar tagihan.
 * Mobile-first (360–414px), tanpa bottom navbar & tanpa tombol scan QR;
 * padding bawah ±100px supaya konten tidak tertutup bila navbar ditambah nanti.
 * Semua data (nama, saldo, poin, banner, berita) berupa variabel/props dari
 * src/data/ppob.ts + context user, jadi mudah disambungkan ke API.
 */
export default function PpobPage() {
  const { user } = useAuth();
  const { settings, tenant } = useSiteSettings();
  const navigate = useNavigate();
  const namaApp = settings.brandName || 'Boosteryuk';

  const [lihatSaldo, setLihatSaldo] = useState(false);
  const [slide, setSlide] = useState(0);
  const [catatan, setCatatan] = useState('');
  /** Berita News Update yang sedang dibuka di modal (isinya diatur admin). */
  const [beritaAktif, setBeritaAktif] = useState<PpobBeritaAdmin | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  /* News Update & kartu promo = kiriman admin (Admin Panel → News Update PPOB);
     fallback ke isi bawaan bila admin belum menyimpan versinya sendiri. */
  const berita = useMemo(() => {
    const b = settings.ppobNews?.berita;
    return Array.isArray(b) && b.length ? b : PPOB_NEWS_DEFAULT.berita;
  }, [settings.ppobNews]);
  const kartu = useMemo(() => {
    const k = settings.ppobNews?.kartu;
    return Array.isArray(k) && k.length ? k : PPOB_NEWS_DEFAULT.kartu;
  }, [settings.ppobNews]);
  /** Markup PPOB child panel (0 bila akses belum dibeli / web utama). */
  const pctPpob = markupPpobPct(tenant);

  /* Layanan SELAIN top up game dari endpoint list produk penuh penyedia. */
  const [layanan, setLayanan] = useState<TvLayananKelompok[] | null>(null);
  const [memuatLayanan, setMemuatLayanan] = useState(true);
  const [galatLayanan, setGalatLayanan] = useState('');

  const muatLayanan = useCallback(async () => {
    setMemuatLayanan(true);
    setGalatLayanan('');
    const r = await tvLayanan();
    setMemuatLayanan(false);
    if (!r.ok) {
      // Tidak ada daftar dummy: tampilkan galat asli + cara memulihkan.
      setLayanan(null);
      setGalatLayanan(r.message || 'Daftar layanan gagal dimuat.');
      return;
    }
    setLayanan(Array.isArray(r.kelompok) ? r.kelompok : []);
  }, []);

  useEffect(() => {
    void muatLayanan();
  }, [muatLayanan]);

  const saldo = Number(user?.balance) || 0;
  /** Poin user — bila API belum mengirim, pakai nilai mock di data/ppob.ts. */
  const poin = PPOB_POINT_FALLBACK;

  const bukaLayanan = (id: string, to?: string, pesan?: string) => {
    if (to) {
      setCatatan('');
      navigate(to);
      return;
    }
    const menu = PPOB_MENU_LOKAL.find((m) => m.id === id);
    setCatatan(pesan || menu?.catatan || 'Layanan ini segera hadir.');
  };

  /** Layanan live yang tampil di card Menu (sisanya di halaman "Lainnya"). */
  const layananMenu = (layanan || []).slice(0, MAKS_LAYANAN_MENU);
  const IkonLainnya = IKON_LAYANAN[PPOB_MENU_LAINNYA.icon];

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

          {/* 2 aksi cepat: Top up & Transfer diarahkan ke layanan e-money (Exchange dihapus). */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Transfer', ikon: Send, to: RUTE_E_MONEY },
              { label: 'Top up', ikon: Plus, to: RUTE_E_MONEY },
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

        {/* ============ CARD MENU ============ */}
        <section className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] dark:bg-slate-900">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6] px-3 py-1 text-[11px] font-extrabold text-white">
            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
            Menu
          </span>

          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {/* Layanan milik aplikasi sendiri (halaman PPOB lokal). */}
            {PPOB_MENU_LOKAL.map((m) => {
              const Ikon = IKON_LAYANAN[m.icon];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => bukaLayanan(m.id, m.to, m.catatan)}
                  title={m.desc}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 transition hover:border-blue-200 hover:bg-[#EFF6FF] active:scale-[0.97] dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-900/60"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#3B82F6] text-white shadow-sm shadow-blue-600/30 transition group-active:bg-[#2563EB]">
                    <Ikon className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  <span className="line-clamp-2 w-full text-center text-[11.5px] font-bold leading-tight text-slate-700 dark:text-slate-200">
                    {m.label}
                  </span>
                </button>
              );
            })}

            {/* Layanan ASLI penyedia selain top up game (pulsa/data/e-money/voucher/tagihan). */}
            {memuatLayanan
              ? [0, 1, 2].map((i) => (
                  <span key={`skeleton-${i}`} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="h-14 w-14 animate-pulse rounded-[18px] bg-slate-200 dark:bg-slate-700" />
                    <span className="h-2.5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  </span>
                ))
              : layananMenu.map((l) => {
                  const Ikon = IKON_LAYANAN[ikonLayanan(`${l.kategori} ${l.layanan} ${l.labels.join(' ')}`)];
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => navigate(`${RUTE_LAYANAN_PPOB}/${encodeURIComponent(l.id)}`)}
                      title={`${l.layanan}${l.kategori ? ` — ${l.kategori}` : ''} · ${l.jumlah} produk, mulai ${rupiahTitik(Math.round(hargaMarkup(l.termurah, pctPpob)))}`}
                      data-layanan={l.id}
                      className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 transition hover:border-blue-200 hover:bg-[#EFF6FF] active:scale-[0.97] dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-900/60"
                    >
                      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-[#3B82F6] text-white shadow-sm shadow-blue-600/30 transition group-active:bg-[#2563EB]">
                        {l.logo ? (
                          <img src={l.logo} alt="" className="h-full w-full bg-white object-cover" loading="lazy" />
                        ) : (
                          <Ikon className="h-6 w-6" strokeWidth={2.2} />
                        )}
                      </span>
                      <span className="line-clamp-2 w-full text-center text-[11.5px] font-bold leading-tight text-slate-700 dark:text-slate-200">
                        {l.layanan}
                      </span>
                    </button>
                  );
                })}

            {/* Tile "Lainnya": grid card SEMUA layanan selain top up game. */}
            <button
              type="button"
              onClick={() => navigate(RUTE_LAYANAN_PPOB)}
              title={PPOB_MENU_LAINNYA.desc}
              data-lainnya="true"
              className="group flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#3B82F6] bg-white p-2.5 transition hover:bg-blue-50 active:scale-[0.97] dark:bg-slate-900"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-dashed border-[#3B82F6] bg-white text-[#2563EB] transition group-active:bg-blue-50 dark:bg-slate-900">
                <IkonLainnya className="h-6 w-6" strokeWidth={2.2} />
              </span>
              <span className="line-clamp-2 w-full text-center text-[11.5px] font-bold leading-tight text-slate-700 dark:text-slate-200">
                {PPOB_MENU_LAINNYA.label}
              </span>
            </button>
          </div>

          {/* Galat / kosong: jujur, tanpa daftar layanan karangan. */}
          {galatLayanan && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/40">
              <p className="flex items-start gap-2 text-[11.5px] font-bold leading-relaxed text-rose-600 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.3} />
                <span className="break-words">{galatLayanan}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void muatLayanan()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-extrabold text-white transition active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/', { state: { openLogin: true } })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-1.5 text-[11px] font-extrabold text-rose-600 transition active:scale-95 dark:border-rose-800 dark:text-rose-300"
                >
                  Login ulang
                </button>
              </div>
            </div>
          )}
          {!galatLayanan && !memuatLayanan && layanan && layanan.length === 0 && (
            <p className="mt-3 text-[11.5px] font-semibold leading-relaxed text-slate-500">
              Katalog penyedia belum mengirim layanan selain top up game. Semua layanan yang tersedia tetap bisa dibuka lewat tile Lainnya.
            </p>
          )}
          {memuatLayanan && (
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Memuat layanan dari katalog penyedia…
            </p>
          )}

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
            {kartu.map((b) => (
              <article
                key={b.id}
                data-kartu={b.id}
                className="relative flex h-[112px] w-full shrink-0 snap-center flex-col justify-center overflow-hidden rounded-2xl px-4 text-white shadow-sm md:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
                style={{ background: b.gradien || PPOB_GRADIEN_BAWAAN }}
              >
                <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
                <p className="relative text-[13.5px] font-extrabold leading-tight">{b.title.replace('{APP}', namaApp)}</p>
                <p className="relative mt-0.5 text-[11.5px] font-semibold text-white/85">{b.subtitle.replace('{APP}', namaApp)}</p>
                {b.desc ? <p className="relative mt-1 line-clamp-2 text-[10.5px] font-medium text-white/75">{b.desc.replace('{APP}', namaApp)}</p> : null}
              </article>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {kartu.map((b, i) => (
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
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{berita.length} kabar</span>
          </div>

          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {berita.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setBeritaAktif(n)}
                data-berita={n.id}
                aria-haspopup="dialog"
                className="flex items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_6px_18px_-14px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 active:scale-[0.99] dark:bg-slate-900"
              >
                <span
                  className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white"
                  style={{ backgroundColor: n.warna || '#3B82F6' }}
                >
                  {n.tag || 'INFO'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">{n.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{n.time}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ============ MODAL NEWS UPDATE (isi diatur admin) ============ */}
      {beritaAktif && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setBeritaAktif(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={beritaAktif.title}
            data-modal-berita="true"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white"
                style={{ backgroundColor: beritaAktif.warna || '#3B82F6' }}
              >
                {beritaAktif.tag || 'INFO'}
              </span>
              <button
                type="button"
                onClick={() => setBeritaAktif(null)}
                aria-label="Tutup kabar"
                className="-mr-1 -mt-1 rounded-full p-1.5 text-slate-400 transition active:scale-90 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
            <h3 className="mt-2 text-[15px] font-extrabold leading-snug text-slate-900 dark:text-white">{beritaAktif.title}</h3>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{beritaAktif.time}</p>
            {beritaAktif.image ? (
              <img src={beritaAktif.image} alt="" className="mt-3 w-full rounded-2xl object-cover" />
            ) : null}
            <p className="mt-3 whitespace-pre-line text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              {beritaAktif.desc || 'Belum ada isi kabar untuk berita ini.'}
            </p>
            <button
              type="button"
              onClick={() => setBeritaAktif(null)}
              className="mt-4 h-11 w-full rounded-full bg-[#3B82F6] text-[13px] font-extrabold text-white transition active:scale-[0.99] hover:bg-[#2563EB]"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

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
