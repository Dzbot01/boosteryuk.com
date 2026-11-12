// Deteksi deploy baru agar pengunjung tidak terjebak di versi/cache lama.
// - Bandingkan __BUILD_ID__ (versi yang sedang jalan) dengan /version.json (tanpa cache).
// - Jika berbeda -> muat ulang halaman (sekali, dengan guard agar tidak loop).
// - Jika chunk lazy gagal dimuat (file lama sudah terhapus setelah deploy) -> muat ulang sekali.

const RELOAD_KEY = 'by_reload_for_build';
const CHUNK_RELOAD_KEY = 'by_chunk_reload_at';
const CHECK_EVERY_MS = 5 * 60 * 1000;

function reloadOnceFor(build: string) {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === build) return; // sudah dicoba utk build ini
    sessionStorage.setItem(RELOAD_KEY, build);
  } catch {
    /* abaikan */
  }
  window.location.reload();
}

async function checkVersion() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { build?: string };
    if (j.build && j.build !== __BUILD_ID__) reloadOnceFor(j.build);
  } catch {
    /* offline / dev: abaikan */
  }
}

function reloadAfterChunkError() {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return; // cegah loop
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    /* abaikan */
  }
  window.location.reload();
}

const CHUNK_ERR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\d]+ failed/i;

export function startAppUpdateWatcher() {
  if (import.meta.env.DEV) return;

  // Vite memicu event ini saat preload modul/CSS gagal (biasanya karena deploy baru).
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    reloadAfterChunkError();
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason && (e.reason.message || e.reason)) || '');
    if (CHUNK_ERR.test(msg)) reloadAfterChunkError();
  });
  window.addEventListener('error', (e) => {
    if (CHUNK_ERR.test(String(e.message || ''))) reloadAfterChunkError();
  });

  window.setTimeout(checkVersion, 3000);
  window.setInterval(checkVersion, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion();
  });
}
