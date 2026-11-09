import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Clock,
  Zap,
  Copy,
  Check,
  Send,
  ArrowUpRight,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Reveal from '../components/Reveal';
import {
  ADMIN_EMAIL,
  ADMIN_WHATSAPP,
  ADMIN_WHATSAPP_INTL,
  socialIconUrl,
} from '../constants';

export default function HubungiPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied(null), 1600);
      },
      () => {},
    );
  };

  const channels = [
    {
      key: 'wa',
      label: 'WhatsApp',
      value: ADMIN_WHATSAPP,
      desc: 'Chat langsung dengan admin',
      href: `https://wa.me/${ADMIN_WHATSAPP_INTL}`,
      iconSrc: socialIconUrl('whatsapp', '25D366'),
      cta: 'Buka chat',
      accent:
        'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/15',
      ctaCls:
        'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 text-white',
    },
    {
      key: 'mail',
      label: 'Email',
      value: ADMIN_EMAIL,
      desc: 'Untuk komplain & bukti pembayaran',
      href: `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(
        'Konfirmasi Pembayaran — Boosteryuk',
      )}`,
      iconSrc: null,
      icon: Mail,
      cta: 'Kirim email',
      accent: 'border-cyan-200 bg-cyan-50/50 dark:border-cyan-800/40 dark:bg-cyan-900/15',
      ctaCls: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/25 text-white',
    },
  ];

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {/* ---------- Title block ---------- */}
      <Reveal delay={40}>
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-6 shadow-[0_24px_60px_-30px_rgba(8,51,68,0.85)] sm:p-7">
          <div className="bg-dots absolute inset-0 opacity-20" />
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20">
                <Phone className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-white sm:text-[30px]">
                Hubungi Admin
              </h1>
            </div>
            <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-cyan-100/70">
              Perlu bantuan soal pesanan, pembayaran, atau refill? Tim kami siap membantu setiap
              hari.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11.5px] font-bold text-cyan-50 ring-1 ring-white/15">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
                Respon &lt; 5 menit
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[11.5px] font-bold text-cyan-50 ring-1 ring-white/15">
                <Zap className="h-3.5 w-3.5" strokeWidth={2.4} />
                Online 24/7
              </span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------- Channels ---------- */}
      <div className="mt-5 space-y-4">
        {channels.map((c, i) => {
          const Icon = c.icon as React.ComponentType<{ className?: string; strokeWidth?: number }>;
          return (
            <Reveal key={c.key} delay={110 + i * 60}>
              <div
                className={`overflow-hidden rounded-[28px] border bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/5 dark:bg-slate-800/80 ${c.accent}`}
              >
                <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:ring-slate-700">
                    {c.iconSrc ? (
                      <img src={c.iconSrc} alt={c.label} className="h-7 w-7 object-contain" />
                    ) : (
                      <Icon className="h-7 w-7 text-cyan-600 dark:text-cyan-400" strokeWidth={1.9} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      {c.label}
                    </p>
                    <p className="mt-1 break-all font-mono text-[17px] font-extrabold leading-tight text-slate-900 dark:text-white sm:text-[19px]">
                      {c.value}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{c.desc}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 border-t border-slate-200/70 px-5 py-4 dark:border-slate-700/50 sm:flex-row sm:px-6">
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-bold shadow-lg transition-all hover:shadow-xl active:scale-[0.99] ${c.ctaCls}`}
                  >
                    {c.cta}
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      strokeWidth={2.5}
                    />
                  </a>
                  <button
                    onClick={() => copy(c.value)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {copied === c.value ? (
                      <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.6} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={2.3} />
                    )}
                    {copied === c.value ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* ---------- Tip ---------- */}
      <Reveal delay={260}>
        <div className="mt-5 flex items-start gap-4 rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700/50 dark:bg-slate-800/30">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-slate-800 dark:text-slate-200">
              Sertakan ID pesanan saat menghubungi kami
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Agar admin dapat langsung memeriksa status pesanan Anda tanpa perlu bertanya ulang.
              Lampirkan juga bukti transfer bila terkait pembayaran.
            </p>
          </div>
        </div>
      </Reveal>

      {/* ---------- Quick actions ---------- */}
      <Reveal delay={320}>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href={`https://wa.me/${ADMIN_WHATSAPP_INTL}?text=${encodeURIComponent(
              'Halo admin, saya ingin konfirmasi pembayaran.',
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-[13px] font-bold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.99] dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/35"
          >
            <Send className="h-4 w-4" strokeWidth={2.3} />
            Konfirmasi pembayaran
          </a>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(
              'Keluhan Pesanan — Boosteryuk',
            )}`}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2.3} />
            Ajukan keluhan
          </a>
        </div>
      </Reveal>
    </div>
  );
}
