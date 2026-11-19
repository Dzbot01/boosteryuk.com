import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';

/**
 * LinkPreview — kartu pratinjau URL yang muncul DI BAWAH kolom "Target" pada
 * Buat Pesanan. Menampilkan judul, gambar, dan sumber dari tautan target
 * (mirip pratinjau link di aplikasi chat).
 *
 * Aturan tampil:
 * - Target yang bukan URL (mis. sekadar "username") → kartu TIDAK dirender.
 * - Metadata tidak tersedia / jaringan gagal / timeout → kartu TIDAK dirender
 *   (skip, tanpa pesan error).
 * - YouTube memakai thumbnail langsung dari ID video (tanpa perlu metadata).
 *
 * Responsif: thumbnail 64px di mobile → 112px di desktop; teks memakai clamp,
 * sehingga kartu rapi dari layar kecil sampai lebar form.
 */

interface Preview {
  /** URL http(s) tautan yang dipratinjau (sudah dinormalisasi). */
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const FETCH_TIMEOUT_MS = 8000;
const DEBOUNCE_MS = 800;

/** Normalisasi input target menjadi URL http(s); null bila bukan URL. */
export function parseTargetUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  let candidate: string | null = null;
  if (/^https?:\/\//i.test(t)) {
    candidate = t;
  } else if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/\S*)?$/i.test(t)) {
    // Target tanpa skema, mis. "instagram.com/username"
    candidate = `https://${t}`;
  }
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

/** ID video YouTube dari berbagai bentuk URL (watch, youtu.be, shorts, embed). */
function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') || '';
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const m = url.pathname.match(/^\/(?:shorts|embed|v|live)\/([\w-]{11})(?:[/?]|$)/);
    if (m) return m[1];
  }
  return null;
}

/** Ambil metadata generik lewat oEmbed proxy publik (noembed), dengan cadangan microlink. */
async function fetchMetadata(url: string, signal: AbortSignal): Promise<Omit<Preview, 'url'> | null> {
  // 1) noembed — mendukung YouTube, TikTok, Vimeo, Twitter, dsb. CORS: *
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal });
    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>;
      if (j && !j.error) {
        const title = typeof j.title === 'string' && j.title.trim() ? j.title.trim() : null;
        const meta = [j.author_name, j.provider_name].filter((v) => typeof v === 'string' && v).join(' · ') || null;
        const image = typeof j.thumbnail_url === 'string' ? j.thumbnail_url : null;
        const siteName = typeof j.provider_name === 'string' && j.provider_name ? j.provider_name : null;
        if (title || image) return { title, description: meta, image, siteName };
      }
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') throw err;
  }

  // 2) microlink — cadangan bila noembed tidak mengenali URL.
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal });
    if (res.ok) {
      const j = (await res.json()) as {
        status?: string;
        data?: { title?: string | null; description?: string | null; publisher?: string | null; image?: { url?: string } | null };
      };
      if (j?.status === 'success' && j.data) {
        const d = j.data;
        const title = d.title?.trim() || null;
        const description = d.description?.trim() || null;
        const image = d.image?.url || null;
        const siteName = d.publisher?.trim() || null;
        if (title || image || description) return { title, description, image, siteName };
      }
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') throw err;
  }

  return null;
}

function GoogleFavicon({ host }: { host: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      className="h-3.5 w-3.5 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

export default function LinkPreview({ target }: { target: string }) {
  const parsed = useMemo(() => parseTargetUrl(target), [target]);
  const parsedKey = parsed?.href ?? '';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setPreview(null);
    setLoading(false);

    if (!parsed) return;

    // Debounce agar tidak menembak API setiap ketikan.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), FETCH_TIMEOUT_MS);

    const debounce = window.setTimeout(async () => {
      setLoading(true);
      const href = parsed.href;
      const ytId = youtubeVideoId(parsed);
      const directImage = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;
      try {
        const meta = await fetchMetadata(href, controller.signal).catch(() => null);
        const next: Preview = {
          url: href,
          title: meta?.title ?? null,
          description: meta?.description ?? null,
          image: meta?.image ?? directImage,
          siteName: meta?.siteName ?? (ytId ? 'YouTube' : parsed.hostname.replace(/^www\./, '')),
        };
        // Tanpa metadata & tanpa tebakan gambar → tidak ada pratinjau.
        if (!next.title && !next.image && !next.description) return;
        setPreview(next);
      } catch {
        // Abort/timeout → coba tampilkan minimal YouTube (thumbnail langsung).
        if (controller.signal.aborted) {
          // Fallback minimal YouTube walau metadata gagal.
          if (ytId) {
            setPreview({
              url: href,
              title: 'Video YouTube',
              description: null,
              image: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
              siteName: 'YouTube',
            });
          }
          return;
        }
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounce);
      window.clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedKey]);

  if (!parsed) return null;

  // Skeleton ringkas selama metadata dimuat.
  if (loading && !preview) {
    return (
      <div
        aria-busy="true"
        aria-label="Memuat pratinjau tautan"
        className="mt-2 flex w-full items-center gap-3 rounded-xl border p-2.5 sm:p-3"
        style={{ borderColor: 'var(--by-line)', background: 'var(--by-surface)' }}
      >
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-slate-200 sm:h-20 sm:w-28 dark:bg-slate-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="hidden h-2.5 w-3/5 animate-pulse rounded bg-slate-200 sm:block dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const showImage = !!preview.image && !imageFailed;
  const hasText = !!(preview.title || preview.description);
  if (!showImage && !hasText) return null;

  const host = (() => {
    try { return new URL(preview.url).hostname.replace(/^www\./, ''); } catch { return preview.url; }
  })();

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer noopener"
      title="Buka tautan target"
      className="group mt-2 flex w-full items-center gap-3 overflow-hidden rounded-xl border p-2.5 no-underline transition-shadow duration-200 hover:shadow-[0_10px_28px_-12px_rgba(23,32,51,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20 sm:gap-3.5 sm:p-3"
      style={{ borderColor: 'var(--by-line)', background: 'var(--by-surface)' }}
    >
      {showImage && (
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-20 sm:w-28 dark:bg-slate-800">
          <img
            src={preview.image!}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          <Link2 className="h-3 w-3 shrink-0" strokeWidth={2.4} aria-hidden />
          <GoogleFavicon host={host} />
          <span className="min-w-0 truncate">{preview.siteName || host}</span>
          <ExternalLink
            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-90"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        {preview.title && (
          <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-slate-800 sm:text-[12.5px] dark:text-slate-100">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="line-clamp-1 text-[10.5px] leading-snug text-slate-500 sm:line-clamp-2 sm:text-[11px] dark:text-slate-400">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
