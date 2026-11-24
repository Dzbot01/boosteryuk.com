import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { IS_CHILD_PANEL } from '../lib/apiBase';
import { boostyVoice } from '../services/boostyVoice';

const JUST_LOGIN_KEY = 'by-just-logged-in';
/** Suara hanya boleh mulai sesaat setelah login (mis. selesai alur redirect Google). */
const JUST_LOGIN_WINDOW_MS = 2 * 60 * 1000;

/**
 * Ambil & hapus penanda "baru selesai login". Mengembalikan false pada
 * refresh/pemulihan sesi/kunjungan berikutnya sehingga audio tidak play ulang.
 */
function consumeJustLoggedIn(): boolean {
  try {
    const raw = sessionStorage.getItem(JUST_LOGIN_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(JUST_LOGIN_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < JUST_LOGIN_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Memutar sapaan Guri Booster HANYA saat user baru selesai login (penanda sesi
 * diset oleh AuthContext.login/loginWithGoogle). Pemulihan sesi, refresh, atau
 * klik area kosong di dalam website tidak lagi memicu audio.
 */
export default function GuriVoiceSession() {
  const { user, loading } = useAuth();
  const { voiceMode, tenant } = useSiteSettings();
  const greetedToken = useRef('');
  useEffect(() => {
    if (loading) return;
    if (!user?.token) {
      if (greetedToken.current) boostyVoice.stop();
      greetedToken.current = '';
      return;
    }
    // Never play the root reseller sequence before the panel's off/welcome
    // preference has arrived. If panel config fails, remain silent.
    if (IS_CHILD_PANEL && !tenant) return;
    if (greetedToken.current === user.token) return;
    // Bukan login baru (refresh/pulihkan sesi/tab lama) → jangan putar audio.
    if (!consumeJustLoggedIn()) {
      greetedToken.current = user.token;
      return;
    }
    greetedToken.current = user.token;
    boostyVoice.start(voiceMode);
    // No stop on effect cleanup: StrictMode replay / user refresh must not
    // cancel a successful greeting. Logout already stops the global player.
  }, [loading, user?.token, voiceMode, tenant]);
  return null;
}
