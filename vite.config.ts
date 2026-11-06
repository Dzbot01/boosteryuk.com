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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
