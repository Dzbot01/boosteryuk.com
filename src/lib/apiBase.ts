// Alamat API PHP Boosteryuk.
// - Web utama: https://boosteryuk.com/api (seperti sebelumnya).
// - Child panel (<sub>.boosteryuk.com, lewat Cloudflare Worker): /api di host yang sama → Worker
//   meneruskan ke AeonFree dengan header X-Child-Panel, sehingga PHP tahu panel mana (markup dll),
//   tanpa CORS dan memakai cookie keamanan hosting milik subdomain itu sendiri.
// - app.boosteryuk.com (UI di Cloudflare): bukan child panel, tetapi memanggil /api di host yang
//   sama → Worker app-api-proxy meneruskan ke AeonFree (tanpa CORS, tantangan anti-bot ditangani Worker).

const ROOT = 'boosteryuk.com';
const NOT_CHILD = new Set(['www', 'api', 'wa-origin', 'app']);
/** Host yang melayani UI dari Cloudflare dan memanggil API lewat /api di host yang sama. */
const SAME_ORIGIN_API_HOSTS = new Set([`app.${ROOT}`]);

function detectChild(): string | null {
  if (typeof window === 'undefined') return null;
  
  const injected = (window as unknown as { __CHILD_PANEL__?: string }).__CHILD_PANEL__;
  if (typeof injected === 'string' && /^[a-z0-9-]{1,32}$/.test(injected)) return injected;
  const m = window.location.hostname.toLowerCase().match(/^([a-z0-9-]+)\.boosteryuk\.com$/);
  return m && !NOT_CHILD.has(m[1]) ? m[1] : null;
}

function usesSameOriginApi(): boolean {
  return typeof window !== 'undefined' && SAME_ORIGIN_API_HOSTS.has(window.location.hostname.toLowerCase());
}

/** Nama subdomain child panel yang sedang dibuka, atau null di web utama. */
export const CHILD_PANEL_SUB = detectChild();
export const IS_CHILD_PANEL = CHILD_PANEL_SUB !== null;

/** Base URL API PHP (tanpa garis miring di akhir). */
export const MAIN_API = IS_CHILD_PANEL || usesSameOriginApi() ? `${window.location.origin}/api` : `https://${ROOT}/api`;
