// Konfigurasi dasar SEO. SITE_URL bisa di-override lewat VITE_SITE_URL saat build.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://boosteryuk.com').replace(/\/+$/, '');
export const SITE_NAME = 'Boosteryuk';
export const DEFAULT_TITLE = 'Boosteryuk — SMM Panel Indonesia & Jasa Booster Media Sosial';
export const DEFAULT_DESC =
  'SMM Panel Indonesia terpercaya dengan layanan lengkap untuk followers, likes, views, dan engagement TikTok, Instagram, YouTube, serta platform lainnya. AI Agent, Number/SMS, Panel Pterodactyl, VPS, dan NexSpace. pelacakan status pesanan real-time, dukungan pelanggan 24/7, dan child panel untuk reseller.';
// Gambar OG utama di-CDN-kan lewat Supabase edge function `og-image` (ramah crawler;
// hosting asal pernah terbukti tidak konsisten melayani asset ke bot). Same-origin
// /og-image.jpg?v=5 tetap menjadi kandidat og:image kedua di index.html.
export const DEFAULT_OG_IMAGE = 'https://dzvsjcjvnpasrwuuopeg.supabase.co/functions/v1/og-image';

export const abs = (path: string) => (path.startsWith('http') ? path : SITE_URL + path);
