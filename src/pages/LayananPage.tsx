import Seo from '../components/Seo';
import { staticSeo } from '../seo/content';
import { useCallback, useEffect, useRef, useState } from 'react';

import Reveal from '../components/Reveal';
import BuatPesananCard from '../components/BuatPesananCard';
import { useSlides } from '../lib/useSlides';

const SLIDE_INTERVAL = 4500;

export default function LayananPage() {
  const SLIDES = useSlides();

  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % SLIDES.length);
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
      <Seo title={staticSeo('/layanan')?.title} description={staticSeo('/layanan')?.description} />

      {/* ================= SLIDER (atas, ukuran lebih kecil) ================= */}
      <Reveal delay={40}>
        <div
          className="relative mx-auto aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-[22px] border border-slate-200 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.5)] dark:border-slate-700/60 sm:aspect-[21/8] lg:!aspect-[21/7]"
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
      </Reveal>

      {/* ================= BUAT PESANAN CARD (lebar penuh di bawah slider) ================= */}
      <Reveal delay={120} className="mt-8">
        <BuatPesananCard />
      </Reveal>
    </div>
  );
}
