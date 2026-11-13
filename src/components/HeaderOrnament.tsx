import { useSiteSettings } from '../context/SiteSettingsContext';
import { ORNAMENT_ASSETS, findOrnamentSet } from '../data/headerOrnaments';

/**
 * Aksesoris menggantung tepat di bawah header (fixed). Murni dekorasi:
 * pointer-events-none + aria-hidden, sehingga tidak menghalangi klik/scroll.
 */
export default function HeaderOrnament() {
  const { settings } = useSiteSettings();
  const set = findOrnamentSet(settings.headerOrnament);
  if (!set) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[60px] z-[29] h-0">
      {set.items.map((it, i) => (
        <div
          key={i}
          className={`by-sway absolute top-0 flex -translate-x-1/2 flex-col items-center ${it.desktopOnly ? 'hidden md:flex' : ''}`}
          style={{ left: `${it.x}%`, animationDelay: `${(i % 4) * -0.7}s` }}
        >
          <span className="block w-px bg-amber-700/50 dark:bg-amber-300/40" style={{ height: it.len }} />
          <img src={ORNAMENT_ASSETS[it.asset].src} alt="" width={it.size} className="-mt-px select-none drop-shadow" draggable={false} />
        </div>
      ))}
    </div>
  );
}
