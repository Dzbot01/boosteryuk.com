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
const subs = new Set<() => void>();

function emit() {
  subs.forEach((fn) => fn());
}

function set(patch: Partial<BoostyVoiceState>) {
  state = { ...state, ...patch };
  emit();
}

function clearAudio() {
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.ontimeupdate = null;
    audio = null;
  }
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
  a.play().then(() => set({ blocked: false })).catch(() => set({ blocked: true }));
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
