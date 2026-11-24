import { useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin, Layers } from 'lucide-react';
import { brandForCategory, brandIconUrl } from '../constants';
import { useAuth } from '../context/AuthContext';

/** Key sessionStorage untuk melanjutkan step order sesudah login Google. */
export const PENDING_ORDER_PATH_KEY = 'by_pending_order_path';
/** Event pembuka modal login (didengarkan HomePage yang memiliki AuthModal). */
export const OPEN_LOGIN_EVENT = 'by-open-login';

/** Kategori statis kolom Top Service (tanpa panggilan API berulang). */
export const GM_SHOWCASE_CATEGORY = 'Google Map Review';
/** Layanan statis kolom Top Service persis seperti referensi pemilik web. */
export const GM_SHOWCASE_SERVICE = {
  name: 'Google Buzzer Indonesia Map Reviews [ 5 ⭐ ] [ Custom Comments Reviews ] [ Max 1K ]',
  priceLabel: 'Rp 1.331.000 / 1rb',
  min: 10,
  max: 1000,
};

/**
 * Dua kolom polos "Kategori" dan "Layanan" Google Maps Review, disusun ATAS-BAWAH
 * persis di bawah gambar Top Service (tanpa card) dan sebelum video player.
 * Isinya HARDCODE (tidak memanggil API berulang kali); katalog asli baru dimuat
 * saat tombol keranjang diklik dan user diarahkan ke halaman order (/layanan),
 * lalu layanan yang sama dipilih otomatis lewat parameter ?service=<nama>.
 * Tamu diarahkan ke modal login dulu, lalu step order dilanjutkan otomatis setelah login.
 */
export default function GoogleMapsReviewColumns() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCart = () => {
    const path = `/layanan?service=${encodeURIComponent(GM_SHOWCASE_SERVICE.name)}`;
    if (!user) {
      try { sessionStorage.setItem(PENDING_ORDER_PATH_KEY, path); } catch { /* privat mode */ }
      window.dispatchEvent(new CustomEvent(OPEN_LOGIN_EVENT));
      return;
    }
    navigate(path);
  };

  const brand = brandForCategory(GM_SHOWCASE_CATEGORY);

  return (
    <div className="mt-5 flex flex-col gap-6">
      <section aria-label="Kategori Google Maps Review">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">
          <Layers className="h-4 w-4 text-cyan-500" strokeWidth={2.2} />
          Kategori
        </h3>
        <ul className="mt-2.5 space-y-1.5">
          <li className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            {brand ? (
              <img src={brandIconUrl(brand)} alt="" className="h-4 w-4 shrink-0 object-contain" loading="lazy" />
            ) : (
              <MapPin className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={2.2} />
            )}
            {GM_SHOWCASE_CATEGORY}
          </li>
        </ul>
      </section>

      <section aria-label="Layanan Google Maps Review">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">
          <ShoppingCart className="h-4 w-4 text-emerald-500" strokeWidth={2.2} />
          Layanan
        </h3>
        <ul className="mt-1.5 divide-y divide-slate-200/70 dark:divide-slate-700/60">
          <li className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{GM_SHOWCASE_SERVICE.name}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {GM_SHOWCASE_SERVICE.priceLabel} · min {GM_SHOWCASE_SERVICE.min} – max {GM_SHOWCASE_SERVICE.max}
              </span>
            </span>
            <button
              type="button"
              onClick={handleCart}
              aria-label={`Pesan ${GM_SHOWCASE_SERVICE.name}`}
              title="Pesan layanan ini"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white transition-colors hover:bg-emerald-600 active:scale-95"
            >
              <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
