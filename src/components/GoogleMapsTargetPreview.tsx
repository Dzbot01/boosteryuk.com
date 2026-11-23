import { useEffect, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { MAIN_API } from '../lib/apiBase';
import { googleMapsKind, googleMapsPreview, type MapPreview } from '../lib/googleMapsPreview';

export default function GoogleMapsTargetPreview({ url }: { url: URL }) {
  const href = url.href;
  const [resolved, setResolved] = useState<{href: string; map: MapPreview} | null>(null);
  useEffect(() => {
    if (googleMapsKind(url) !== 'short') return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${MAIN_API}/maps_preview.php`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: href.replace(/^http:/, 'https:')}), signal: controller.signal});
        const result = await response.json();
        if (!response.ok || !result.ok || typeof result.url !== 'string' || controller.signal.aborted) return;
        const target = new URL(result.url);
        if (googleMapsKind(target) === 'map') setResolved({href, map: googleMapsPreview(target)});
      } catch { /* Keep the direct Google Maps link when resolution/network fails. */ }
      finally { window.clearTimeout(timeout); }
    }, 800);
    return () => {window.clearTimeout(timer);window.clearTimeout(timeout);controller.abort();};
    // href is the normalized URL identity; stale results are never rendered for another target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);
  const map = resolved?.href === href ? resolved.map : googleMapsPreview(url);
  return <section aria-label="Pratinjau Google Maps" className="mt-2 overflow-hidden rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-800" style={{borderColor: 'var(--by-line)'}}>
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 p-3 text-sm text-slate-800 dark:text-slate-100">
      <MapPin className="h-5 w-5 shrink-0 text-cyan-500" aria-hidden />
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">Google Maps</span><span className="line-clamp-2 font-semibold">{map.title}</span></span>
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
    </a>
    {map.embedUrl ? <iframe key={map.embedUrl} title={`Peta ${map.title}`} src={map.embedUrl} className="h-56 w-full border-0 sm:h-72" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /> : <p className="px-3 pb-3 text-xs text-slate-500 dark:text-slate-400">Peta belum dapat ditampilkan. Buka tautan untuk melihat lokasi di Google Maps.</p>}
    {map.embedUrl && <p className="px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400">Jika peta tidak dimuat, buka tautan Google Maps di atas. Pastikan lokasi sesuai sebelum memesan.</p>}
  </section>;
}
