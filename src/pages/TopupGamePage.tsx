import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Gamepad2, Search, SearchX } from 'lucide-react';
import Seo from '../components/Seo';
import {
  TOPUP_CATEGORIES, TOPUP_GAMES, TOPUP_OTHER, filterByName, slugify,
  type TopupCategoryId,
} from '../data/topupGames';

/**
 * Marketplace "TopUp All Game": tab kategori + pencarian realtime + grid kartu game.
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
  hue: number;
  /** Ada bila item ini game topup (punya halaman detail & produk). */
  game?: boolean;
}

function GameThumb({ item, big = false }: { item: CardItem; big?: boolean }) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-xl ${big ? 'rounded-2xl' : ''}`}
      style={{ background: `linear-gradient(155deg, hsl(${item.hue} 42% 34%) 0%, hsl(${item.hue} 55% 18%) 62%, #14143c 100%)` }}
    >
      {/* watermark ikon di tengah thumbnail */}
      <Gamepad2 className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25" strokeWidth={1.4} />
      {/* overlay gradasi navy di bawah thumbnail: tempat logo/nama game */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14143c] via-[#14143c]/70 to-transparent px-2 pb-2 pt-8">
        <p className="truncate text-center font-display text-[11px] font-extrabold uppercase italic tracking-wide text-white md:text-[13px]">
          {item.nama}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-3 shadow-sm">
      <div className="aspect-square w-full rounded-xl bg-slate-200" />
      <div className="mx-auto mt-3 h-3.5 w-3/4 rounded-full bg-slate-200" />
      <div className="mx-auto mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
    </div>
  );
}

export default function TopupGamePage() {
  const [category, setCategory] = useState<TopupCategoryId>('Topup');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const tabRowRef = useRef<HTMLDivElement | null>(null);

  // Skeleton singkat setiap ganti kategori / pertama buka.
  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(t);
  }, [category]);

  const items = useMemo<CardItem[]>(() => {
    if (category === 'Topup') {
      return TOPUP_GAMES.map((g) => ({ slug: g.slug, nama: g.nama, sub: g.tagline, hue: g.hue, game: true }));
    }
    return TOPUP_OTHER[category].map((o) => ({ slug: o.slug, nama: o.nama, sub: o.sub, hue: o.hue }));
  }, [category]);

  const shown = useMemo(() => filterByName(items, query), [items, query]);

  /** Geser baris tab ke kanan (tombol panah). */
  const scrollTabs = () => tabRowRef.current?.scrollBy({ left: 260, behavior: 'smooth' });

  return (
    <div
      className="min-h-screen px-4 pb-24 pt-6 md:px-6 xl:px-10"
      style={{ backgroundColor: '#e5e5e7', backgroundImage: PATTERN_URL }}
    >
      <Seo title="TopUp All Game" description="Marketplace top up game & produk digital: voucher, pulsa, token listrik, paket data, dan lainnya." />
      <div className="mx-auto max-w-[1900px]">
        <header className="mb-5">
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#14143c] sm:text-[26px]">TopUp All Game</h1>
          <p className="mt-1 text-[13px] text-slate-600">
            Top up game favorit & produk digital — proses otomatis, harga bersahabat.
          </p>
        </header>

        {/* ============ BARIS TAB KATEGORI + PENCARIAN ============ */}
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative flex-1">
            <div
              ref={tabRowRef}
              className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {TOPUP_CATEGORIES.map((c) => {
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`h-[46px] shrink-0 whitespace-nowrap rounded-full px-6 text-[13.5px] shadow-sm transition-colors duration-200 md:h-[54px] md:text-[14.5px] ${
                      active ? 'bg-[#14143c] font-bold text-white' : 'bg-white font-medium text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {/* fade + tombol panah: penanda masih ada tab lain di kanan */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#e5e5e7] to-transparent" />
            <button
              type="button"
              onClick={scrollTabs}
              aria-label="Geser daftar kategori ke kanan"
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>

          {/* Pencarian: di kanan baris tab (desktop), baris sendiri (mobile) */}
          <label className="relative block w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari game di semua kategori..."
              className="h-[46px] w-full rounded-full border border-slate-200 bg-white pl-11 pr-5 text-[13.5px] text-slate-800 shadow-sm outline-none transition focus:border-[#14143c]/40 focus:ring-2 focus:ring-[#14143c]/15 md:h-[54px] md:text-[14px]"
            />
          </label>
        </div>

        {/* ============ GRID KARTU ============ */}
        <div className="mt-6 grid grid-cols-3 items-stretch gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 xl:gap-6 2xl:grid-cols-8">
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
                  'group block rounded-2xl bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:-translate-y-1 focus-visible:shadow-lg';
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
        {!loading && shown.length === 0 && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <SearchX className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.6} />
            <p className="mt-3 font-display text-[16px] font-extrabold text-slate-800">Game tidak ditemukan</p>
            <p className="mt-1.5 text-[13px] text-slate-500">
              Coba kata kunci lain, atau pilih kategori <b>{category}</b> tanpa pencarian.
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

        <p className="mt-8 text-center text-[11.5px] text-slate-500">
          Halaman detail: <code className="rounded bg-white/70 px-1.5 py-0.5">/topup/&#123;slug&#125;</code> — mis.{' '}
          <Link className="font-bold text-[#14143c] underline" to={`/topup/${TOPUP_GAMES[0].slug}`}>
            /topup/{slugify(TOPUP_GAMES[0].nama)}
          </Link>
        </p>
      </div>
    </div>
  );
}
