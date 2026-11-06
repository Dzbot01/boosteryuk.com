import { useNavigate } from 'react-router-dom';
import { Settings, Server, Shield, ArrowUpRight, DollarSign } from 'lucide-react';
import Reveal from '../../components/Reveal';
import { useAuth } from '../../context/AuthContext';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const CARDS = [
  {
    path: '/admin/profit',
    icon: DollarSign,
    title: 'My Profit',
    desc: 'Ringkasan uang masuk dari user & uang keluar ke provider.',
    color: 'from-emerald-500 to-emerald-700',
  },
  {
    path: '/admin/website',
    icon: Settings,
    title: 'Pengaturan Website',
    desc: 'Ubah logo, nama brand, footer, musik, dan papan informasi.',
    color: 'from-cyan-500 to-cyan-700',
  },
  {
    path: '/admin/server',
    icon: Server,
    title: 'Server Panel',
    desc: 'Pantau latensi ke provider API secara real-time.',
    color: 'from-slate-700 to-slate-900',
  },
];

export default function AdminHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSiteSettings();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-6 shadow-[0_24px_60px_-30px_rgba(8,51,68,0.85)] sm:p-8">
          <div className="bg-dots absolute inset-0 opacity-20" />
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20">
              <Shield className="h-7 w-7" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200/70">
                Admin Panel
              </p>
              <h1 className="mt-1 font-display text-[26px] font-extrabold leading-none tracking-tight text-white sm:text-[32px]">
                Halo, {user?.name.split(' ')[0]}
              </h1>
              <p className="mt-2 text-[13px] text-cyan-100/70">
                Kelola {settings.brandName}
                {settings.brandSuffix} dari satu tempat.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c, i) => (
          <Reveal key={c.path} delay={60 + i * 50}>
            <button
              onClick={() => navigate(c.path)}
              className="group relative w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/60 dark:bg-slate-800/80"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.color} text-white shadow-lg`}
              >
                <c.icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <h2 className="mt-4 font-display text-[18px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                {c.title}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {c.desc}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-cyan-700 dark:text-cyan-400">
                Buka
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
