import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Gamepad2, LoaderCircle, Server, ShieldAlert, UserRound } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { tvCekAkun, tvCekStatus, tvPricelist, tvStatus, tvTransaksi } from '../services/tokovoucherApi';
import type { TvPricelistItem } from '../services/tokovoucherApi';
import { TOPUP_GAMES, hargaJual, rupiah, type TopupProduk } from '../data/topupGames';
import { rapihkanKatalog } from '../lib/topupDisplayName';

/**
 * Halaman detail top up satu game: pilih produk, isi Player ID (+ Server ID bila produk
 * membutuhkannya), lalu transaksi lewat proxy server php-api/tokovoucher.php.
 * Signature MD5(user_code:secret:ref_id) dihitung di server — secret tidak pernah ke browser.
 */
export default function TopupGameDetailPage() {
  const { slug = '' } = useParams();
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
  const [result, setResult] = useState<{ ok: boolean; message: string; refId?: string } | null>(null);
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

  /** Produk tampil: katalog ASLI dari server bila ada, selain itu snapshot repo. */
  const katalog = useMemo(() => {
    const sumber = live?.items?.length
      ? live.items.map((i) => ({ kode: i.kode, nama: i.nama, harga: i.harga, butuhServer: !!i.butuh_server }))
      : game?.produk || [];
    // Hanya kode resmi penyedia yang lolos; nama kode ("MFF5", "MLA85") jadi nama
    // manusiawi; pass/membership dipisah ke `paket`, denominasi ke `eceran`;
    // produk kembar lintas kanal resmi digabung ke harga termurah, urut menaik.
    return rapihkanKatalog(slug, sumber);
  }, [live, game, slug]);
  const produkList = useMemo(() => [...katalog.eceran, ...katalog.paket], [katalog]);

  const produk = useMemo(() => produkList.find((p) => p.kode === kode) || null, [produkList, kode]);

  /**
   * Server ID hanya untuk game yang benar-benar membutuhkannya (mis. Mobile Legends).
   * Free Fire dsb. tidak menampilkan kolom ini: field server_id di format_form
   * penyedia ber-label kosong = tidak dipakai; slug ML jadi pengaman bila data belum lengkap.
   */
  const butuhServer = !!produk?.butuhServer || slug === 'mobile-legends';

  /**
   * Cek akun target otomatis (Free Fire & Mobile Legends) lewat apigames.id:
   * skeleton saat memuat; gagal/tidak ditemukan/kredensial kosong = skip senyap.
   */
  const [cekAkun, setCekAkun] = useState<{ loading: boolean; username: string } | null>(null);
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
        setCekAkun(r.ok && r.valid && r.username ? { loading: false, username: r.username } : null);
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
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke TopUp All Game
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
    const r = await tvTransaksi({ player_id: playerId.trim(), server_id: serverId.trim(), kode_produk: produk.kode });
    setBusy(false);
    setResult({ ok: !!r.ok, message: r.message || (r.ok ? 'Transaksi berhasil dikirim ke penyedia.' : 'Transaksi gagal.'), refId: r.ref_id });
  };

  return (
    <div className="min-h-screen px-4 pb-32 pt-6 md:px-6" style={{ backgroundColor: '#e5e5e7' }}>
      <Seo title={`Top Up ${game.nama}`} description={`Top up ${game.nama} — ${game.tagline}. Proses otomatis lewat penyedia resmi.`} />
      <div className="mx-auto max-w-3xl">
        <Link to="/topup" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-600 transition hover:text-[#14143c]">
          <ArrowLeft className="h-3.5 w-3.5" /> TopUp All Game
        </Link>

        {/* ============ HEADER GAME ============ */}
        <div
          className="relative mt-3 overflow-hidden rounded-2xl p-6 shadow-sm md:p-8"
          style={{ background: `linear-gradient(140deg, hsl(${game.hue} 45% 32%) 0%, hsl(${game.hue} 55% 17%) 55%, #14143c 100%)` }}
        >
          <Gamepad2 className="absolute -right-6 -top-6 h-40 w-40 text-white/10" strokeWidth={1.2} />
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
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
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
                      <span className="whitespace-nowrap font-mono text-[12px] font-bold text-[#14143c]">{rupiah(hargaJual(p.harga))}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
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
                      {p.butuhServer ? ' · perlu Server ID' : ''}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-[13px] font-bold text-[#14143c]">{rupiah(hargaJual(p.harga))}</span>
                </button>
              );
            })}
          </div>
        </section>

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
              <dd className="font-mono font-extrabold text-[#14143c]">{produk ? rupiah(hargaJual(produk.harga)) : '—'}</dd>
            </div>
          </dl>

          {result && (
            <div
              className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3.5 text-[12.5px] ${
                result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />}
              <span>
                {result.message}
                {result.refId ? (
                  <>
                    {' '}Ref: <code className="rounded bg-white/70 px-1 font-bold">{result.refId}</code>
                  </>
                ) : null}
                {result.refId ? (
                  <button
                    type="button"
                    disabled={cekBusy}
                    onClick={() => {
                      setCekBusy(true);
                      tvCekStatus(result.refId as string).then((r) => {
                        setCekBusy(false);
                        const pv = (r.provider || {}) as Record<string, unknown>;
                        const st = pv.status ?? pv.state ?? pv.status_transaksi;
                        const msg = pv.message ?? pv.msg ?? pv.keterangan;
                        setResult({
                          ok: !!r.ok,
                          message: r.ok
                            ? `Status terakhir: ${String(st ?? msg ?? 'diterima penyedia')}${msg && st ? ` — ${String(msg)}` : ''}.`
                            : r.message || 'Gagal mengecek status.',
                          refId: result.refId,
                        });
                      });
                    }}
                    className="mt-1.5 block rounded-full border border-current/30 px-3.5 py-1 text-[11px] font-bold transition hover:bg-white/60 disabled:opacity-60"
                  >
                    {cekBusy ? 'Mengecek…' : 'Cek status pesanan'}
                  </button>
                ) : null}
              </span>
            </div>
          )}

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
      </div>
    </div>
  );
}
