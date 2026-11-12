import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Server, Bot, ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import { useOrderHistory } from '../context/OrderHistoryContext';
import { useSiteSettings } from '../context/SiteSettingsContext';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrderHistory();
  const { settings } = useSiteSettings();

  const firstName = user?.username?.split(' ')[0] || user?.email?.split('@')[0] || 'Bos';

  const stats = useMemo(() => {
    let booster = 0;
    let vps = 0;
    let agen = 0;
    for (const o of orders) {
      const n = (o.serviceName || '').toLowerCase();
      if (n.includes('agen ai')) agen += 1;
      else if (n.includes('vps')) vps += 1;
      else booster += 1;
    }
    return { booster, vps, agen };
  }, [orders]);

  const cards = [
    { label: 'Total Pesanan Booster', value: stats.booster, icon: ShoppingBag, to: '/layanan', accent: 'text-cyan-600 dark:text-cyan-400', ring: 'bg-cyan-500/10' },
    { label: 'VPS Aktif', value: stats.vps, icon: Server, to: '/ordervps', accent: 'text-violet-600 dark:text-violet-400', ring: 'bg-violet-500/10' },
    { label: 'Agen AI Aktif', value: stats.agen, icon: Bot, to: '/sewa-agen-ai', accent: 'text-emerald-600 dark:text-emerald-400', ring: 'bg-emerald-500/10' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6">
      <Seo title="Overview" description="Ringkasan akun Boosteryuk: pesanan booster, VPS, dan Agen AI." noindex />

      <Reveal>
        <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">Halo, {firstName} 👋</p>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900 sm:text-[30px] dark:text-white">Overview</h1>
      </Reveal>

      {/* ===== Grid statistik ===== */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Reveal key={c.label} delay={i * 60}>
              <button
                onClick={() => navigate(c.to)}
                className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.ring} ${c.accent}`}>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className={`mt-4 font-display text-[34px] font-extrabold leading-none ${c.accent}`}>{c.value}</span>
                <span className="mt-1.5 text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">{c.label}</span>
              </button>
            </Reveal>
          );
        })}
      </div>

      {/* ===== Kartu informasi (teks diatur admin) ===== */}
      <Reveal delay={200}>
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500" />
          <div className="p-6 sm:p-7">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              {settings.overviewTitle}
            </h2>
            <p className="mt-1 text-[13.5px] font-semibold text-cyan-600 dark:text-cyan-400">{settings.overviewSubtitle}</p>
            <p className="mt-4 whitespace-pre-line text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
              {settings.overviewMessage}
            </p>
            <button
              onClick={() => navigate('/layanan')}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-600 px-5 text-[13.5px] font-bold text-white shadow-md shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-[0.99]"
            >
              Mulai Pesanan
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
