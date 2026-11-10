import Seo from '../components/Seo';
import { SITE_URL } from '../seo/config';
import { useNavigate } from 'react-router-dom';
// FIX: hapus import ikon yang tidak dipakai (ShieldCheck, Rocket, Gauge) agar lolos typecheck.
import {
  Star,
  UserRound,
  Shield,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';
import Reveal from '../components/Reveal';
import AuthModal from '../components/AuthModal';

import {
  LOGO_URL,
  SECONDARY_SOCIAL_BRANDS,
  SOCIAL_BRANDS,
  socialIconUrl,
} from '../constants';
import { useTheme } from '../context/ThemeContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import ReviewsSection from '../components/ReviewsSection';



const HOME_JSONLD = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: 'Boosteryuk', url: SITE_URL, logo: SITE_URL + '/favicon.png' },
  {
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'Boosteryuk', url: SITE_URL,
    potentialAction: { '@type': 'SearchAction', target: SITE_URL + '/cek-status?q={search_term_string}', 'query-input': 'required name=search_term_string' },
  },
];

export default function HomePage() {
  const { isDark } = useTheme();
  const { settings } = useSiteSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const marquee = [...SOCIAL_BRANDS,...SOCIAL_BRANDS];
  const reverseMarquee = [...SECONDARY_SOCIAL_BRANDS,...SECONDARY_SOCIAL_BRANDS];

  return (
    <>
      <Seo bareOnHome jsonLd={HOME_JSONLD} />
      {/* ================= HERO LAYER ================= */}
      <section className="relative isolate -mt-[60px] overflow-hidden">
        {/* Hero background — tema abu-abu + art peta dunia. Gambar DITANAM sebagai data-URI
            di CSS (.hero-map) sehingga TIDAK MUNGKIN 404 walau aset tak ikut ter-upload.
            Base grey sebagai jaring pengaman; overlay hanya menggelapkan sisi kiri (teks). */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* base abu-abu gelap (charcoal) */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#1b1c20] via-[#141519] to-[#0e0f12]" />
          {/* peta dunia (data-URI di CSS .hero-map) */}
          <div className="hero-map absolute inset-0" />
          {/* overlay menggelapkan sisi kiri agar teks kontras */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f12]/85 via-[#0e0f12]/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_-8%,rgba(255,255,255,0.05),transparent_70%)]" />
          {/* lebur ke body */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white dark:to-[#0a0a0b]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:pb-24 lg:pt-32">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <h1 className="font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[64px]">
              <span className="text-cyan-300">Booster</span>
              <span className="text-white">yuk</span>
            </h1>

            <p className="mt-5 max-w-md font-display text-[19px] font-bold leading-snug tracking-tight text-white/90 sm:text-[22px]">
              Turbo Speed,
              <br />
              <span className="text-cyan-300">Fort Knox Security.</span>
            </p>

            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-neutral-300/85">
              Platform booster media sosial terpercaya — followers, likes, views, dan engagement
              untuk semua platform favorit Anda.
            </p>

            {/* Trust & stats — baris rating di atas, dua metrik angka sejajar di bawah.
                Tata letak konsisten & tidak meng-wrap/terpotong di mobile maupun desktop. */}
            <div className="mt-7 max-w-md">
              {/* rating */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex -space-x-2">
                  {SOCIAL_BRANDS.slice(0, 5).map((b) => (
                    <span
                      key={b.slug}
                      title={b.name}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm ring-2 ring-white/10"
                    >
                      <img
                        src={socialIconUrl(b.slug, b.color)}
                        alt={b.name}
                        className="h-4 w-4 object-contain"
                        loading="lazy"
                      />
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-[11.5px] font-semibold text-neutral-300/80">
                    4,9 · dipercaya seller SMM
                  </p>
                </div>
              </div>

              {/* metrik: dua kolom sejajar + pemisah */}
              <div className="mt-5 flex items-center gap-7">
                <div>
                  <p className="font-display text-[26px] font-extrabold leading-none text-white">698+</p>
                  <p className="mt-1.5 text-[11.5px] font-semibold text-neutral-400">Layanan Tersedia</p>
                </div>
                <span className="h-9 w-px bg-white/15" />
                <div>
                  <p className="font-display text-[26px] font-extrabold leading-none text-white">24/7</p>
                  <p className="mt-1.5 text-[11.5px] font-semibold text-neutral-400">Suport Center</p>
                </div>
              </div>
            </div>
            
            {/* CTA — cek status */}
            <div className="mt-7">
              <button
                onClick={() => navigate('/cek-status')}
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-blue-600 px-6 text-[14px] font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98]"
              >
                <Search className="h-4 w-4" strokeWidth={2.4} />
                Cek Status Pesanan
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  strokeWidth={2.4}
                />
              </button>
            </div>

            {/* Auth buttons — compact, shown until a user signs in */}
            {/* FIX: tambah `flex` — tanpa ini flex-wrap/items-center/gap tidak berlaku,
                tombol Masuk & Daftar jadi menumpuk ke bawah. */}
            {!user && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-cyan-600 px-4 text-[12px] font-bold text-white shadow-md shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-95"
                >
                  <UserRound className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-700 transition-all hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-cyan-950/60"
                >
                  <Shield className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Daftar
                </button>
              </div>
            )}
          </Reveal>

          <Reveal delay={140}>
            {/* Visual kanan — logo beranimasi dengan beberapa lingkaran di belakangnya
                (tanpa card/orb), mengikuti versi awal. Warna ring netral agar pas di tema abu-abu. */}
            <div className="relative mx-auto flex aspect-square w-full max-w-[20rem] items-center justify-center sm:max-w-sm lg:max-w-md">
              <div className="absolute h-3/4 w-3/4 rounded-full bg-white/[0.06] blur-3xl" />
              <span className="absolute h-[88%] w-[88%] rounded-full border border-white/12" />
              <span className="absolute h-[64%] w-[64%] rounded-full border border-white/10" />
              <span className="absolute h-[42%] w-[42%] rounded-full border border-white/[0.07]" />
              <img
                src={LOGO_URL}
                alt="Boosteryuk"
                className="relative h-2/5 w-2/5 max-h-[200px] min-h-[120px] animate-float-slow object-contain drop-shadow-[0_18px_34px_rgba(0,0,0,0.5)]"
              />
            </div>
          </Reveal>
          </div>
        </div>
      </section>

      {/* ================= VIDEO PLAYER (antara hero & body) =================
          File boosteryuk.mp4 diletakkan di root web (sejajar index.html).
          Tidak dapat diunduh: controlsList=nodownload + klik-kanan dinonaktifkan. */}
      <section className="mx-auto -mt-8 max-w-5xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-black shadow-[0_26px_60px_-30px_rgba(15,23,42,0.6)] dark:border-slate-700/60">
          <video
            src="/boosteryuk.mp4"
            className="aspect-video w-full"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </section>

        {/* ================= BODY LAYER ================= */}
      <main className="mx-auto max-w-6xl px-4 pb-32 sm:px-6">
        {/* ================= WHY ================= */}
        <ReviewsSection />

        {/* social marquees */}
        <Reveal>
          <section className="mt-14">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Platform booster yang didukung
            </p>
            <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
              <div className="animate-marquee flex w-max items-center gap-12 px-6">
                {marquee.map((brand, i) => (
                  <img
                    key={`${brand.slug}-${i}`}
                    src={socialIconUrl(brand.slug, isDark ? 'ffffff' : brand.color)}
                    alt={brand.name}
                    title={brand.name}
                    className="h-9 w-9 shrink-0 object-contain opacity-60 transition-all duration-200 hover:scale-110 hover:opacity-100"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>

            {/* Reverse marquee */}
            <div className="relative mt-7 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
              <div className="animate-marquee-reverse flex w-max items-center gap-14 px-7">
                {reverseMarquee.map((brand, i) => (
                  <img
                    key={`${brand.name}-${i}`}
                    src={isDark ? brand.darkUrl : brand.url}
                    alt={brand.name}
                    title={brand.name}
                    className={`h-10 w-10 shrink-0 object-contain opacity-65 transition-all duration-200 hover:scale-110 hover:opacity-100 ${brand.darkInvert ? 'dark:invert' : ''}`}
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      </main>

      <footer className="border-t border-slate-200 bg-white/70 pb-24 dark:border-slate-700/60 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={settings.logoUrl} alt="" className="h-9 w-9 object-contain" />
            <p className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              <span className="text-cyan-600 dark:text-cyan-400">{settings.brandName}</span>
              <span className="text-black dark:text-white">{settings.brandSuffix}</span>
            </p>
          </div>
          <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">
            {settings.footerText}
          </p>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </>
  );
}