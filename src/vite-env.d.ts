/// <reference types="vite/client" />

// Tipe untuk variabel lingkungan Vite yang dipakai aplikasi (import.meta.env.*).
// Ditambahkan agar `import.meta.env` ter-type dengan benar di TypeScript.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// URL file musik ber-nama unik per build (di-inject plugin di vite.config.ts).
declare const __MUSIC_URL__: string;
