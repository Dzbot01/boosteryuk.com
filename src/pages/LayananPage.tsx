import Seo from '../components/Seo';
import { faqJsonLd, staticSeo } from '../seo/content';
import SmmPanelInfo from '../components/SmmPanelInfo';
import { useCallback, useEffect, useRef, useState } from 'react';

import Reveal from '../components/Reveal';
import BuatPesananCard from '../components/BuatPesananCard';
import EmptyStateModel from '../components/EmptyStateModel';
import { useSlides } from '../lib/useSlides';

const SLIDE_INTERVAL = 4500;
/**
 * Model 3D yang "merangkul" pojok kiri atas card image slider (Supabase Storage public).
 * Nama file aslinya mengandung spasi sehingga di-encode sebagai %20.
 */
const SLIDER_HUG_MODEL_URL =
  'https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/scene%20(1).glb';

export default function LayananPage() {
  const SLIDES = useSlides();

  const [index, setIndex] = useState(0);
  const paused = useRef(false);
  /** Card slider diukur supaya tinggi panggung model 3D sama persis dengan tingginya. */
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [sliderH, setSliderH] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % SLIDES.length);
  }, []);

  // Ukur tinggi card slider (desktop & mobile, mengikuti aspect ratio-nya) — tinggi ini
  // dipakai sebagai tinggi panggung model 3D sehingga keduanya selalu sama.
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      setSliderH((prev) => (Math.abs(prev - h) > 1 ? h : prev));
    };
    measure();
    if (typeof ResizeObserver !== 'function') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-advance the slider, pausing while the pointer is over it.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused.current) next();
    }, SLIDE_INTERVAL);
    return () => window.clearInterval(timer);
  }, [next]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6">
      <Seo
        title={staticSeo('/layanan')?.title}
        fullTitle={staticSeo('/layanan')?.fullTitle}
        description={staticSeo('/layanan')?.description}
        jsonLd={faqJsonLd(staticSeo('/layanan')?.faq || [])}
      />
      <header className="mx-auto mb-6 max-w-2xl text-center">
        <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[26px] dark:text-white">
          {staticSeo('/layanan')?.h1}
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          Followers, likes, views, dan engagement untuk TikTok, Instagram, YouTube, hingga marketplace — harga per 1.000 tampil sebelum memesan.
        </p>
      </header>

      {/* ================= SLIDER (atas, ukuran lebih kecil) ================= */}
      <Reveal delay={40}>
        {/* Wrapper polos (TANPA overflow-hidden) supaya model 3D bisa sedikit menumpuk
            sudut card dan tampak merangkulnya, bukan terpotong oleh card. */}
        <div className="relative mx-auto w-full max-w-2xl">
        <div
          ref={sliderRef}
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-slate-200 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.5)] dark:border-slate-700/60 sm:aspect-[21/8] lg:!aspect-[21/7]"
          onMouseEnter={() => (paused.current = true)}
          onMouseLeave={() => (paused.current = false)}
        >
          {/* horizontal track containing all slides side by side */}
          <div
            className="flex h-full transition-transform duration-500 ease-out"
            style={{
              width: `${SLIDES.length * 100}%`,
              transform: `translateX(-${index * (100 / SLIDES.length)}%)`,
            }}
          >
            {SLIDES.map((slide) => (
              <div
                key={slide.url}
                className="h-full"
                style={{ width: `${100 / SLIDES.length}%` }}
              >
                <img
                  src={slide.url}
                  alt={slide.title}
                  className="h-full w-full object-cover"
                  loading={slide.url === SLIDES[0].url ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>

          {/* dots */}
          <div className="absolute bottom-4 right-5 flex items-center gap-1.5 sm:bottom-6 sm:right-8">
            {SLIDES.map((s, i) => (
              <button
                key={s.url}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-white dark:bg-slate-900' : 'w-1.5 bg-white/50 hover:bg-white/80 dark:bg-slate-900/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Model 3D di POJOK KIRI ATAS card slider, seolah merangkul card:
            - tinggi panggung = tinggi card slider (diukur lewat ResizeObserver),
            - transparan & tanpa card sendiri, sedikit menumpuk sudut card (-8% / -6%),
            - pointer-events-none sehingga klik/scroll/dots slider tetap jalan,
            - fitBy 'height' + zoom 1.4 => tinggi model ~= tinggi card, fitAxes 'both'
              menjaga model tetap utuh (tidak terpotong) di dalam panggungnya,
            - motion dimatikan supaya pose model stabil di sudut card. */}
        {sliderH > 0 && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-20 -translate-x-[8%] -translate-y-[6%] select-none"
            style={{ height: sliderH, width: sliderH }}
            aria-hidden="true"
          >
            <EmptyStateModel
              modelUrl={SLIDER_HUG_MODEL_URL}
              height={sliderH}
              fitBy="height"
              fitAxes="both"
              fitMargin={1.05}
              zoom={1.4}
              motion={false}
              stageClassName="max-w-none w-full"
              className="!p-0"
            />
          </div>
        )}
        </div>
      </Reveal>

      {/* ================= BUAT PESANAN CARD (lebar penuh di bawah slider) ================= */}
      <Reveal delay={120} className="mt-8">
        <BuatPesananCard />
      </Reveal>

      <SmmPanelInfo />
    </div>
  );
}
