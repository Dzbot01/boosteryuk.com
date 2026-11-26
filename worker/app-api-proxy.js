/**
 * Proxy API untuk app.boosteryuk.com  →  PHP di AeonFree.
 *
 * Alur:
 *   Browser (app.boosteryuk.com)  --/api/*-->  Worker ini  --server-side-->  https://boosteryuk.com/api/*
 *
 * Kenapa perlu:
 *   - UI di Cloudflare dan PHP di AeonFree beda domain. Panggilan langsung dari browser kena
 *     tantangan anti-bot AeonFree (aes.js + cookie __test) pada preflight, yang tidak membawa
 *     header CORS → "blocked by CORS policy". Lewat Worker, browser hanya memanggil /api di
 *     host yang sama (same-origin), jadi tidak ada CORS dan tidak ada preflight.
 *
 * Soal tantangan anti-bot:
 *   - Di child panel, browser yang menyelesaikan tantangan (halaman utama dilayani dari AeonFree).
 *     Di app.boosteryuk.com halaman dilayani dari Cloudflare, jadi browser tidak pernah menerima
 *     cookie __test. Karena itu Worker ini menyelesaikan tantangannya sendiri (AES-128-CBC dengan
 *     nilai a, b, c dari halaman tantangan), lalu mengulang request dengan cookie __test.
 *   - Cookie disimpan PER PENGUNJUNG (hash IP pengunjung) di memori isolate + Cache API — bukan
 *     satu cookie bersama untuk semua pengunjung, supaya saat trafik ramai setiap pengunjung
 *     punya jejak cookie sendiri dan satu cookie yang bermasalah tidak menyeret semua orang.
 *
 * Pengaman batas rate (429) AeonFree:
 *   - Bila origin membalas 429, Worker SETOP menembak: `blockedUntil` diisi now+120 detik dan
 *     selama jendela itu `proxyApi` langsung membalas 503 JSON + header Retry-After: 120 TANPA
 *     menghubungi AeonFree — sehingga blokir/rate-limit tidak diperpanjang oleh retry kita.
 *
 * Cache respons GET yang jarang berubah:
 *   - Mis. /api/site_settings.php disimpan di Cache API selama 45 detik (rentang aman 30–60 dtk)
 *     supaya hit berulang tidak menembak AeonFree sama sekali.
 *
 * Samaran request (buildInit):
 *   - User-Agent, Accept, dan Accept-Language diisi bila kosong agar request Worker tidak
 *     terlihat seperti bot tanpa identitas.
 *   - Penerusan IP asli pengunjung (header X-Visitor-IP) DIMATIKAN default (FORWARD_VISITOR_IP
 *     = false): iFastNet/AeonFree kadang bereaksi terhadap header forwarded, jadi wajib dites
 *     dulu sebelum diaktifkan.
 *
 * Diagnostik: buka https://app.boosteryuk.com/api/__health
 */

const ORIGIN = "https://boosteryuk.com";
const COOKIE_NAME = "__test";
const COOKIE_CACHE_PREFIX = "https://cache.boosteryuk.internal/aeonfree-test-cookie-";
const API_CACHE_NAME = "by-worker-api-v1";
const HEALTH_PROBE_PATH = "/api/me.php";

/** Jendela berhenti menembak origin setelah menerima 429 (ms). */
const BLOCK_WINDOW_MS = 120000;

/**
 * Waktu (epoch ms) sampai Worker boleh menghubungi origin lagi. Selama sekarang < nilai ini,
 * proxyApi membalas 503 + Retry-After tanpa menyentuh AeonFree (tidak memperpanjang blokir).
 */
let blockedUntil = 0;

/** GET yang jarang berubah → di-cache di Worker (detik). Rentang aman 30–60 detik. */
const CACHEABLE_GET = {
  "/api/site_settings.php": 45,
};

/** Maksimum entri cookie per-pengunjung di memori isolate (eviksi FIFO). */
const JAR_MAX = 1000;

/**
 * Nyalakan hanya setelah tes: meneruskan IP asli pengunjung ke PHP lewat header khusus
 * X-Visitor-IP (bukan X-Forwarded-For standar) supaya PHP bisa membedakan pengunjung.
 * iFastNet kadang bereaksi terhadap header forwarded — tes dulu sebelum true.
 */
const FORWARD_VISITOR_IP = false;

// Header yang tidak boleh diteruskan ke AeonFree (sama seperti proxy child panel).
const HOP_HEADERS = [
  "host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-worker", "x-real-ip",
  "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto", "x-forwarded-server", "forwarded",
  "x-original-host", "x-host", "connection", "keep-alive", "transfer-encoding", "upgrade",
];

/** Cookie __test per pengunjung (kunci = hash IP) untuk isolate ini. */
const cookieJar = new Map();

// ---------------------------------------------------------------------------------------------
// Identitas pengunjung
// ---------------------------------------------------------------------------------------------

/** Kunci stabil per pengunjung: hash IP asal (CF) — fallback 'anon' bila tidak ada. */
function visitorKey(request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "";
  if (!ip) return "anon";
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h + ip.charCodeAt(i)) >>> 0;
  return "v" + h.toString(36);
}

// ---------------------------------------------------------------------------------------------
// Penyelesai tantangan anti-bot
// ---------------------------------------------------------------------------------------------

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Halaman tantangan berisi:
 *   var a=toNumbers("..."),b=toNumbers("..."),c=toNumbers("...");
 *   document.cookie="__test="+toHex(slowAES.decrypt(c,2,a,b)) ...
 * a = kunci, b = IV, c = ciphertext (AES-128-CBC tanpa padding). Hasil dekripsi = nilai cookie.
 */
async function solveChallenge(html) {
  const found = [...html.matchAll(/toNumbers\("([0-9a-f]+)"\)/gi)].map((m) => m[1]);
  if (found.length < 3) return null;
  const [key, iv, data] = found.slice(0, 3).map(hexToBytes);
  if (key.length !== 16 || iv.length !== 16 || data.length === 0 || data.length % 16 !== 0) return null;

  // Web Crypto hanya mendukung AES-CBC dengan padding PKCS7. Ciphertext tantangan tidak berpadding,
  // jadi ditambah satu blok yang dibentuk agar plaintext-nya tepat blok padding valid (16 x 0x10).
  // Setelah itu dekripsi mengembalikan plaintext asli tanpa blok tambahan.
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
  const lastBlock = data.slice(data.length - 16);
  const padPlain = new Uint8Array(16).fill(16);
  const padEnc = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: lastBlock }, cryptoKey, padPlain));
  const forged = new Uint8Array(data.length + 16);
  forged.set(data, 0);
  forged.set(padEnc.slice(0, 16), data.length);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, forged));
  return bytesToHex(plain);
}

/** Kembalikan HTML tantangan bila respons ini halaman tantangan AeonFree, selain itu null. */
async function readChallenge(res) {
  const type = res.headers.get("content-type") || "";
  if (res.status !== 200 || !type.includes("text/html")) return null;
  const html = await res.clone().text();
  return /aes\.js/i.test(html) && /toNumbers\(/i.test(html) ? html : null;
}

// ---------------------------------------------------------------------------------------------
// Penyimpanan cookie (per pengunjung)
// ---------------------------------------------------------------------------------------------

function edgeCache() {
  return globalThis.caches && globalThis.caches.default ? globalThis.caches.default : null;
}

async function loadCookie(key) {
  if (cookieJar.has(key)) return cookieJar.get(key);
  try {
    const cache = edgeCache();
    if (cache) {
      const hit = await cache.match(COOKIE_CACHE_PREFIX + key);
      if (hit) {
        const value = (await hit.text()).trim() || null;
        if (value) rememberCookie(key, value);
        return value;
      }
    }
  } catch (_) { /* cache tidak wajib */ }
  return cookieJar.get(key) || null;
}

function rememberCookie(key, value) {
  if (cookieJar.size >= JAR_MAX) {
    const first = cookieJar.keys().next().value;
    if (first !== undefined) cookieJar.delete(first);
  }
  cookieJar.set(key, value);
}

async function saveCookie(value, ctx, key) {
  rememberCookie(key, value);
  try {
    const cache = edgeCache();
    if (cache) {
      const put = cache.put(COOKIE_CACHE_PREFIX + key, new Response(value, { headers: { "Cache-Control": "public, max-age=86400" } }));
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put); else await put;
    }
  } catch (_) { /* cache tidak wajib */ }
}

async function forgetCookie(ctx, key) {
  cookieJar.delete(key);
  try {
    const cache = edgeCache();
    if (cache) {
      const del = cache.delete(COOKIE_CACHE_PREFIX + key);
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(del); else await del;
    }
  } catch (_) { /* cache tidak wajib */ }
}

// ---------------------------------------------------------------------------------------------
// Cache API untuk GET yang jarang berubah
// ---------------------------------------------------------------------------------------------

async function apiCache() {
  try {
    return globalThis.caches ? await globalThis.caches.open(API_CACHE_NAME) : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Request ke AeonFree
// ---------------------------------------------------------------------------------------------

/** Pasang cookie __test ke header Cookie (cookie lain dari browser tetap dipertahankan). */
function withTestCookie(headers, value) {
  const existing = headers.get("cookie") || "";
  const parts = existing
    .split(/;\s*/)
    .filter((p) => p && !p.toLowerCase().startsWith(COOKIE_NAME + "="));
  if (value) parts.push(`${COOKIE_NAME}=${value}`);
  if (parts.length) headers.set("cookie", parts.join("; "));
  else headers.delete("cookie");
}

function buildInit(request, body, cookie) {
  const headers = new Headers(request.headers);
  for (const h of HOP_HEADERS) headers.delete(h);
  // Identitas dasar agar request Worker tidak terlihat seperti bot tanpa header browser.
  if (!headers.has("user-agent")) {
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
  }
  if (!headers.has("accept")) headers.set("Accept", "application/json, text/plain, */*");
  if (!headers.has("accept-language")) headers.set("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.6");
  // Opsional & default MATI: teruskan IP asli pengunjung lewat header khusus (tes dulu!).
  if (FORWARD_VISITOR_IP) {
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("X-Visitor-IP", ip);
  }
  withTestCookie(headers, cookie);
  return { method: request.method, headers, body, redirect: "manual" };
}

/** Samakan respons origin dengan host app: redirect tetap di app, atribut Domain cookie dibuang. */
function adaptResponse(res, host) {
  const out = new Response(res.body, res);
  const loc = out.headers.get("location");
  if (loc) {
    out.headers.set("location", loc.replace(/^https?:\/\/(www\.)?boosteryuk\.com(?=\/|$)/i, `https://${host}`));
  }
  const cookies = typeof out.headers.getSetCookie === "function" ? out.headers.getSetCookie() : [];
  if (cookies.length) {
    out.headers.delete("set-cookie");
    for (const c of cookies) out.headers.append("set-cookie", c.replace(/;\s*domain=[^;]*/gi, ""));
  }
  if (!out.headers.has("cache-control")) out.headers.set("Cache-Control", "no-store");
  return out;
}

function jsonError(message, status, extra) {
  return new Response(JSON.stringify({ ok: false, message, ...(extra || {}) }), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}

/** 503 + Retry-After saat jendela blokir 429 aktif — origin TIDAK dihubungi sama sekali. */
function rateLimitGuardResponse() {
  const wait = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      ok: false,
      message: "Server asal sedang membatasi request (429). Worker menahan diri supaya blokir tidak diperpanjang.",
      retry_after: 120,
      wait_seconds: wait,
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
        "Retry-After": "120",
      },
    },
  );
}

/**
 * Kirim request ke AeonFree. Bila dibalas halaman tantangan, selesaikan tantangan lalu ulangi.
 * Bila dibalas 429, catat `blockedUntil` supaya Worker berhenti menembak selama 2 menit.
 * Mengembalikan { res, solved, challenged, error }.
 */
async function callOrigin(request, target, body, ctx) {
  const key = visitorKey(request);
  const send = (cookie) => fetch(target, buildInit(request, body, cookie));

  const note429 = (res) => {
    if (res && res.status === 429) blockedUntil = Date.now() + BLOCK_WINDOW_MS;
    return res;
  };

  let res = note429(await send(await loadCookie(key)));
  let challenge = await readChallenge(res);
  if (!challenge) return { res, solved: false, challenged: false };

  const value = await solveChallenge(challenge);
  if (!value) return { error: "Format tantangan AeonFree tidak dikenali", challenged: true };
  await saveCookie(value, ctx, key);

  res = note429(await send(value));
  if (await readChallenge(res)) {
    await forgetCookie(ctx, key);
    return { error: "AeonFree masih menantang request setelah tantangan diselesaikan", challenged: true };
  }
  return { res, solved: true, challenged: true };
}

async function proxyApi(request, ctx) {
  const url = new URL(request.url);

  // Pengaman 429: selama jendela blokir, balas 503 + Retry-After tanpa menyentuh AeonFree.
  if (Date.now() < blockedUntil) return rateLimitGuardResponse();

  // Cache Worker untuk GET yang jarang berubah (mis. site_settings) — kurangi hit ke origin.
  const ttl = request.method === "GET" ? CACHEABLE_GET[url.pathname] : undefined;
  const cache = ttl ? await apiCache() : null;
  if (cache) {
    try {
      const hit = await cache.match(request.url);
      if (hit) {
        const out = new Response(hit.body, hit);
        out.headers.set("X-Worker-Cache", "HIT");
        return out;
      }
    } catch (_) { /* cache tidak wajib */ }
  }

  const target = ORIGIN + url.pathname + url.search;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  try {
    const result = await callOrigin(request, target, body, ctx);
    if (result.error) return jsonError("Gagal konek ke server", 502, { detail: result.error });
    const adapted = adaptResponse(result.res, url.host);
    if (cache && ttl && result.res.ok) {
      try {
        const stored = new Response(adapted.clone().body, adapted.clone());
        stored.headers.set("Cache-Control", `public, max-age=${ttl}`);
        stored.headers.set("X-Worker-Cache", "MISS");
        const put = cache.put(request.url, stored);
        if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put); else await put;
      } catch (_) { /* gagal menyimpan cache bukan kegagalan request */ }
    }
    return adapted;
  } catch (e) {
    return jsonError("Gagal konek ke server", 502, { detail: e instanceof Error ? e.message.slice(0, 120) : "fetch failed" });
  }
}

async function health(ctx) {
  const probe = { path: HEALTH_PROBE_PATH, blockedUntil };
  const t0 = Date.now();
  try {
    const request = new Request(`https://app.boosteryuk.com${HEALTH_PROBE_PATH}`, { method: "GET" });
    const result = await callOrigin(request, ORIGIN + HEALTH_PROBE_PATH, undefined, ctx);
    probe.challengeSeen = result.challenged;
    probe.challengeSolved = !!result.solved;
    if (result.error) {
      probe.error = result.error;
    } else {
      const text = await result.res.text();
      probe.status = result.res.status;
      probe.contentType = result.res.headers.get("content-type");
      probe.bytes = text.length;
      probe.preview = text.slice(0, 120);
    }
  } catch (e) {
    probe.error = e instanceof Error ? e.message : String(e);
  }
  probe.ms = Date.now() - t0;
  const okJson = !probe.error && String(probe.contentType || "").includes("json");
  return new Response(
    JSON.stringify({
      ok: okJson,
      origin: ORIGIN,
      probe,
      verdict: okJson
        ? "Worker dapat memanggil PHP di AeonFree (respons JSON diterima). Proxy /api siap dipakai."
        : "Worker belum mendapat respons JSON dari AeonFree (lihat probe).",
    }, null, 2),
    { headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } },
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/__health") return health(ctx);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return proxyApi(request, ctx);
    // Selain /api: layani file statis hasil build (UI tidak disentuh).
    return env.ASSETS.fetch(request);
  },
};
