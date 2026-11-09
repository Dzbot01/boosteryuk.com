// Suara + subtitle Boosty AI (ElevenLabs "Kak Ceria").
// Cue diambil persis dari file .srt agar subtitle tersinkron dengan audio.
import welcomeUrl from '../assets/boosty-welcome.mp3';
import resellerUrl from '../assets/boosty-reseller.mp3';

export interface VoiceCue {
  /** Mulai (detik). */
  start: number;
  /** Selesai (detik). */
  end: number;
  text: string;
}

export interface BoostyVoice {
  id: string;
  src: string;
  /** Kalimat ringkas untuk header saat suara ini diputar. */
  label: string;
  cues: VoiceCue[];
}

export const BOOSTY_WELCOME: BoostyVoice = {
  id: 'welcome',
  src: welcomeUrl,
  label: 'Sapaan Boosty',
  cues: [
    { start: 0.12, end: 5.22, text: 'Haii! Selamat datang di website boosteryuk.com. Lagi cari apa nih hari' },
    { start: 5.22, end: 11.56, text: 'ini? VPS? Awet? Harga terjangkau? Ada! Booster sosial media? Ada!' },
    { start: 11.9, end: 16.98, text: 'Semuanya ada dalam satu platform Booster Yuk! Kalau butuh bantuan, hubungi aku di' },
    { start: 16.98, end: 20.4, text: 'menu tiket bantuan, ya. Semoga harimu menyenangkan.' },
  ],
};

export const BOOSTY_RESELLER: BoostyVoice = {
  id: 'reseller',
  src: resellerUrl,
  label: 'Info Reseller',
  cues: [
    { start: 0.1, end: 4.92, text: 'Hei, kamu! Iya, kamu! Waktunya jadi reseller Booster Yuk! Dapatkan harga' },
    { start: 4.92, end: 9.42, text: 'termurah dari harga non-reseller untuk menghasilkan margin lebih besar. Kamu akan' },
    { start: 9.42, end: 13.32, text: 'mendapatkan child panel dengan fitur reseller lengkap di update mendatang jika' },
    { start: 13.32, end: 17.2, text: 'bergabung menjadi reseller Booster Yuk! Jadi, tunggu apa lagi?' },
  ],
};

/** Urutan putar otomatis saat pertama login: sapaan lalu info reseller. */
export const BOOSTY_SEQUENCE: BoostyVoice[] = [BOOSTY_WELCOME, BOOSTY_RESELLER];
