import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { IS_CHILD_PANEL } from '../lib/apiBase';
import { boostyVoice } from '../services/boostyVoice';

/** Runs after redirect/session restoration too, not only the old login click. */
export default function GuriVoiceSession() {
  const { user, loading } = useAuth();
  const { voiceMode, tenant } = useSiteSettings();
  const previous = useRef('');
  useEffect(() => {
    if (loading) return;
    if (!user?.token) {
      if (previous.current) boostyVoice.stop();
      previous.current = '';
      return;
    }
    // Never play the root reseller sequence before the panel's off/welcome
    // preference has arrived. If panel config fails, remain silent.
    if (IS_CHILD_PANEL && !tenant) return;
    const key = `${user.token}:${voiceMode}`;
    if (previous.current === key) return;
    previous.current = key;
    boostyVoice.start(voiceMode);
    // No stop on effect cleanup: StrictMode replay / user refresh must not
    // cancel a successful greeting. Logout already stops the global player.
  }, [loading, user?.token, voiceMode, tenant]);
  return null;
}
