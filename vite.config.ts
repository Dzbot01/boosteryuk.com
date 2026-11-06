import path from "path";
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
function siteUrlPlugin(): Plugin {
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  const siteUrl = (process.env.VITE_SITE_URL || fromVercel || "https://boosteryuk.com").replace(/\/+$/, "");
  return {
    name: "site-url",
    transformIndexHtml: (html) => html.split("__SITE_URL__").join(siteUrl),
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrlPlugin()],
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
