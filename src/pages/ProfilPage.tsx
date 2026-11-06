import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  Check,
  LogOut,
  Mail,
  Phone,
  Clock,
  Hash,
  ShieldCheck,
  KeyRound,
  Pencil,
  Package,
  PackageCheck,
  RefreshCw,
  Wallet,
  Crown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfilPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  if (!user) return null;

  const copyId = () => {
    navigator.clipboard?.writeText(String(user.id)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  const stats = [
    { icon: Package, label: 'Total pesanan', value: '142' },
    { icon: PackageCheck, label: 'Selesai', value: '128' },
    { icon: RefreshCw, label: 'Refill', value: '9' },
    { icon: Wallet, label: 'Saldo', value: 'Rp 248rb' },
  ];

  const details = [
    { icon: Hash, label: 'ID Pengguna', value: user.id, action: true },
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'WhatsApp', value: user.phone },
    { icon: Clock, label: 'Zona waktu', value: user.timezone },
  ];

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Kembali
      </button>

      {/* Identity card */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.3)] dark:border-slate-700/60 dark:bg-slate-800/80 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-cyan-700 font-display text-2xl font-extrabold text-white shadow-lg shadow-cyan-600/30">
            {user.initials}
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-cyan-600 shadow ring-2 ring-white dark:bg-slate-800 dark:ring-slate-800">
              <BadgeCheck className="h-4 w-4" strokeWidth={2.6} />
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[24px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[28px]">
                {user.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-[10.5px] font-bold text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50">
                <BadgeCheck className="h-3 w-3" strokeWidth={2.6} />
                Google
              </span>
              {user.plusActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-2.5 py-1 text-[10.5px] font-black text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400">
                  <Crown className="h-3.5 w-3.5 fill-slate-950" strokeWidth={1.5} />
                  VIP PLUS
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{user.email}</p>
            <p className="mt-0.5 text-[11.5px] font-semibold text-slate-400 dark:text-slate-500">
              Bergabung {user.joined}
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 transition-colors hover:bg-cyan-50/60 dark:bg-slate-700/30 dark:ring-slate-700 dark:hover:bg-cyan-900/20"
            >
              <s.icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              <p className="mt-2 font-display text-lg font-extrabold leading-none text-slate-900 dark:text-white">
                {s.value}
              </p>
              <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {user.plusActive && (
        <div className="mt-5 flex items-center gap-3.5 rounded-[22px] border border-amber-300/70 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 p-4 shadow-lg shadow-amber-500/10 dark:border-amber-500/40">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-md">
            <Crown className="h-6 w-6 fill-slate-950" strokeWidth={2.2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display text-[15px] font-black tracking-tight text-amber-900 dark:text-amber-300">
                Boosteryuk Plus Member VIP
              </p>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">
                Aktif
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-amber-800/80 dark:text-amber-400/90">
              Harga murah Rp 1.000/1K &amp; benefit premium aktif selamanya.
            </p>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
        {details.map((d, i) => (
          <div
            key={d.label}
            className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
              i > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              <d.icon className="h-4 w-4" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {d.label}
              </p>
              <p className="truncate text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
                {d.value}
              </p>
            </div>
            {d.action && (
              <button
                onClick={copyId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:border-cyan-300 hover:text-cyan-700 active:scale-95 dark:border-slate-600 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Security */}
      <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
        <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
          Keamanan
        </p>

        <div className="flex items-center gap-4 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
              Verifikasi dua langkah
            </p>
            <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
              Tambahkan lapisan keamanan ekstra
            </p>
          </div>
          <button
            role="switch"
            aria-checked={twoFactor}
            onClick={() => setTwoFactor(!twoFactor)}
            className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-300 ${
              twoFactor ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-slate-900 ${
                twoFactor ? 'left-[23px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        <button className="flex w-full items-center gap-4 border-t border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            <KeyRound className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
              Kelola sandi aplikasi
            </span>
            <span className="block text-[11.5px] text-slate-400 dark:text-slate-500">
              Diperbarui 3 bulan lalu
            </span>
          </span>
          <Pencil className="h-3.5 w-3.5 text-slate-400 dark:text-slate-400" />
        </button>
      </div>

      {/* Actions */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => navigate('/payment')}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99]"
        >
          <Wallet className="h-4 w-4" strokeWidth={2.3} />
          Kelola Pembayaran
        </button>
        <button
          onClick={logout}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/60 text-[13.5px] font-bold text-rose-700 transition-all hover:bg-rose-100 active:scale-[0.99] dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/35"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.3} />
          Keluar dari akun
        </button>
      </div>
    </div>
  );
}
