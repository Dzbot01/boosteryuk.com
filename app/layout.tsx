import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://boosteryuk.com';

// SEO + Open Graph (preview WhatsApp/Telegram/Facebook) — dirender server-side oleh Next.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Boosteryuk — Booster Media Sosial Terpercaya',
  description:
    'Boosteryuk — platform booster media sosial terpercaya: followers, likes, views & engagement untuk TikTok, Instagram, YouTube, Shopee, dan lainnya. Harga transparan, proses cepat, support 24/7.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Boosteryuk',
    locale: 'id_ID',
    url: '/',
    title: 'Boosteryuk — Booster Media Sosial Terpercaya',
    description:
      'Followers, likes, views & engagement untuk TikTok, Instagram, YouTube, Shopee, dan lainnya. Harga transparan, proses cepat, support 24/7.',
    images: [{ url: '/og-image.jpg?v=4', width: 1200, height: 630, alt: 'Boosteryuk — Booster Media Sosial Terpercaya (SMM Panel)' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boosteryuk — Booster Media Sosial Terpercaya',
    description: 'Followers, likes, views & engagement untuk TikTok, Instagram, YouTube, Shopee, dan lainnya.',
    images: ['/og-image.jpg?v=4'],
  },
};

// Terapkan tema tersimpan sebelum paint pertama (hindari flash). Default = light.
const themeScript = `try{var t=localStorage.getItem('bt-theme');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
