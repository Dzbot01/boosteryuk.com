import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
const TOOLTIP_DELAY = 3000;
const MUSIC_SRC = '/tes.mp3';

interface MusicCtx {
  /** Whether the track is currently playing. */
  playing: boolean;
  /** Toggle play / pause. First click starts, second click stops. */
  toggle: () => void;
  /** Whether the onboarding tooltip should be visible. */
  showTooltip: boolean;
  /** Hide the onboarding tooltip manually. */
  dismissTooltip: () => void;
  /** True when the browser blocked autoplay and playback failed. */
  blocked: boolean;
}

const MusicContext = createContext<MusicCtx>({
  playing: false,
  toggle: () => {},
  showTooltip: false,
  dismissTooltip: () => {},
  blocked: false,
});

export function MusicProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [interacted, setInteracted] = useState(false);

  /* ---------- create the audio element once ---------- */
  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.45;
    audioRef.current = audio;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- show the tooltip 3s after the first load ---------- */
  useEffect(() => {
    if (interacted) return;
    const t = window.setTimeout(() => {
      if (!interacted) setShowTooltip(true);
    }, TOOLTIP_DELAY);
    return () => window.clearTimeout(t);
  }, [interacted]);

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false);
    setInteracted(true);
  }, []);

  /* ---------- play / pause toggle ---------- */
  const toggle = useCallback(() => {
    // Any interaction with the music button permanently hides the tooltip.
    setShowTooltip(false);
    setInteracted(true);

    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setBlocked(false);
        })
        .catch(() => {
          setPlaying(false);
          setBlocked(true);
        });
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <MusicContext.Provider value={{ playing, toggle, showTooltip, dismissTooltip, blocked }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  return useContext(MusicContext);
}
