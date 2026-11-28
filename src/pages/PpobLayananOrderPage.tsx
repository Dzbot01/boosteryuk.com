import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  History,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { hargaMarkup, markupPpobPct } from '../lib/panelMarkup';
import {
  tvCekStatus,
  tvLayanan,
  tvLayananProduk,
  tvTransaksi,
  type TvLayananKelompok,
  type TvLayananProdukItem,
} from '../services/tokovoucherApi';
import { ikonLayanan, rupiahTitik } from '../data/ppob';
import { IKON_LAYANAN } from '../lib/ppobIkon';
import { contohTujuan, fieldTujuan, galatTujuan, modeLayanan, slugKategori, type FieldTujuan } from '../lib/ppobOrder';

/** Jumlah produk ditampilkan awal (grup besar punya ratusan varian; sisanya lewat pencarian). */
const BATAS_TAMPIL = 40;

type Hasil = {
  nada: 'sukses' | 'proses' | 'gagal';
  judul: string;
  pesan: string;
  ref?: string;
  trx?: string;
  sn?: string;
  harga?: number;
  saldo?: number | null;
};

/**
 * Halaman order KHUSUS satu layanan PPOB (mis. ACT AXIS, OVO, Token PLN).
 *
 * Satu rute per layanan: /ppob/layanan/:id — `id` adalah id kelompok dari katalog
 * penyedia (slug kategori + nama layanan) atau slug kategori (mis. "aktivasi-perdana")
 * yang membuka pemilih operator lebih dulu. Klik layanan TIDAK lagi membuka daftar
 * harga di halaman grid, melainkan datang ke halaman ini.
 *
 * Field form mengikuti dokumentasi transaksi penyedia: `tujuan` (nomor HP / ID
 * pelanggan / nomor meter / email akun — ikut jenis layanan) + `produk` (kode asli
 * dari katalog). ref_id, member_code & signature dihitung server; secret tidak
 * pernah keluar ke browser. Harga yang ditagih = harga penyedia + markup panel,
 * dihitung ulang di server, dan saldo dipotong server saat pesanan dibuat.
 */
export default function PpobLayananOrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, tenant } = useSiteSettings();
  const namaApp = settings.brandName || 'Boosteryuk';
  const pctPpob = markupPpobPct(tenant);
  /** Harga jual = harga penyedia + markup panel (dihitung ulang server saat order). */
  const jual = (n: number) => rupiahTitik(Math.round(hargaMarkup(n, pctPpob)));
  const saldo = Number(user?.balance) || 0;

  /* ---------- katalog layanan (untuk mengenali :id) ---------- */
  const [kelompok, setKelompok] = useState<TvLayananKelompok[] | null>(null);
  const [memuatKelompok, setMemuatKelompok] = useState(true);
  const [galatKelompok, setGalatKelompok] = useState('');

  const muatKelompok = useCallback(async () => {
    setMemuatKelompok(true);
    setGalatKelompok('');
    const r = await tvLayanan();
    setMemuatKelompok(false);
    if (!r.ok) {
      setKelompok(null);
      setGalatKelompok(r.message || 'Daftar layanan gagal dimuat.');
      return;
    }
    setKelompok(Array.isArray(r.kelompok) ? r.kelompok : []);
  }, []);

  useEffect(() => {
    void muatKelompok();
  }, [muatKelompok, id]);

  const mode = useMemo(() => (kelompok ? modeLayanan(id, kelompok) : null), [id, kelompok]);

  /** Kelompok dalam kategori yang sama (mode kategori = pemilih operator). */
  const satuKategori = useMemo(() => {
    if (!kelompok || mode !== 'kategori') return [];
    const slug = slugKategori(id);
    return kelompok.filter((k) => slugKategori(k.kategori || '') === slug);
  }, [kelompok, mode, id]);

  /** Layanan aktif yang formnya ditampilkan. */
  const [grupPilihan, setGrupPilihan] = useState('');
  const grup = useMemo<TvLayananKelompok | null>(() => {
    if (!kelompok) return null;
    if (mode === 'grup') return kelompok.find((k) => k.id === id) || null;
    if (mode === 'kategori') {
      const pilih = satuKategori.find((k) => k.id === grupPilihan) || satuKategori[0] || null;
      return pilih;
    }
    return null;
  }, [kelompok, mode, id, satuKategori, grupPilihan]);

  /* ---------- produk layanan aktif ---------- */
  const [items, setItems] = useState<TvLayananProdukItem[] | null>(null);
  const [memuatProduk, setMemuatProduk] = useState(false);
  const [galatProduk, setGalatProduk] = useState('');
  const [cari, setCari] = useState('');
  const [lihatSemua, setLihatSemua] = useState(false);
  const [terpilih, setTerpilih] = useState<TvLayananProdukItem | null>(null);

  const muatProduk = useCallback(async (grupId: string) => {
    setMemuatProduk(true);
    setGalatProduk('');
    setItems(null);
    setTerpilih(null);
    setCari('');
    setLihatSemua(false);
    const r = await tvLayananProduk(grupId);
    setMemuatProduk(false);
    if (!r.ok) {
      setGalatProduk(r.message || 'Daftar produk gagal dimuat.');
      return;
    }
    setItems(Array.isArray(r.items) ? r.items : []);
  }, []);

  useEffect(() => {
    if (grup?.id) void muatProduk(grup.id);
  }, [grup?.id, muatProduk]);

  /* ---------- form ---------- */
  const field: FieldTujuan = useMemo(() => fieldTujuan(grup), [grup]);
  const [tujuan, setTujuan] = useState('');
  const [sentuh, setSentuh] = useState(false);
  const galat = sentuh ? galatTujuan(tujuan, field) : '';

  useEffect(() => {
    setTujuan('');
    setSentuh(false);
  }, [grup?.id]);

  const produkTampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const lolos = (items || []).filter(
      (p) => !q || p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q) || (p.jenis || '').toLowerCase().includes(q),
    );
    return lihatSemua || q ? lolos : lolos.slice(0, BATAS_TAMPIL);
  }, [items, cari, lihatSemua]);

  /* ---------- kirim pesanan ---------- */
  const [memesan, setMemesan] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [cek, setCek] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const hargaJual = terpilih ? Math.round(hargaMarkup(terpilih.harga, pctPpob)) : 0;
  const kurangSaldo = !!terpilih && saldo < hargaJual;
  /** Tombol order hidup hanya bila produk dipilih, tujuan valid, dan saldo cukup. */
  const siapPesan = !!terpilih && galatTujuan(tujuan, field) === '' && !kurangSaldo;

  const pesan = async () => {
    setSentuh(true);
    const g = galatTujuan(tujuan, field);
    if (g || !terpilih || !grup) return;
    setMemesan(true);
    setHasil(null);
    const r = await tvTransaksi({ player_id: tujuan.trim(), kode_produk: terpilih.kode });
    setMemesan(false);
    const st = String(r.status || '').toLowerCase();
    const saldoBaru = typeof r.saldo === 'number' ? r.saldo : typeof r.sisa_saldo === 'number' ? r.sisa_saldo : null;
    const pesanTeks = r.message || (r.ok ? 'Transaksi diterima penyedia.' : 'Transaksi tidak dapat diproses.');
    if (r.ok && (st === 'sukses' || st === 'pending' || st === 'proses' || st === '')) {
      setHasil({
        nada: st === 'sukses' ? 'sukses' : 'proses',
        judul: st === 'sukses' ? 'Pesanan berhasil' : 'Pesanan diteruskan ke penyedia',
        pesan: pesanTeks,
        ref: r.ref_id,
        trx: r.trx_id,
        sn: r.sn,
        harga: typeof r.harga === 'number' ? r.harga : hargaJual,
        saldo: saldoBaru,
      });
    } else {
      setHasil({
        nada: 'gagal',
        judul: r.ok ? 'Pesanan ditolak penyedia' : 'Pesanan belum diproses',
        pesan: pesanTeks + (r.error_msg ? ` (${r.error_msg})` : ''),
        ref: r.ref_id,
        harga: typeof r.harga === 'number' ? r.harga : hargaJual,
        saldo: saldoBaru,
      });
    }
  };

  /** Tarik status terbaru (webhook penyedia biasanya sudah melapor lebih dulu). */
  const cekStatus = async () => {
    if (!hasil?.ref) return;
    setCek(true);
    const r = await tvCekStatus(hasil.ref);
    setCek(false);
    const st = String(r.status || '').toLowerCase();
    setHasil((h) =>
      h
        ? {
            ...h,
            nada: st === 'sukses' ? 'sukses' : st === 'gagal' ? 'gagal' : 'proses',
            judul: st === 'sukses' ? 'Pesanan berhasil' : st === 'gagal' ? 'Pesanan gagal — saldo dikembalikan' : 'Masih diproses penyedia',
            pesan: r.message || h.pesan,
            trx: r.trx_id || h.trx,
            sn: r.sn || h.sn,
          }
        : h,
    );
  };

  const salin = async (teks: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1600);
    } catch {
      /* clipboard ditolak browser — abaikan */
    }
  };

  /* ---------- render ---------- */
  const Ikon = IKON_LAYANAN[ikonLayanan(`${grup?.kategori || ''} ${grup?.layanan || ''} ${(grup?.labels || []).join(' ')}`)];

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-[132px] dark:bg-slate-950">
      <Seo
        title={grup ? `Order ${grup.layanan}` : 'Order Layanan PPOB'}
        description={
          grup
            ? `Order ${grup.layanan}${grup.kategori ? ` (${grup.kategori})` : ''} di ${namaApp}: isi data tujuan, pilih produk, bayar dari saldo. Proses otomatis 24 jam.`
            : `Halaman order layanan PPOB ${namaApp}.`
        }
        noindex
      />

      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
        <Link
          to="/ppob/layanan"
          className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-extrabold text-slate-500 transition active:opacity-70 dark:text-slate-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Semua layanan
        </Link>

        {/* ============ JUDUL LAYANAN ============ */}
        <section className="mt-2.5 rounded-[20px] bg-white p-4 shadow-[0_10px_30px_-14px_rgba(37,99,235,0.4)] dark:bg-slate-900 md:p-5">
          {memuatKelompok ? (
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <span className="flex-1">
                <span className="block h-3.5 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <span className="mt-2 block h-2.5 w-56 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              </span>
            </div>
          ) : galatKelompok ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/40">
              <p className="flex items-start gap-2 text-[12.5px] font-bold leading-relaxed text-rose-600 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.3} />
                <span className="break-words">{galatKelompok}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void muatKelompok()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-[12px] font-extrabold text-white transition active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                </button>
                <Link
                  to="/ppob/layanan"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3.5 py-2 text-[12px] font-extrabold text-rose-600 transition active:scale-95 dark:border-rose-800 dark:text-rose-300"
                >
                  Semua layanan
                </Link>
              </div>
            </div>
          ) : !grup ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center dark:border-slate-700">
              <p className="text-[12.5px] font-bold leading-relaxed text-slate-600 dark:text-slate-300">
                Layanan <span className="font-mono">“{id}”</span> tidak ada di katalog penyedia saat ini.
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                Daftar layanan diambil langsung dari server — layanan yang dihentikan penyedia tidak ditampilkan lagi.
              </p>
              <Link
                to="/ppob/layanan"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#3B82F6] px-3.5 py-2 text-[12px] font-extrabold text-white transition active:scale-95"
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Pilih layanan lain
              </Link>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EFF6FF] dark:bg-slate-800">
                {grup.logo ? (
                  <img src={grup.logo} alt="" className="h-full w-full bg-white object-cover" />
                ) : (
                  <Ikon className="h-6 w-6 text-[#2563EB]" strokeWidth={2.1} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-[16.5px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">{grup.layanan}</h1>
                <p className="mt-0.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                  {grup.kategori || 'Layanan PPOB'} · {grup.jumlah} produk · mulai {jual(grup.termurah)}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Halaman order khusus {grup.layanan} di {namaApp}. Saldo: <span className="font-bold text-slate-600 dark:text-slate-300">{rupiahTitik(saldo)}</span>
                  {pctPpob > 0 ? ` · harga termasuk markup panel ${pctPpob}%` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Mode kategori: pilih operator/layanan lebih dulu (mis. Aktivasi Perdana → ACT AXIS). */}
          {grup && mode === 'kategori' && satuKategori.length > 1 && (
            <div className="mt-3.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Pilih layanan</p>
              <div className="ppob-scroll mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
                {satuKategori.map((k) => {
                  const aktif = k.id === grup.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setGrupPilihan(k.id)}
                      data-operator={k.id}
                      aria-pressed={aktif}
                      className={`flex shrink-0 snap-start items-center gap-2 rounded-2xl border px-3 py-2 text-left transition active:scale-95 ${
                        aktif
                          ? 'border-[#3B82F6] bg-[#EFF6FF] dark:bg-blue-950/30'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800">
                        {k.logo ? <img src={k.logo} alt="" className="h-full w-full object-cover" /> : <Ikon className="h-4 w-4 text-[#2563EB]" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-extrabold text-slate-800 dark:text-slate-100">{k.layanan}</span>
                        <span className="block truncate text-[10.5px] font-semibold text-slate-400">{k.jumlah} produk</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {grup && (
          <>
            {/* ============ FORM TUJUAN ============ */}
            <section className="mt-3 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] dark:bg-slate-900 md:p-5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">1. Data tujuan</p>
              <label className="mt-2 block">
                <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{field.label}</span>
                <input
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                  onBlur={() => setSentuh(true)}
                  type={field.tipeInput}
                  inputMode={field.tipeInput === 'tel' ? 'numeric' : 'text'}
                  autoComplete="off"
                  placeholder={field.placeholder}
                  aria-label={field.label}
                  aria-invalid={!!galat}
                  data-tujuan="true"
                  className={`mt-1.5 h-12 w-full rounded-2xl border bg-white px-3.5 font-mono text-[13.5px] font-bold text-slate-800 outline-none transition dark:bg-slate-900 dark:text-slate-100 ${
                    galat ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#3B82F6] dark:border-slate-700'
                  }`}
                />
              </label>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{field.hint}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-slate-400">Contoh</span>
                {field.contoh.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setTujuan(c);
                      setSentuh(true);
                    }}
                    className="rounded-full border border-slate-200 px-2.5 py-1 font-mono text-[10.5px] font-bold text-slate-500 transition active:scale-95 dark:border-slate-700 dark:text-slate-400"
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTujuan(contohTujuan(field))}
                  className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10.5px] font-extrabold text-[#2563EB] transition active:scale-95 dark:bg-blue-950/40"
                >
                  Pakai contoh
                </button>
              </div>
              {galat && (
                <p className="mt-2 flex items-start gap-1.5 text-[11.5px] font-bold text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {galat}
                </p>
              )}
            </section>

            {/* ============ PILIH PRODUK ============ */}
            <section className="mt-3 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] dark:bg-slate-900 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">2. Pilih produk</p>
                {items && items.length > 0 && (
                  <p className="shrink-0 text-[10.5px] font-bold text-slate-400">{items.length} varian</p>
                )}
              </div>

              {items && items.length > BATAS_TAMPIL && (
                <label className="relative mt-2 block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.1} />
                  <input
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder={`Cari varian ${grup.layanan}…`}
                    aria-label="Cari produk"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-[#3B82F6] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              )}

              {memuatProduk && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                  ))}
                </div>
              )}

              {!memuatProduk && galatProduk && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/40">
                  <p className="flex items-start gap-2 text-[12px] font-bold leading-relaxed text-rose-600 dark:text-rose-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.3} />
                    <span className="break-words">{galatProduk}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void muatProduk(grup.id)}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-[11.5px] font-extrabold text-white transition active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                  </button>
                </div>
              )}

              {!memuatProduk && !galatProduk && items && items.length === 0 && (
                <p className="mt-3 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[11.5px] font-semibold leading-relaxed text-slate-500 dark:border-slate-700">
                  Penyedia belum mengirim produk untuk layanan ini. Tidak ada daftar karangan — coba lagi beberapa saat.
                </p>
              )}

              {!memuatProduk && !galatProduk && produkTampil.length > 0 && (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {produkTampil.map((p) => {
                    const aktif = terpilih?.kode === p.kode;
                    return (
                      <li key={p.kode}>
                        <button
                          type="button"
                          onClick={() => {
                            setTerpilih(p);
                            setHasil(null);
                          }}
                          aria-pressed={aktif}
                          data-produk={p.kode}
                          className={`flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                            aktif
                              ? 'border-[3px] border-[#3B82F6] bg-[#EFF6FF] dark:bg-blue-950/30'
                              : 'border-slate-200 bg-white hover:border-[#3B82F6] dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-extrabold leading-snug text-slate-800 dark:text-slate-100">{p.nama}</span>
                            {p.jenis ? <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-slate-400">{p.jenis}</span> : null}
                            <code className="mt-1 block truncate text-[10px] font-semibold text-slate-400">{p.kode}</code>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-mono text-[12.5px] font-extrabold text-[#14143c] dark:text-white">{jual(p.harga)}</span>
                            {aktif ? (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold text-[#2563EB]">
                                <Check className="h-3 w-3" strokeWidth={3} /> Dipilih
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!memuatProduk && !galatProduk && items && items.length > 0 && produkTampil.length === 0 && (
                <p className="mt-3 text-center text-[11.5px] font-semibold text-slate-500">
                  Tidak ada varian yang cocok dengan “{cari}”.
                </p>
              )}

              {!lihatSemua && !cari && items && items.length > BATAS_TAMPIL && (
                <button
                  type="button"
                  onClick={() => setLihatSemua(true)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-[11.5px] font-extrabold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:text-slate-300"
                >
                  Tampilkan semua ({items.length}) <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </section>

            {/* ============ HASIL PESANAN ============ */}
            {hasil && (
              <section
                data-hasil={hasil.nada}
                className={`mt-3 rounded-[20px] border p-4 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] md:p-5 ${
                  hasil.nada === 'gagal'
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40'
                    : hasil.nada === 'sukses'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                      : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
                }`}
              >
                <p
                  className={`flex items-start gap-2 text-[13px] font-extrabold leading-snug ${
                    hasil.nada === 'gagal'
                      ? 'text-rose-700 dark:text-rose-300'
                      : hasil.nada === 'sukses'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {hasil.nada === 'sukses' ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.6} />
                  ) : hasil.nada === 'gagal' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
                  ) : (
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" strokeWidth={2.4} />
                  )}
                  {hasil.judul}
                </p>
                <p
                  className={`mt-1.5 break-words text-[11.5px] font-semibold leading-relaxed ${
                    hasil.nada === 'gagal' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {hasil.pesan}
                </p>

                <dl className="mt-3 grid gap-1.5 text-[11.5px]">
                  {hasil.ref && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-bold text-slate-500 dark:text-slate-400">Ref pesanan</dt>
                      <dd className="flex min-w-0 items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100">
                        <span className="truncate">{hasil.ref}</span>
                        <button type="button" onClick={() => void salin(hasil.ref!)} aria-label="Salin ref pesanan" className="shrink-0 text-slate-400 active:scale-90">
                          {tersalin ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </dd>
                    </div>
                  )}
                  {hasil.trx && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-bold text-slate-500 dark:text-slate-400">ID transaksi</dt>
                      <dd className="truncate font-mono font-bold text-slate-800 dark:text-slate-100">{hasil.trx}</dd>
                    </div>
                  )}
                  {hasil.sn && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 font-bold text-slate-500 dark:text-slate-400">Serial / token</dt>
                      <dd className="min-w-0 break-words text-right font-mono font-bold text-slate-800 dark:text-slate-100">{hasil.sn}</dd>
                    </div>
                  )}
                  {typeof hasil.harga === 'number' && hasil.harga > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-bold text-slate-500 dark:text-slate-400">Dibayar</dt>
                      <dd className="font-mono font-extrabold text-slate-800 dark:text-slate-100">{rupiahTitik(hasil.harga)}</dd>
                    </div>
                  )}
                  {typeof hasil.saldo === 'number' && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="font-bold text-slate-500 dark:text-slate-400">Sisa saldo</dt>
                      <dd className="font-mono font-extrabold text-slate-800 dark:text-slate-100">{rupiahTitik(hasil.saldo)}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void cekStatus()}
                    disabled={cek || !hasil.ref}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[11.5px] font-extrabold text-slate-700 transition active:scale-95 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {cek ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Cek status
                  </button>
                  <Link
                    to="/riwayat-pesanan"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[11.5px] font-extrabold text-slate-700 transition active:scale-95 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <History className="h-3.5 w-3.5" /> Riwayat pesanan
                  </Link>
                  {hasil.nada === 'gagal' && (
                    <button
                      type="button"
                      onClick={() => setHasil(null)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B82F6] px-3.5 py-2 text-[11.5px] font-extrabold text-white transition active:scale-95"
                    >
                      Pesan lagi
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ============ CATATAN KEAMANAN ============ */}
            <section className="mt-3 rounded-[20px] bg-white p-4 dark:bg-slate-900 md:p-5">
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" strokeWidth={2.2} />
                <span>
                  Pesanan dikirim ke penyedia resmi lewat server {namaApp}: harga dihitung ulang di server, saldo dipotong
                  saat pesanan dibuat, dan pesanan yang ditolak penyedia dibatalkan otomatis dengan saldo dikembalikan.
                  Status pesanan tampil di halaman Riwayat Pesanan.
                </span>
              </p>
            </section>
          </>
        )}
      </div>

      {/* ============ BAR BAYAR (sticky) ============ */}
      {grup && !memuatKelompok && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-4 pb-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
          <div className="rounded-2xl bg-white/95 p-3 shadow-[0_-6px_24px_-12px_rgba(15,23,42,0.45)] backdrop-blur dark:bg-slate-900/95">
            {kurangSaldo && (
              <p className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" /> Saldo kurang {rupiahTitik(hargaJual - saldo)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/deposit')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10.5px] font-extrabold text-white transition active:scale-95"
                >
                  <Wallet className="h-3 w-3" /> Isi saldo
                </button>
              </p>
            )}
            <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate font-bold text-slate-600 dark:text-slate-300">
                {terpilih ? `${terpilih.nama} → ${tujuan.trim() || field.placeholder}` : 'Pilih produk terlebih dahulu'}
              </span>
              <span className="shrink-0 font-mono text-[13px] font-extrabold text-[#2563EB]">{terpilih ? jual(terpilih.harga) : '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => void pesan()}
              disabled={!siapPesan || memesan}
              data-pesan="true"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#3B82F6] text-[14px] font-extrabold text-white shadow-md shadow-blue-600/30 transition hover:bg-[#2563EB] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
            >
              {memesan ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {memesan ? 'Memproses…' : 'Bayar & Proses'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .ppob-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .ppob-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
