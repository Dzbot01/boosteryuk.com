import { SERVICE_SLIDES } from '../constants';
import { useSiteSettings } from '../context/SiteSettingsContext';

export interface Slide {
  url: string;
  title: string;
  subtitle: string;
}

/** Slider halaman (Layanan, Sewa Agen AI, VPS): slider child panel bila ada, selain itu bawaan. */
export function useSlides(): readonly Slide[] {
  const { slides } = useSiteSettings();
  return slides && slides.length ? slides.map((s) => ({ url: s.image, title: s.title, subtitle: s.subtitle })) : SERVICE_SLIDES;
}
