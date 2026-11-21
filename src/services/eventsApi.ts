import { MAIN_API } from '../lib/apiBase';
export type EventStatus = 'upcoming' | 'ongoing' | 'finished';
export interface SiteEvent { id: number; title: string; description: string; kind: 'standard' | 'countdown' | 'game' | 'streak'; status: EventStatus; effective_status: EventStatus; starts_at: string | null; ends_at: string | null }
export type EventInput = Omit<SiteEvent, 'id' | 'effective_status'> & { id?: number };
async function call(action?: string, event?: EventInput): Promise<{ok: boolean; message?: string; events?: SiteEvent[]; server_time?: string}> {
  try {
    const res = await fetch(`${MAIN_API}/events.php`, action ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({action,event,token:localStorage.getItem('token') || ''}) } : {cache:'no-store'});
    const data = await res.json();
    return res.ok ? data : {ok:false,message:data.message || 'Gagal memuat event.'};
  } catch { return {ok:false,message:'Tidak dapat menghubungi API Event. Silakan coba lagi.'}; }
}
export const eventsApi = { list: () => call(), adminList: () => call('list'), save: (event: EventInput) => call('save',event) };
export const EVENT_LABEL: Record<EventStatus,string> = {upcoming:'Akan hadir',ongoing:'Berlangsung',finished:'Selesai'};
export function remaining(end: string | null, now: number) {
  const seconds = Math.max(0,Math.ceil(((end ? Date.parse(end) : now)-now)/1000));
  return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}

export function eventStatus(e: SiteEvent, now: number): EventStatus {
  if (e.status === 'finished') return 'finished';
  if (e.ends_at && Date.parse(e.ends_at) <= now) return 'finished';
  if (e.starts_at) return Date.parse(e.starts_at) > now ? 'upcoming' : 'ongoing';
  return e.effective_status;
}
