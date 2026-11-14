// Konfigurasi dasar SEO. SITE_URL bisa di-override lewat VITE_SITE_URL saat build.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://boosteryuk.com').replace(/\/+$/, '');
export const SITE_NAME = 'Boosteryuk';
export const DEFAULT_TITLE = 'Boosteryuk — SMM Panel Indonesia & Jasa Booster Media Sosial';
export const DEFAULT_DESC =
  'Boosteryuk adalah SMM Panel Indonesia untuk layanan followers, likes, views, dan engagement TikTok, Instagram, YouTube, serta platform lainnya. Nikmati pemesanan online, harga transparan, dan dukungan pelanggan.';
export const DEFAULT_OG_IMAGE = '/og-image.jpg?v=4';

export const abs = (path: string) => (path.startsWith('http') ? path : SITE_URL + path);
