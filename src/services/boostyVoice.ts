// Controller suara "Guri Booster" (singleton pub/sub).
// Dimulai DI DALAM gesture klik login (AuthModal) agar autoplay diizinkan browser,
// lalu AiAssistantCard berlangganan untuk menampilkan subtitle tersinkron.
import { BOOSTY_SEQUENCE, type BoostyVoice } from '../data/boostyVoices';

export interface BoostyVoiceState {
  voice: BoostyVoice | null;
  subtitle: string;
  blocked: boolean;
}

let state: BoostyVoiceState = { voice: null, subtitle: '', blocked: false };
let audio: HTMLAudioElement | null = null;
let gestureCleanup: (() => void) | null = null;
const subs = new Set<() => void>();

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'click'];

function emit() {
  subs.forEach((fn) => fn());
}

function set(patch: Partial<BoostyVoiceState>) {
  state = { ...state, ...patch };
  emit();
}

function removeGestureRetry() {
  if (gestureCleanup) {
    gestureCleanup();
    gestureCleanup = null;
  }
}

function clearAudio() {
  removeGestureRetry();
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.ontimeupdate = null;
    audio = null;
  }
}

/** Jika autoplay diblokir browser, coba putar lagi pada gesture user berikutnya. */
function retryOnGesture(a: HTMLAudioElement) {
  removeGestureRetry();
  const retry = () => {
    a.play().then(() => {
      set({ blocked: false });
      removeGestureRetry();
    }).catch(() => { /* masih diblokir, tunggu gesture lain */ });
  };
  GESTURE_EVENTS.forEach((ev) => window.addEventListener(ev, retry, { passive: true }));
  gestureCleanup = () => GESTURE_EVENTS.forEach((ev) => window.removeEventListener(ev, retry));
}

function playAt(index: number) {
  clearAudio();
  const voice = BOOSTY_SEQUENCE[index];
  if (!voice) {
    set({ voice: null, subtitle: '' });
    return;
  }
  set({ voice, subtitle: voice.cues[0]?.text ?? '', blocked: false });
  const a = new Audio(voice.src);
  a.volume = 1;
  audio = a;
  a.ontimeupdate = () => {
    const t = a.currentTime;
    const cue = voice.cues.find((c) => t >= c.start && t < c.end);
    if (cue) set({ subtitle: cue.text });
  };
  a.onended = () => {
    if (index + 1 < BOOSTY_SEQUENCE.length) playAt(index + 1);
    else {
      audio = null;
      set({ voice: null, subtitle: '' });
    }
  };
  a.play().then(() => set({ blocked: false })).catch(() => {
    set({ blocked: true });
    retryOnGesture(a);
  });
}

export const boostyVoice = {
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  getState(): BoostyVoiceState {
    return state;
  },
  /** Mulai urutan dari awal (sapaan -> info reseller). */
  start() {
    playAt(0);
  },
  /** Hentikan & kosongkan subtitle. */
  stop() {
    clearAudio();
    set({ voice: null, subtitle: '', blocked: false });
  },
  isActive() {
    return state.voice !== null;
  },
};
