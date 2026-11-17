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
 *   - Nilai cookie disimpan (memori isolate + Cache API) supaya request berikutnya tidak perlu
 *     menyelesaikan tantangan lagi. Bila AeonFree menantang lagi, cookie dihitung ulang otomatis.
 *
 * Diagnostik: buka https://app.boosteryuk.com/api/__health
 */

const ORIGIN = "https://boosteryuk.com";
const COOKIE_NAME = "__test";
const CACHE_KEY = "https://cache.boosteryuk.internal/aeonfree-test-cookie";
const HEALTH_PROBE_PATH = "/api/me.php";

// Header yang tidak boleh diteruskan ke AeonFree (sama seperti proxy child panel).
const HOP_HEADERS = [
  "host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-worker", "x-real-ip",
  "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto", "x-forwarded-server", "forwarded",
  "x-original-host", "x-host", "connection", "keep-alive", "transfer-encoding", "upgrade",
];

/** Nilai cookie __test terakhir yang dipakai oleh isolate ini. */
let memoryCookie = null;

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
// Penyimpanan cookie
// ---------------------------------------------------------------------------------------------

function edgeCache() {
  return globalThis.caches && globalThis.caches.default ? globalThis.caches.default : null;
}

async function loadCookie() {
  if (memoryCookie) return memoryCookie;
  try {
    const cache = edgeCache();
    if (cache) {
      const hit = await cache.match(CACHE_KEY);
      if (hit) memoryCookie = (await hit.text()).trim() || null;
    }
  } catch (_) { /* cache tidak wajib */ }
  return memoryCookie;
}

async function saveCookie(value, ctx) {
  memoryCookie = value;
  try {
    const cache = edgeCache();
    if (cache) {
      const put = cache.put(CACHE_KEY, new Response(value, { headers: { "Cache-Control": "public, max-age=86400" } }));
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put); else await put;
    }
  } catch (_) { /* cache tidak wajib */ }
}

async function forgetCookie(ctx) {
  memoryCookie = null;
  try {
    const cache = edgeCache();
    if (cache) {
      const del = cache.delete(CACHE_KEY);
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(del); else await del;
    }
  } catch (_) { /* cache tidak wajib */ }
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

/**
 * Kirim request ke AeonFree. Bila dibalas halaman tantangan, selesaikan tantangan lalu ulangi.
 * Mengembalikan { res, solved, challenged, error }.
 */
async function callOrigin(request, target, body, ctx) {
  const send = (cookie) => fetch(target, buildInit(request, body, cookie));

  let res = await send(await loadCookie());
  let challenge = await readChallenge(res);
  if (!challenge) return { res, solved: false, challenged: false };

  const value = await solveChallenge(challenge);
  if (!value) return { error: "Format tantangan AeonFree tidak dikenali", challenged: true };
  await saveCookie(value, ctx);

  res = await send(value);
  if (await readChallenge(res)) {
    await forgetCookie(ctx);
    return { error: "AeonFree masih menantang request setelah tantangan diselesaikan", challenged: true };
  }
  return { res, solved: true, challenged: true };
}

async function proxyApi(request, ctx) {
  const url = new URL(request.url);
  const target = ORIGIN + url.pathname + url.search;
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
  try {
    const result = await callOrigin(request, target, body, ctx);
    if (result.error) return jsonError("Gagal konek ke server", 502, { detail: result.error });
    return adaptResponse(result.res, url.host);
  } catch (e) {
    return jsonError("Gagal konek ke server", 502, { detail: e instanceof Error ? e.message.slice(0, 120) : "fetch failed" });
  }
}

async function health(ctx) {
  const probe = { path: HEALTH_PROBE_PATH };
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
