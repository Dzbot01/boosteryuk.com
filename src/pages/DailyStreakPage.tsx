import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Flame, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { streakCall, streakAnimation, STREAK_ANIMATIONS, type StreakState } from '../services/streakApi';
import RewardAnimation from '../components/RewardAnimation';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import { TRIAL_AVATAR } from '../lib/avatar';
import RewardSheet from '../components/RewardSheet';

export default function DailyStreakPage() {
  const { refresh } = useAuth();
  const [state, setState] = useState<StreakState | null>(null);
  const [error, setError] = useState('');const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'success' | 'reset' | null>(null);
  const [message, setMessage] = useState('');const [clock, setClock] = useState(Date.now());
  const offset = useRef(0);const inFlight = useRef(false);const mounted = useRef(true);
  const apply = useCallback((s: StreakState) => { setState(s);offset.current = s.server_time * 1000 - Date.now();if (s.reset_notice) setNotice('reset'); }, []);
  const load = useCallback(async () => {
    try { const r = await streakCall('get');if (mounted.current) { apply(r.state);setError(''); } }
    catch(e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Gagal memuat streak.'); }
  }, [apply]);
  useEffect(() => { mounted.current = true;void load();return () => { mounted.current = false; }; }, [load]);
  useEffect(() => { const t = window.setInterval(() => setClock(Date.now()), 1000);return () => clearInterval(t); }, []);
  // Refresh at the WIB day boundary and after returning from an inactive tab.
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);
    const t = state ? window.setTimeout(() => void load(), Math.max(1000, state.next_day_at * 1000 - Date.now() - offset.current + 200)) : null;
    return () => { document.removeEventListener('visibilitychange', visible);if (t !== null) clearTimeout(t); };
  }, [state, load]);
  const claim = async () => {
    if (inFlight.current || !state?.can_claim || notice) return;
    inFlight.current = true;setBusy(true);setError('');setMessage('');
    try {
      const r = await streakCall('claim');if (!mounted.current) return;
      apply(r.state);
      if (r.state.day === 7 && r.state.claimed_today) setNotice('success');
      else setMessage(r.reward ? `Check-in berhasil! Rp${r.reward.cash} sudah masuk ke saldo website.` : 'Check-in hari ini sudah tercatat. Hadiah tidak ditambahkan ulang.');
      await refresh();
    } catch(e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Check-in belum dapat diproses.'); }
    finally { inFlight.current = false;if (mounted.current) setBusy(false); }
  };
  const closeNotice = useCallback(() => {
    if (notice === 'success') { setNotice(null);return; }
    if (notice !== 'reset' || !state || inFlight.current) return;
    inFlight.current = true;setBusy(true);
    void streakCall('ack_reset', state.reset_version).then(r => {
      if (mounted.current) { setState(r.state);setNotice(r.state.reset_notice ? 'reset' : null);setError(''); }
    }).catch(e => { if (mounted.current) setError(e instanceof Error ? e.message : 'Gagal menyimpan informasi reset.'); })
      .finally(() => { inFlight.current = false;if (mounted.current) setBusy(false); });
  }, [notice, state]);
  const remaining = state ? Math.max(0, Math.ceil((state.next_day_at * 1000 - clock - offset.current) / 1000)) : 0;
  const countdown = `${Math.floor(remaining / 3600)}j ${Math.floor(remaining % 3600 / 60)}m ${remaining % 60}d`;
  // Only success/reset notifications use a bottom sheet; check-in itself is a page.
  const noticeSheet = notice ? <RewardSheet title={notice === 'success' ? 'Selamat! PLUS TRIAL didapatkan' : 'Streak terputus'} onClose={closeNotice}>
    <div className="mx-auto h-56 w-56"><RewardAnimation key={notice} src={notice === 'success' ? STREAK_ANIMATIONS.success : STREAK_ANIMATIONS.failed} loop={notice !== 'reset'} label={notice === 'success' ? 'Hadiah Daily Streak' : 'Animasi streak terputus'} /></div>
    <p className="text-center text-lg font-extrabold">{notice === 'success' ? 'Tujuh hari, satu pencapaian hebat!' : 'Kamu melewatkan check-in harian.'}</p>
    <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">{notice === 'success' ? `Selamat mendapatkan rewards PLUS TRIAL selama 1 hari (24 jam) dan title Daily Streak! Aktif sampai ${state?.trial_until ? new Date(state.trial_until).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : 'masa aktif tercatat di profil'}. Title tetap dimiliki setelah trial berakhir.` : 'Kamu gagal mempertahankan streak. Progres telah diulang dari awal, tetapi saldo hadiah dan title yang sudah didapat tidak dihapus. Yuk mulai lagi dari hari pertama!'}</p>
    {error && <p role="alert" className="mt-3 text-rose-500">{error}</p>}
    <button disabled={busy} onClick={closeNotice} className="mt-5 w-full rounded-xl bg-violet-600 p-3 font-bold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Mengerti'}</button>
  </RewardSheet> : null;
  return <main className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6">
    <Seo title="Daily Streak" noindex/>
    <Link to="/event" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-violet-600"><ArrowLeft size={16}/> Kembali ke Event</Link>
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-orange-500">Check-in harian</p><h1 className="mt-2 text-3xl font-extrabold">Daily Streak</h1></header>
    <p className="text-sm text-slate-500">Check-in 7 hari berturut-turut. Pergantian hari pukul 00.00 WIB. Lewat satu hari, progres kembali ke awal.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-500">{error} <button onClick={() => void load()} className="underline">Coba lagi</button></p>}
    {!state ? <p className="py-8 text-center text-sm">Memuat progres dari akun…</p> : <>
      <div className="mt-4 rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50/80 to-transparent p-3 text-center dark:border-orange-900/50 dark:from-orange-950/30">
        <div className="mx-auto h-40 w-40">{state.day > 0 ? <RewardAnimation key={streakAnimation(state.day)} src={streakAnimation(state.day)} label={`Api streak hari ke-${state.day}`} /> : <Flame className="mx-auto h-full w-20 text-orange-300" />}</div>
        <p className="font-extrabold">{state.day ? `${state.day} hari menyala!` : 'Nyalakan streak pertamamu'}</p>
        <p className="mt-1 text-xs text-slate-500">{state.claimed_today ? `Check-in berikutnya dalam ${countdown}` : 'Hadiah hari ini menunggumu'}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Hadiah check-in harian">{Array.from({ length: 7 }, (_, i) => i + 1).map(day => {
        const done = day <= state.day;const next = day === state.day + 1 && state.can_claim;
        return <div key={day} className={`relative rounded-2xl border p-3 text-center ${day === 7 ? 'col-span-3 sm:col-span-2' : ''} ${done ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : next ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <p className="text-xs font-semibold text-slate-500">Hari ke-{day}</p>{day === 7 ? <div className="mx-auto my-2 h-20 w-20"><RewardAnimation src={TRIAL_AVATAR} label="Hadiah PLUS TRIAL 24 jam" /></div> : <Flame className="mx-auto my-2 h-6 w-6 text-orange-500" />}<p className="text-sm font-extrabold">{day === 7 ? 'PLUS TRIAL · 24 jam' : `Rp${day}`}</p>
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-500">{done ? <><Check size={12} />Diklaim</> : next ? 'Tersedia hari ini' : <><Lock size={10} />Terkunci</>}</p>
        </div>;
      })}</div>
      {message && <p role="status" className="mt-4 text-sm font-bold text-emerald-600">{message}</p>}
      <button disabled={!state.can_claim || busy} onClick={() => void claim()} className="mt-5 w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 p-3 font-extrabold text-white disabled:opacity-50">{busy ? 'Mengklaim…' : !state.event_active ? 'Event tidak aktif' : state.claimed_today ? 'Sudah check-in hari ini' : `Check-in hari ke-${state.day + 1}`}</button>
      <p className="mt-3 text-center text-xs text-slate-500">Hari 1–6: Rp1, Rp2, Rp3, Rp4, Rp5, dan Rp6 langsung ke saldo. Hari 7: Plus Trial 24 jam + title permanen. Siklus baru dimulai paling cepat besok.</p>
    </>}
    {noticeSheet}
  </main>;
}
