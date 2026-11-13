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
/**
 * SATU elemen audio dipakai ulang untuk seluruh urutan suara. Elemen yang sudah
 * "di-unlock" lewat gesture (prime) boleh diputar ulang/ganti src tanpa gesture baru —
 * penting untuk Safari/iOS yang memblokir new Audio() di luar gesture.
 */
let el: HTMLAudioElement | null = null;
let playing = false;
let primeToken = 0;
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

function getEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
  }
  return el;
}

function removeGestureRetry() {
  if (gestureCleanup) {
    gestureCleanup();
    gestureCleanup = null;
  }
}

function clearAudio() {
  removeGestureRetry();
  playing = false;
  if (el) {
    el.pause();
    el.onended = null;
    el.ontimeupdate = null;
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
  const a = getEl();
  playing = true;
  a.muted = false;
  a.volume = 1;
  if (!a.src.endsWith(voice.src)) a.src = voice.src;
  a.currentTime = 0;
  a.ontimeupdate = () => {
    const t = a.currentTime;
    const cue = voice.cues.find((c) => t >= c.start && t < c.end);
    if (cue) set({ subtitle: cue.text });
  };
  a.onended = () => {
    if (index + 1 < BOOSTY_SEQUENCE.length) playAt(index + 1);
    else {
      playing = false;
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
  /**
   * Panggil SINKRON di dalam handler klik/submit login (sebelum await) untuk
   * "membuka kunci" audio: putar senyap sesaat lalu jeda. Setelah login sukses,
   * start() bisa memutar suara walau request login memakan waktu lama.
   */
  prime() {
    const first = BOOSTY_SEQUENCE[0];
    if (!first || playing) return;
    const a = getEl();
    const token = ++primeToken;
    a.muted = true;
    if (!a.src.endsWith(first.src)) a.src = first.src;
    a.play()
      .then(() => {
        // jangan ganggu bila start() sudah memutar suara sungguhan
        if (token === primeToken && !playing) {
          a.pause();
          a.currentTime = 0;
        }
      })
      .catch(() => { /* diblokir: start() akan memakai retryOnGesture */ });
  },
  /** Mulai urutan dari awal (sapaan -> info reseller). */
  start() {
    primeToken++;
    playAt(0);
  },
  /** Hentikan & kosongkan subtitle. */
  stop() {
    primeToken++;
    clearAudio();
    if (el) el.muted = false;
    set({ voice: null, subtitle: '', blocked: false });
  },
  isActive() {
    return state.voice !== null;
  },
};
