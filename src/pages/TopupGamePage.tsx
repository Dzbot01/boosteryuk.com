import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, RefreshCw, Search, SearchX, ShieldAlert } from 'lucide-react';
import Seo from '../components/Seo';
import { filterByName } from '../data/topupGames';
import { tvKatalog, type TvKatalogGroup } from '../services/tokovoucherApi';

/**
 * Marketplace "Topup Game": tab kategori + pencarian realtime + grid kartu game.
 * Pola latar = watermark gamepad pixel-art (SVG inline, sedikit lebih gelap dari #E5E5E7).
 */
const PATTERN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>" +
  "<g fill='#c9c9ce' fill-opacity='0.5'>" +
  "<rect x='20' y='24' width='24' height='14' rx='7'/>" +
  "<rect x='10' y='28' width='8' height='5' rx='2'/>" +
  "<rect x='46' y='28' width='8' height='5' rx='2'/>" +
  "<circle cx='27' cy='30' r='2'/><circle cx='37' cy='30' r='2'/>" +
  "<rect x='24' y='18' width='4' height='4'/><rect x='36' y='18' width='4' height='4'/>" +
  '</g></svg>';
const PATTERN_URL = `url("data:image/svg+xml,${encodeURIComponent(PATTERN_SVG)}")`;

interface CardItem {
  slug: string;
  nama: string;
  sub: string;
  /** Ada bila item ini game topup (punya halaman detail & produk). */
  game?: boolean;
  /** Logo resmi game dari penyedia; gagal dimuat = placeholder ikon gamepad netral. */
  logo?: string;
}

/**
 * Thumbnail kartu: LANGSUNG image resmi dari API penyedia tanpa card background
 * berwarna — gambar memenuhi kotak persegi bersudut lembut, zoom halus saat hover.
 */
function GameThumb({ item }: { item: CardItem }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
      {item.logo ? (
        <img
          src={item.logo}
          alt={item.nama}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const g = e.currentTarget.nextElementSibling;
            if (g) g.classList.remove('hidden');
          }}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
        />
      ) : null}
      <Gamepad2
        className={`absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-300 ${item.logo ? 'hidden' : ''}`}
        strokeWidth={1.4}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl">
      <div className="aspect-square w-full rounded-2xl bg-slate-200/80" />
      <div className="mx-auto mt-3 h-3.5 w-3/4 rounded-full bg-slate-200/70" />
      <div className="mx-auto mt-2 h-3 w-1/2 rounded-full bg-slate-200/50" />
    </div>
  );
}

export default function TopupGamePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<TvKatalogGroup[]>([]);
  /** Server PHP bermasalah (error/non-JSON): TIDAK ada fallback — wajib login ulang. */
  const [galat, setGalat] = useState(false);
  const navigate = useNavigate();

  /** Grid kartu game LIVE dari API katalog penyedia (kategori Topup, server ID Indonesia). */
  const muatKatalog = useCallback(() => {
    setLoading(true);
    setGalat(false);
    let alive = true;
    tvKatalog().then((r) => {
      if (!alive) return;
      if (r.ok && Array.isArray(r.groups)) setGroups(r.groups);
      else setGalat(true);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => muatKatalog(), [muatKatalog]);

  const items = useMemo<CardItem[]>(
    () =>
      groups.map((g) => ({
        slug: g.slug,
        nama: g.game,
        sub: `${g.jumlah} produk · server ID (Indonesia)`,
        game: true,
        logo: g.logo || undefined,
      })),
    [groups],
  );

  const shown = useMemo(() => filterByName(items, query), [items, query]);

  return (
    <div
      className="min-h-screen px-4 pb-24 pt-6 md:px-6 xl:px-10"
      style={{ backgroundColor: '#e5e5e7', backgroundImage: PATTERN_URL }}
    >
      <Seo title="Topup Game" description="Marketplace top up game: katalog live dari penyedia resmi, hanya server ID (Indonesia), proses otomatis." />
      <div className="mx-auto max-w-[1900px]">
        <header className="mb-5">
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#14143c] sm:text-[26px]">Topup Game</h1>
          <p className="mt-1 text-[13px] text-slate-600">
            Top up game favorit — katalog live penyedia, hanya server ID (Indonesia), proses otomatis.
          </p>
        </header>

        {/* ============ PENCARIAN ============ */}
        <label className="relative block w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari game…"
            className="h-[46px] w-full rounded-full border border-slate-200 bg-white pl-11 pr-5 text-[13.5px] text-slate-800 shadow-sm outline-none transition focus:border-[#14143c]/40 focus:ring-2 focus:ring-[#14143c]/15 md:h-[54px] md:text-[14px]"
          />
        </label>

        {/* ============ ERROR SERVER: wajib login ulang (tanpa fallback) ============ */}
        {galat && !loading && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <ShieldAlert className="mx-auto h-10 w-10 text-rose-400" strokeWidth={1.7} />
            <p className="mt-3 font-display text-[16px] font-extrabold text-slate-800">Server tidak dapat dihubungi</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
              Katalog layanan top up gagal dimuat dari server. Silakan login ulang untuk melanjutkan — sesi anda
              mungkin sudah berakhir.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/', { state: { openLogin: true } })}
                className="rounded-full bg-[#14143c] px-5 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#1f1f52]"
              >
                Login ulang
              </button>
              <button
                type="button"
                onClick={muatKatalog}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[12.5px] font-bold text-slate-700 transition hover:border-slate-400"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} /> Coba lagi
              </button>
            </div>
          </div>
        )}

        {/* ============ GRID KARTU ============ */}
        <div className={`mt-6 grid grid-cols-3 items-stretch gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 xl:gap-6 2xl:grid-cols-8 ${galat ? 'hidden' : ''}`}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : shown.map((it) => {
                const body = (
                  <>
                    <GameThumb item={it} />
                    <p className="mt-2.5 px-1 text-center text-[13px] leading-snug text-slate-800 md:text-[18px]">{it.nama}</p>
                  </>
                );
                const cls =
                  'group block rounded-2xl transition-all duration-200 hover:-translate-y-1 focus-visible:-translate-y-1';
                return it.game ? (
                  <Link key={it.slug} to={`/topup/${it.slug}`} className={cls} title={it.sub}>
                    {body}
                  </Link>
                ) : (
                  <div key={it.slug} className={cls} title={it.sub}>
                    {body}
                  </div>
                );
              })}
        </div>

        {/* ============ STATE KOSONG ============ */}
        {!loading && !galat && shown.length === 0 && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <SearchX className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.6} />
            <p className="mt-3 font-display text-[16px] font-extrabold text-slate-800">Game tidak ditemukan</p>
            <p className="mt-1.5 text-[13px] text-slate-500">
              {query ? 'Coba kata kunci lain.' : 'Katalog penyedia belum tersedia untuk ditampilkan.'}
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 rounded-full bg-[#14143c] px-5 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#1f1f52]"
            >
              Hapus pencarian
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
