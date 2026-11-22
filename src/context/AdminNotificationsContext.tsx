import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { IS_CHILD_PANEL, MAIN_API } from '../lib/apiBase';
import { cleanMarkers, hasNewData, mergeSeen, seenKey, loadSeen, saveSeen, type AdminMarkers } from '../services/adminNotifications';

const EMPTY = { unread: (_path: string) => false, markRead: (_path: string) => {} };
const Context = createContext(EMPTY);
export const useAdminNotifications = () => useContext(Context);

/** One polling feed shared by sidebar and dashboard; no user/child-panel polling. */
export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const token = user?.token;
  const owner = isAdmin && !IS_CHILD_PANEL && token ? String(user.id) : '';
  const [data, setData] = useState<{ owner: string; latest: AdminMarkers; seen: AdminMarkers }>({ owner: '', latest: {}, seen: {} });
  const refs = useRef({ owner: '', latest: {} as AdminMarkers, seen: {} as AdminMarkers, pending: new Set<string>() });
  useEffect(() => {
    let active = true, busy = false;
    const abort = new AbortController();
    const seen = owner ? loadSeen(owner) : {};
    refs.current = { owner, latest: {}, seen, pending: new Set() };
    setData({ owner, latest: {}, seen });
    if (!owner || !token) return () => { active = false; };
    const persist = () => { refs.current.seen = saveSeen(owner, refs.current.seen); };
    const poll = async () => {
      if (busy || !active || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const response = await fetch(`${MAIN_API}/admin_data.php`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notifications', token }), signal: abort.signal });
        const result = await response.json();
        if (!active || !response.ok || !result?.ok || !result.markers) return;
        const latest = cleanMarkers(result.markers);
        refs.current.latest = latest;
        for (const path of refs.current.pending) if (latest[path]) {
          refs.current.seen = mergeSeen(refs.current.seen, path, latest[path]);refs.current.pending.delete(path);
        }
        persist();setData({ owner, latest, seen: refs.current.seen });
      } catch { /* network failure is not new data; keep the last known state */ }
      finally { busy = false; }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== seenKey(owner) || !event.newValue) return;
      try {
        const incoming = cleanMarkers(JSON.parse(event.newValue));
        for (const [path, marker] of Object.entries(incoming)) refs.current.seen = mergeSeen(refs.current.seen, path, marker);
        setData({ owner, latest: refs.current.latest, seen: refs.current.seen });
      } catch { /* ignore malformed storage */ }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 30000);
    window.addEventListener('focus', poll);document.addEventListener('visibilitychange', poll);window.addEventListener('storage', onStorage);
    return () => { active = false;abort.abort();clearInterval(timer);window.removeEventListener('focus', poll);document.removeEventListener('visibilitychange', poll);window.removeEventListener('storage', onStorage); };
  }, [owner, token]);
  const markRead = (path: string) => {
    const ref = refs.current;
    if (!owner || ref.owner !== owner) return;
    if (!ref.latest[path]) ref.pending.add(path);
    else ref.seen = mergeSeen(ref.seen, path, ref.latest[path]);
    ref.seen = saveSeen(owner, ref.seen);
    setData({ owner, latest: ref.latest, seen: ref.seen });
  };
  return <Context.Provider value={owner && owner === data.owner ? { unread: path => hasNewData(data.latest[path], data.seen[path]), markRead } : EMPTY}>{children}</Context.Provider>;
}
