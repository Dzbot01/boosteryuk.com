import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Gamepad2, LoaderCircle, Server, ShieldAlert, UserRound } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { tvCekAkun, tvCekStatus, tvPricelist, tvStatus, tvTransaksi } from '../services/tokovoucherApi';
import type { TvPricelistItem } from '../services/tokovoucherApi';
import { TOPUP_GAMES, hargaJual, rupiah, type TopupProduk } from '../data/topupGames';
import { namaWilayahJenis, rapihkanKatalog } from '../lib/topupDisplayName';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { markupTopupPct } from '../lib/panelMarkup';

/** Banner artwork resmi per game untuk kartu judul halaman detail. */
const BANNER_PER_SLUG: Record<string, string> = {
  'free-fire': '/images/topup/free-fire-9th.jpg',
};

/**
 * Halaman detail top up satu game: pilih produk, isi Player ID (+ Server ID bila produk
 * membutuhkannya), lalu transaksi lewat proxy server php-api/tokovoucher.php.
 * Signature MD5(user_code:secret:ref_id) dihitung di server — secret tidak pernah ke browser.
 */
export default function TopupGameDetailPage() {
  const { slug = '' } = useParams();
  const { tenant } = useSiteSettings();
  /** Markup top up game: sistem 2% (atau setelan child panel yang sudah beli akses). */
  const pctTopup = markupTopupPct(tenant);
  /** Harga jual user = modal + markup eksak, lalu format Rupiah. */
  const jual = (n: number) => rupiah(hargaJual(n, pctTopup));
  const game = useMemo(() => {
    const found = TOPUP_GAMES.find((g) => g.slug === slug);
    if (found) return found;
    if (!slug) return null;
    // Game dari katalog live penyedia yang belum ada di konfigurasi repo:
    // sintesis kartu dari slug supaya halaman detail & penarikan katalog tetap jalan.
    const nama = slug
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
    const hue = [...slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
    return { slug, nama, tagline: 'Top up resmi · server ID', hue, produk: [] as TopupProduk[] };
  }, [slug]);
  const { user } = useAuth();

  const [kode, setKode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [serverId, setServerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    refId?: string;
    /** Status penyedia: pending | sukses | gagal | error. */
    status?: string;
    trxId?: string;
    sn?: string;
    /** Cuplikan respons asli penyedia (ditampilkan bila gagal). */
    raw?: string;
    /** Varian panggilan: POST+signature (docs) atau GET+secret (fallback). */
    metode?: string;
    /** Asal jawaban cek status: webhook penyedia atau cek langsung ke API. */
    sumber?: string;
    /** Harga yang DITAGIH server (modal + markup) & sisa saldo setelah pesanan dibuat. */
    harga?: number;
    saldo?: number | null;
    /** Jenis pesanan yang dikenali server dari katalog: topup (game) atau ppob. */
    jenis?: string;
  } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [live, setLive] = useState<{ source: string; items: TvPricelistItem[]; updated_at?: string } | null>(null);
  const [katBusy, setKatBusy] = useState(false);
  const [cekBusy, setCekBusy] = useState(false);
  /** Target scroll otomatis setelah user memilih produk. */
  const konfirmasiRef = useRef<HTMLElement | null>(null);

  /** Pilih produk lalu gulir layar otomatis ke langkah konfirmasi pesanan. */
  const pilihProduk = (k: string) => {
    setKode(k);
    setResult(null);
    requestAnimationFrame(() => konfirmasiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  /**
   * Chip wilayah/server: semua varian (jenis) dari pricelist live — termasuk
   * server luar & Promo yang dulu tampak sebagai "kode aneh". Memilih chip
   * mengganti seluruh pricelist yang ditampilkan (satu produk, banyak wilayah).
   */
  const daftarJenis = useMemo(() => {
    const min: Record<string, number> = {};
    const urutan: string[] = [];
    for (const i of live?.items || []) {
      const j = (i.jenis || '').trim();
      if (!j) continue;
      if (!(j in min)) {
        min[j] = i.harga;
        urutan.push(j);
      } else if (i.harga < min[j]) min[j] = i.harga;
    }
    // Varian termurah di posisi pertama (stabil): daftar chip dibuka dari pilihan
    // paling murah (mis. Free Fire: ID Murah, bukan ID Fast).
    return urutan.sort((a, b) => min[a] - min[b]);
  }, [live]);

  /** Flag wilayah per jenis: chip Indonesia tetap jadi pilihan bawaan walau bukan termurah. */
  const wilayahOkJenis = useMemo(() => {
    const peta: Record<string, boolean> = {};
    for (const i of live?.items || []) {
      const j = (i.jenis || '').trim();
      if (j && !(j in peta)) peta[j] = i.wilayah_ok !== false;
    }
    return peta;
  }, [live]);
  const [jenisAktif, setJenisAktif] = useState('');
  useEffect(() => {
    setJenisAktif('');
  }, [slug]);
  useEffect(() => {
    if (jenisAktif && daftarJenis.includes(jenisAktif)) return;
    // Chip bawaan = varian termurah yang berlaku untuk Indonesia (daftar sudah urut
    // harga minimum menaik), jadi produk murah tampil lebih dulu di semua game.
    setJenisAktif(daftarJenis.find((j) => wilayahOkJenis[j] !== false) || daftarJenis[0] || '');
  }, [live, daftarJenis, wilayahOkJenis, jenisAktif]);

  /** Produk tampil: katalog ASLI dari server bila ada, selain itu snapshot repo. */
  const katalog = useMemo(() => {
    const semua = live?.items?.length
      ? live.items.map((i) => ({ kode: i.kode, nama: i.nama, harga: i.harga, butuhServer: !!i.butuh_server, jenis: i.jenis || '' }))
      : (game?.produk || []).map((pr) => ({ kode: pr.kode, nama: pr.nama, harga: pr.harga, butuhServer: false, jenis: '' }));
    const sumber = jenisAktif ? semua.filter((i) => i.jenis === jenisAktif) : semua;
    // Hanya kode resmi penyedia yang lolos; nama kode ("MFF5", "MLA85") jadi nama
    // manusiawi; pass/membership dipisah ke `paket`, denominasi ke `eceran`;
    // produk kembar lintas kanal resmi digabung ke harga termurah, urut menaik.
    // Selama satu chip wilayah aktif, seluruh item chip itu milik varian yang sama
    // (mis. "Free Fire ID Fast" = kanal FF…, "Free Fire SG" = FFSG…) sehingga kode di
    // luar daftar resmi M tidak dibuang dan token wilayah tidak disaring: tidak ada
    // lagi kartu kembar lintas kanal karena daftarnya sudah ter-scope per chip.
    // Tanpa chip (snapshot repo / sumber datar) aturan lama tetap berlaku ketat.
    return rapihkanKatalog(slug, sumber, {
      semuaWilayah: !!jenisAktif,
      wilayah: jenisAktif.replace(/\s+/g, ' ').trim(),
    });
  }, [live, game, slug, jenisAktif]);
  const produkList = useMemo(() => [...katalog.eceran, ...katalog.paket], [katalog]);

  const produk = useMemo(() => produkList.find((p) => p.kode === kode) || null, [produkList, kode]);

  /**
   * Server ID HANYA berlaku untuk produk Mobile Legends. Free Fire dan game lain
   * tidak memakai kolom ini (field server_id di format_form mereka ber-label kosong).
   */
  const butuhServer = slug === 'mobile-legends';

  /**
   * Cek akun target otomatis (Free Fire & Mobile Legends) lewat apigames.id:
   * skeleton saat memuat; akun tidak ditemukan = skip senyap; kegagalan teknis
   * (belum dikonfigurasi / koneksi / signature / IP ditolak / respons rusak)
   * = tampilkan pesan + respons ASLI supaya mudah didiagnosis.
   */
  const [cekAkun, setCekAkun] = useState<{ loading: boolean; username: string; error?: { message: string; raw?: string } } | null>(null);
  const slugCekAkun = slug === 'free-fire' || slug === 'mobile-legends' ? slug : '';
  useEffect(() => {
    if (!slugCekAkun) {
      setCekAkun(null);
      return;
    }
    const id = playerId.trim();
    if (id.length < 5) {
      setCekAkun(null);
      return;
    }
    setCekAkun({ loading: true, username: '' });
    const t = window.setTimeout(() => {
      tvCekAkun(slugCekAkun, id).then((r) => {
        if (r.ok && r.valid && r.username) {
          setCekAkun({ loading: false, username: r.username });
          return;
        }
        // "Data Not Found" (is_valid=false) bukan error sistem → lewati senyap.
        if (r.reason === 'not_found') {
          setCekAkun(null);
          return;
        }
        setCekAkun({
          loading: false,
          username: '',
          error: { message: r.message || 'Cek akun gagal.', raw: r.raw || '' },
        });
      });
    }, 650);
    return () => window.clearTimeout(t);
  }, [playerId, slugCekAkun]);

  useEffect(() => {
    let alive = true;
    tvStatus().then((r) => { if (alive) setConfigured(r.ok ? r.configured : false); });
    return () => { alive = false; };
  }, []);

  /** Tarik katalog asli (pricelist penyedia / override server) untuk game ini. */
  const loadKatalog = () => {
    if (!game) return;
    setKatBusy(true);
    tvPricelist(game.nama).then((r) => {
      setKatBusy(false);
      setLive(r.ok ? { source: r.source, items: r.items || [], updated_at: r.updated_at } : { source: 'kosong', items: [] });
    });
  };

  // Pilih produk pertama sebagai default begitu katalog siap.
  useEffect(() => {
    setKode(produkList[0]?.kode || '');
    setResult(null);
    setServerId('');
  }, [produkList]);

  useEffect(() => {
    setLive(null);
    loadKatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  if (!game) {
    return (
      <div className="mx-auto max-w-md px-4 pb-32 pt-16 text-center">
        <Gamepad2 className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.6} />
        <p className="mt-3 font-display text-[16px] font-extrabold text-slate-800">Game tidak ditemukan</p>
        <Link to="/topup" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#14143c] px-5 py-2 text-[12.5px] font-bold text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Topup Game
        </Link>
      </div>
    );
  }

  const submit = async () => {
    setResult(null);
    if (!user) {
      setResult({ ok: false, message: 'Silakan login dulu untuk memesan top up.' });
      return;
    }
    if (!produk) {
      setResult({ ok: false, message: 'Pilih produk terlebih dahulu.' });
      return;
    }
    if (playerId.trim().length < 3) {
      setResult({ ok: false, message: 'Player ID wajib diisi dengan benar.' });
      return;
    }
    if (butuhServer && serverId.trim().length < 2) {
      setResult({ ok: false, message: 'Produk ini membutuhkan Server ID.' });
      return;
    }
    setBusy(true);
    // Server ID hanya dikirim untuk Mobile Legends; game lain "" sesuai docs.
    const r = await tvTransaksi({
      player_id: playerId.trim(),
      server_id: butuhServer ? serverId.trim() : '',
      kode_produk: produk.kode,
    });
    setBusy(false);
    setResult({
      ok: !!r.ok,
      status: r.status,
      // Pesanan sekarang diproses server: saldo dipotong + tercatat di Riwayat Pesanan,
      // dan pesanan yang ditolak/gagal dibatalkan otomatis dengan saldo dikembalikan.
      message:
        r.message ||
        (r.ok
          ? 'Transaksi dikirim ke penyedia. Saldo dipotong dan pesanan tercatat di Riwayat Pesanan.'
          : 'Transaksi tidak diproses. Bila saldo sempat terpotong, jumlahnya dikembalikan otomatis.'),
      refId: r.ref_id,
      trxId: r.trx_id,
      sn: r.sn,
      raw: r.raw,
      metode: r.metode,
      harga: typeof r.harga === 'number' ? r.harga : undefined,
      saldo: typeof r.saldo === 'number' ? r.saldo : typeof r.sisa_saldo === 'number' ? r.sisa_saldo : null,
      jenis: r.jenis,
    });
  };

  return (
    <div className="min-h-screen px-4 pb-32 pt-6 md:px-6" style={{ backgroundColor: '#e5e5e7' }}>
      <Seo title={`Top Up ${game.nama}`} description={`Top up ${game.nama} — ${game.tagline}. Proses otomatis lewat penyedia resmi.`} />
      <div className="mx-auto max-w-3xl lg:max-w-6xl">
        <Link to="/topup" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-600 transition hover:text-[#14143c]">
          <ArrowLeft className="h-3.5 w-3.5" /> Topup Game
        </Link>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <div className="min-w-0">
        {/* ============ HEADER GAME ============ */}
        <div
          className="relative mt-3 overflow-hidden rounded-2xl p-6 shadow-sm md:p-8"
          style={
            BANNER_PER_SLUG[slug]
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(9,9,44,0.82) 0%, rgba(9,9,44,0.45) 55%, rgba(9,9,44,0.18) 100%), url(${BANNER_PER_SLUG[slug]})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { background: `linear-gradient(140deg, hsl(${game.hue} 45% 32%) 0%, hsl(${game.hue} 55% 17%) 55%, #14143c 100%)` }
          }
        >
          {BANNER_PER_SLUG[slug] ? null : (
            <Gamepad2 className="absolute -right-6 -top-6 h-40 w-40 text-white/10" strokeWidth={1.2} />
          )}
          <h1 className="font-display text-[24px] font-extrabold tracking-tight text-white md:text-[30px]">{game.nama}</h1>
          <p className="mt-1 text-[13px] text-white/75">{game.tagline} · proses otomatis 1–5 menit</p>
        </div>

        {configured === false && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12.5px] text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span>
              Integrasi penyedia top up belum dikonfigurasi di server. Admin perlu mengisi <code>user_code</code> dan{' '}
              <code>secret</code> pada <code>php-api/tokovoucher_config.php</code>.
            </span>
          </div>
        )}

        {/* ============ DATA AKUN TUJUAN ============ */}
        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:p-5">
          <h2 className="font-display text-[15px] font-extrabold text-slate-900">1 · Data akun tujuan</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                <UserRound className="h-3.5 w-3.5" /> Player ID / User ID
              </span>
              <input
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="contoh: 123456789"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13.5px] outline-none transition focus:border-[#14143c]/40 focus:bg-white focus:ring-2 focus:ring-[#14143c]/15"
              />
              {cekAkun?.loading && (
                <span className="mt-1.5 flex items-center gap-1.5" aria-label="Memeriksa akun tujuan…">
                  <span className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
                  <span className="h-3 w-16 animate-pulse rounded-full bg-slate-100" />
                </span>
              )}
              {cekAkun && !cekAkun.loading && cekAkun.username !== '' && (
                <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                  <span className="truncate">Akun terbaca: {cekAkun.username}</span>
                </span>
              )}
              {cekAkun && !cekAkun.loading && cekAkun.username === '' && cekAkun.error && (
                /* Sesuai permintaan: tampilkan respons penyedia APA ADANYA tanpa teks tambahan. */
                <span className="mt-1.5 block break-all rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-mono text-[10.5px] leading-relaxed text-rose-700">
                  {cekAkun.error.raw || cekAkun.error.message}
                </span>
              )}
            </label>
            {butuhServer && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                  <Server className="h-3.5 w-3.5" /> Server ID
                </span>
                <input
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  placeholder="contoh: 2001"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13.5px] outline-none transition focus:border-[#14143c]/40 focus:bg-white focus:ring-2 focus:ring-[#14143c]/15"
                />
              </label>
            )}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">
            Pastikan ID benar sebelum memesan — top up yang sudah masuk tidak bisa ditarik kembali.
          </p>
        </section>

        {/* ============ PILIH PRODUK ============ */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm md:p-5">
          <h2 className="font-display text-[15px] font-extrabold text-slate-900">2 · Pilih produk</h2>
          {daftarJenis.length > 1 && (
            <div
              className="mt-3 flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800"
              role="tablist"
              aria-label="Pilih wilayah / server produk"
            >
              {daftarJenis.map((j) => (
                <button
                  key={j}
                  type="button"
                  role="tab"
                  aria-selected={jenisAktif === j}
                  onClick={() => setJenisAktif(j)}
                  className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition active:scale-[0.97] ${
                    jenisAktif === j
                      ? 'border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white'
                      : 'border border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {namaWilayahJenis(j)}
                </button>
              ))}
            </div>
          )}
          {live?.source === 'override' && (
            <p className="mt-1 text-[11px] text-slate-500">Katalog dari file override server (pricelist manual).</p>
          )}
          {katBusy && <p className="mt-2 text-[12px] text-slate-500">Memuat katalog asli dari server…</p>}
          {produkList.length === 0 && !katBusy && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] leading-relaxed text-slate-600">
              Katalog produk game ini belum tersedia di server — kami tidak menampilkan kode karangan supaya pesanan
              tidak gagal. Admin dapat menambahkan kode produk asli lewat{' '}
              <code className="rounded bg-white px-1">php-api/tokovoucher_pricelist.php</code> (format ada di file contoh),
              atau pricelist penyedia dibaca otomatis bila katalog game ini tersedia.
              <button
                type="button"
                onClick={loadKatalog}
                className="mt-2.5 block rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[11.5px] font-bold text-slate-700 transition hover:border-slate-400"
              >
                Muat ulang katalog
              </button>
            </div>
          )}
          {katalog.paket.length > 0 && (
            <>
              <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">Paket &amp; Membership</p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {katalog.paket.map((p) => {
                  const on = p.kode === kode;
                  return (
                    <button
                      key={p.kode}
                      type="button"
                      onClick={() => pilihProduk(p.kode)}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
                        on ? 'border-[#14143c] bg-[#14143c]/5 ring-2 ring-[#14143c]/25' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-bold text-slate-800">{p.nama}</span>
                        <span className="block truncate text-[10px] text-slate-500">
                          kode <code className="rounded bg-slate-100 px-1">{p.kode}</code>
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-mono text-[12px] font-bold text-[#14143c]">{jual(p.harga)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {/* Garis pembatas antara modul "Paket & Membership" dan daftar produk pilih produk. */}
          {katalog.paket.length > 0 && (
            <div className="my-3.5 border-t border-slate-200/80 dark:border-slate-700" aria-hidden="true" />
          )}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {katalog.eceran.map((p) => {
              const on = p.kode === kode;
              return (
                <button
                  key={p.kode}
                  type="button"
                  onClick={() => pilihProduk(p.kode)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition ${
                    on ? 'border-[#14143c] bg-[#14143c]/5 ring-2 ring-[#14143c]/25' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>
                    <span className="block text-[13.5px] font-bold text-slate-800">{p.nama}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      kode <code className="rounded bg-slate-100 px-1">{p.kode}</code>
                      {butuhServer ? ' · perlu Server ID' : ''}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-[13px] font-bold text-[#14143c]">{jual(p.harga)}</span>
                </button>
              );
            })}
          </div>
        </section>
        </div>

        {/* Kolom kanan desktop: ringkasan konfirmasi menempel (sticky) saat scroll. */}
        <aside className="min-w-0 lg:sticky lg:top-6">
        {/* ============ RINGKASAN + TOMBOL ============ */}
        <section ref={konfirmasiRef} className="mt-4 scroll-mt-4 rounded-2xl bg-white p-4 shadow-sm md:p-5">
          <h2 className="font-display text-[15px] font-extrabold text-slate-900">3 · Konfirmasi pesanan</h2>
          <dl className="mt-3 space-y-1.5 text-[13px] text-slate-600">
            <div className="flex justify-between"><dt>Game</dt><dd className="font-bold text-slate-800">{game.nama}</dd></div>
            <div className="flex justify-between"><dt>Produk</dt><dd className="font-bold text-slate-800">{produk ? `${produk.nama} (${produk.kode})` : '—'}</dd></div>
            <div className="flex justify-between"><dt>Player ID</dt><dd className="font-mono font-bold text-slate-800">{playerId || '—'}</dd></div>
            {butuhServer && (
              <div className="flex justify-between"><dt>Server ID</dt><dd className="font-mono font-bold text-slate-800">{serverId || '—'}</dd></div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-[14px]">
              <dt className="font-bold text-slate-800">Total</dt>
              <dd className="font-mono font-extrabold text-[#14143c]">{produk ? jual(produk.harga) : '—'}</dd>
            </div>
          </dl>

          {result && (() => {
            const pending = ['pending', 'processing', 'diproses'].includes((result.status || '').toLowerCase());
            const nada = pending
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : result.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-700';
            return (
              <div className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3.5 text-[12.5px] ${nada}`}>
                {result.ok && !pending ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
                ) : pending ? (
                  <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" strokeWidth={2.2} />
                ) : (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
                )}
                <span className="min-w-0 flex-1">
                  {result.message}
                  {result.status ? (
                    <span className="ml-1.5 inline-block rounded-full bg-white/70 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide">
                      {result.status}
                    </span>
                  ) : null}
                  {result.refId ? (
                    <span className="mt-1 block text-[11.5px] leading-relaxed">
                      Ref: <code className="rounded bg-white/70 px-1 font-bold">{result.refId}</code>
                      {result.trxId ? (
                        <>
                          {' '}· TRX: <code className="rounded bg-white/70 px-1 font-bold">{result.trxId}</code>
                        </>
                      ) : null}
                      {result.sn ? (
                        <>
                          {' '}· SN: <code className="rounded bg-white/70 px-1">{result.sn}</code>
                        </>
                      ) : null}
                      {result.sumber ? <span className="opacity-70"> · sumber: {result.sumber}</span> : null}
                      {result.metode ? <span className="opacity-70"> · {result.metode}</span> : null}
                    </span>
                  ) : null}
                  {typeof result.harga === 'number' && result.harga > 0 ? (
                    <span className="mt-1 block text-[11.5px] leading-relaxed">
                      Dibayar: <span className="font-mono font-extrabold">{rupiah(result.harga)}</span>
                      {typeof result.saldo === 'number' ? (
                        <>
                          {' '}· Sisa saldo: <span className="font-mono font-extrabold">{rupiah(result.saldo)}</span>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                  <Link to="/riwayat-pesanan" className="mt-1.5 inline-block text-[11.5px] font-extrabold underline decoration-current/40 underline-offset-2">
                    Lihat di Riwayat Pesanan
                  </Link>
                  {!result.ok && result.raw ? (
                    <code className="mt-1.5 block break-all rounded bg-white/70 px-2 py-1 font-mono text-[10.5px] leading-relaxed">
                      Respons asli penyedia: {result.raw}
                    </code>
                  ) : null}
                  {result.refId ? (
                    <button
                      type="button"
                      disabled={cekBusy}
                      onClick={() => {
                        setCekBusy(true);
                        tvCekStatus(result.refId as string).then((r) => {
                          setCekBusy(false);
                          const st = String(r.status || '');
                          const msg = r.error_msg || r.message || '';
                          setResult({
                            ok: st === 'sukses' || st === 'pending' ? !!r.ok : false,
                            status: st,
                            message: st
                              ? `Status terakhir: ${st.toUpperCase()}${msg ? ` — ${msg}` : ''}.`
                              : r.message || 'Gagal mengecek status.',
                            refId: result.refId,
                            trxId: r.trx_id,
                            sn: r.sn,
                            raw: r.raw,
                            sumber: r.sumber,
                          });
                        });
                      }}
                      className="mt-2 block rounded-full border border-current/30 px-3.5 py-1 text-[11px] font-bold transition hover:bg-white/60 disabled:opacity-60"
                    >
                      {cekBusy ? 'Mengecek…' : 'Cek status pesanan'}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#14143c] text-[14px] font-bold text-white transition hover:bg-[#1f1f52] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
            {busy ? 'Mengirim pesanan…' : 'Beli Sekarang'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Transaksi diproses penyedia; tanda tangan permintaan (signature) dihitung aman di server.
          </p>
        </section>
        </aside>
        </div>
      </div>
    </div>
  );
}
