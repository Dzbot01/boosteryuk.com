// Konfigurasi dasar SEO. SITE_URL bisa di-override lewat VITE_SITE_URL saat build.
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://boosteryuk.com').replace(/\/+$/, '');
export const SITE_NAME = 'Boosteryuk';
export const DEFAULT_TITLE = 'Boosteryuk — Booster Media Sosial Terpercaya';
export const DEFAULT_DESC =
  'Boosteryuk — platform booster media sosial terpercaya: followers, likes, views & engagement untuk TikTok, Instagram, YouTube, Shopee, dan lainnya. Harga transparan, proses cepat, support 24/7.';
export const DEFAULT_OG_IMAGE = '/og-image.jpg?v=4';

export const abs = (path: string) => (path.startsWith('http') ? path : SITE_URL + path);
