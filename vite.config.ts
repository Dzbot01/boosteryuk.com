import path from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
// @ts-expect-error modul .mjs tanpa deklarasi tipe
import { seoPages, renderPage } from "./scripts/seo-pages.mjs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Mengganti placeholder __SITE_URL__ di index.html dengan URL absolut situs, dipakai oleh
 * meta Open Graph (preview link WhatsApp wajib URL gambar absolut).
 * Urutan: VITE_SITE_URL -> domain production Vercel -> https://boosteryuk.com.
 */
const SITE_URL = (
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "https://boosteryuk.com"
).replace(/\/+$/, "");

function siteUrlPlugin(): Plugin {
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  const siteUrl = SITE_URL;
  void fromVercel;
  return {
    name: "site-url",
    transformIndexHtml: (html) => html.split("__SITE_URL__").join(siteUrl),
  };
}


/**
 * Musik: emit file audio dengan NAMA UNIK setiap build (anti-cache & agar tidak tertimpa
 * rewrite SPA). URL-nya di-inject sebagai konstanta global __MUSIC_URL__.
 * Sumber: src/assets/music.mp3 (tidak disajikan mentah dari /public).
 */
function musicAssetPlugin(): Plugin {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fileName = `music.${unique}.mp3`;
  const url = "/" + fileName;
  const srcPath = path.resolve(__dirname, "src/assets/music.mp3");
  let buf: Buffer | null = null;
  const read = () => (buf ??= readFileSync(srcPath));
  return {
    name: "music-asset",
    config() {
      return { define: { __MUSIC_URL__: JSON.stringify(url) } };
    },
    buildStart() {
      this.emitFile({ type: "asset", fileName, source: read() });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split("?")[0] === url) {
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Accept-Ranges", "bytes");
          res.end(read());
          return;
        }
        next();
      });
    },
  };
}

// Versi build unik -> /version.json + __BUILD_ID__. Dipakai app untuk mendeteksi
// deploy baru dan memuat ulang otomatis (menghindari tampilan cache lama).
function buildVersionPlugin(): Plugin {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return {
    name: "build-version",
    config() {
      return { define: { __BUILD_ID__: JSON.stringify(id) } };
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: id, at: new Date().toISOString() }) });
    },
  };
}

/**
 * SEO prerender: setiap halaman publik (src/seo/pages.json) mendapat file HTML sendiri
 * (dist/<path>/index.html) berisi <title>, meta description, OG, canonical, dan teks
 * deskripsi unik di dalam #root. Crawler/preview link tanpa JavaScript tetap membaca
 * konten unik; saat JS jalan, React mengganti isi #root seperti biasa.
 */
function seoPrerenderPlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "seo-prerender",
    apply: "build",
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const template = readFileSync(path.join(outDir, "index.html"), "utf8");
      const pages = seoPages();
      let n = 0;
      for (const page of pages) {
        if (page.path === "/") continue;
        const dir = path.join(outDir, page.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, "index.html"), renderPage(template, page, pages, SITE_URL));
        n++;
      }
      console.log(`seo-prerender: ${n} halaman HTML statis`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin(), musicAssetPlugin(), buildVersionPlugin(), seoPrerenderPlugin()],
  build: {
    // Pisahkan vendor besar agar caching lebih baik & initial chunk lebih kecil.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-router')) return 'router';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react';
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('chart.js')) return 'charts';
          if (id.includes('/ogl/')) return 'ogl';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
