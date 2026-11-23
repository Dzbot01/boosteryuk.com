import GoogleProfileFallback from '../components/GoogleProfileFallback';
import AvatarPicker from '../components/AvatarPicker';
import UserAvatar from '../components/UserAvatar';
import OwnedTitles from '../components/OwnedTitles';
import PengaturanAkunPage from './PengaturanAkunPage';
import { useEffect, useState } from 'react';
import { Copy, Check, LogOut, Mail, Hash, Wallet, Crown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRupiah } from '../constants';

export default function ProfilPage() {
  const { user, logout } = useAuth();
  const { hash } = useLocation();
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (hash === '#pengaturan-akun') document.getElementById('pengaturan-akun')?.scrollIntoView({ behavior: 'smooth' }); }, [hash]);
  if (!user) return null;
  const trial = !!user.plan?.plus_trial_active && !user.plan.plus_permanent && !user.plan.extra_active;
  const until = user.plan?.plus_trial_until;
  const copyId = async () => {
    try { await navigator.clipboard.writeText(String(user.id));setCopied(true);window.setTimeout(() => setCopied(false), 1600); } catch { /* clipboard denied */ }
  };
  return <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-10 sm:px-6 lg:max-w-5xl lg:px-8 lg:pt-12">
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-center lg:p-10 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-32 w-32 lg:h-40 lg:w-40 items-center justify-center text-2xl font-extrabold text-white"><UserAvatar user={user}><GoogleProfileFallback key={user.picture || user.id} src={user.picture}/></UserAvatar></div>
      <h1 className="mt-4 text-2xl lg:text-3xl font-extrabold">{user.name}</h1><p className="mt-1 text-sm lg:text-base break-words text-slate-500">@{user.username} · {user.email}</p>
      <p className="mt-1 text-xs lg:text-sm text-slate-400">Bergabung {user.joined}</p>
      {user.plusActive && <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"><Crown size={18}/>{trial ? 'PLUS TRIAL' : 'VIP PLUS'}{trial && until && <span className="text-xs font-normal">sampai {new Date(until).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</span>}</div>}
      <AvatarPicker />
    </section>
    <section className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3 p-4 lg:gap-4 lg:p-6"><Hash className="text-cyan-500" size={18}/><span className="flex-1 text-sm lg:text-base">ID akun <strong>{user.id}</strong></span><button onClick={() => void copyId()} className="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs">{copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Tersalin' : 'Salin'}</button></div>
      <div className="flex items-center gap-3 p-4 lg:gap-4 lg:p-6"><Mail className="text-cyan-500" size={18}/><span className="truncate text-sm lg:text-base">{user.email}</span></div>
      <div className="flex items-center gap-3 p-4 lg:gap-4 lg:p-6"><Wallet className="text-cyan-500" size={18}/><span className="flex-1 text-sm lg:text-base">Saldo website</span><strong>{formatRupiah(user.balance || 0)}</strong></div>
    </section>
    <OwnedTitles />
    <div className="mt-5 flex gap-3"><Link to="/deposit" className="flex-1 rounded-xl bg-cyan-600 p-3 text-center text-sm lg:p-4 lg:text-base font-bold text-white">Isi saldo</Link><button onClick={logout} className="flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm lg:px-6 lg:py-4 lg:text-base text-rose-500"><LogOut size={16}/> Keluar</button></div>
    <PengaturanAkunPage embedded />
  </div>;
}
