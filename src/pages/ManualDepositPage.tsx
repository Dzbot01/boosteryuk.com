import { useMemo, useState } from 'react';

import {
  Check,
  Copy,
  Gift,
  MessageCircle,
  Receipt,
  Sparkles,
  User,
  Mail,
  Wallet,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import {
  QUICK_AMOUNTS,
  WHATSAPP_ADMIN,
  buildDepositWaMessage,
  formatRupiah,
  getDepositBonus,
  waLink,
} from '../constants';
import { useTripayChannels } from '../hooks/useTripayChannels';
import { channelFeeTotal } from '../services/tripay';

const LS_CUSTOMER = 'boosteryuk.deposit.customer.v1';

/** Baca profil tersimpan agar pengguna tidak mengetik ulang. */
function loadCustomer(): { username: string; email: string } {
  try {
    const raw = localStorage.getItem(LS_CUSTOMER);
    if (!raw) return { username: '', email: '' };
    const parsed = JSON.parse(raw) as { name?: string; email?: string };
    return { username: parsed.name ?? '', email: parsed.email ?? '' };
  } catch {
    return { username: '', email: '' };
  }
}

/* ============================================================
   HALAMAN BAYAR MANUAL — /deposit/manual
   Form ini TIDAK membuat invoice Tripay. Setelah semua data
   diisi, tombol mengarahkan pengguna ke WhatsApp admin dengan
   teks pesan yang sudah terisi otomatis.
   ============================================================ */
export default function ManualDepositPage() {
  const { channels } = useTripayChannels();

  const [customer, setCustomer] = useState(loadCustomer);
  const [amountText, setAmountText] = useState('');
  const [methodCode, setMethodCode] = useState('QRIS');
  const [copied, setCopied] = useState(false);

  const amount = Number(amountText) || 0;
  const bonus = Math.floor(amount * getDepositBonus('MANUAL'));
  const estimate = amount + bonus;

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.code.toUpperCase() === methodCode.toUpperCase()) ?? null,
    [channels, methodCode],
  );
  const fee = selectedChannel ? channelFeeTotal(selectedChannel, amount) : 0;

  const error = useMemo(() => {
    if (!customer.username.trim()) return 'Username wajib diisi';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim())) return 'Format email tidak valid';
    if (amount < 1000) return 'Minimal deposit Rp 1.000';
    return null;
  }, [amount, customer.email, customer.username]);

  /* Pesan WhatsApp yang akan dikirim ke admin */
  const message = buildDepositWaMessage({
    username: customer.username,
    email: customer.email,
    amount,
    methodCode,
    methodName: selectedChannel?.name,
  });

  const openWhatsApp = () => {
    try {
      localStorage.setItem(
        LS_CUSTOMER,
        JSON.stringify({ name: customer.username.trim(), email: customer.email.trim() }),
      );
    } catch {
      /* penyimpanan lokal tidak tersedia */
    }
    window.open(waLink(message), '_blank', 'noopener,noreferrer');
  };

  const inputClass =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-800 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:text-slate-100 dark:bg-slate-900 dark:border-slate-700';

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6">

      {/* Judul */}
      <Reveal delay={30}>
        <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 sm:text-[32px] dark:text-white">Bayar Manual</h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500 dark:text-slate-400">
          Isi data di bawah, lalu kirim ke WhatsApp admin untuk dikonfirmasi manual.
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[11.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
          Admin WhatsApp {WHATSAPP_ADMIN.display}
        </div>
      </Reveal>

      {/* ======================================================
          MODAL CARD UTAMA — form deposit manual
         ====================================================== */}
      <Reveal delay={90}>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_44px_-28px_rgba(15,23,42,.35)] sm:p-5 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MessageCircle className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-slate-900 dark:text-white">Deposit via Admin</p>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Diproses manual 5–30 menit oleh admin</p>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-slate-200" />

          {/* BUTTON NOMINAL CEPAT */}
          <p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Pilih nominal cepat</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((value) => {
              const active = amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmountText(String(value))}
                  className={`h-12 rounded-xl border text-[13px] font-extrabold transition-all active:scale-95 ${
                    active
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-[0_10px_24px_-16px_rgba(72,198,229,1)] dark:bg-cyan-950/40'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/40 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700'
                  }`}
                >
                  Rp. {value.toLocaleString('id-ID')}
                </button>
              );
            })}
          </div>

          {/* INPUT NOMINAL (angka saja) */}
          <label htmlFor="manual-amount" className="mb-1.5 mt-5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            Nominal deposit
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] font-bold text-slate-400 dark:text-slate-400">
              Rp
            </span>
            <input
              id="manual-amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
              placeholder="Masukkan nominal"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3.5 font-mono text-[15px] font-bold text-slate-900 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:text-white dark:bg-slate-900 dark:border-slate-700"
            />
          </div>

          {/* USERNAME & EMAIL */}
          <div className="mt-5 space-y-2.5">
            <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">Data akun</p>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" strokeWidth={2.4} />
              <input
                value={customer.username}
                onChange={(e) => setCustomer((c) => ({ ...c, username: e.target.value }))}
                placeholder="Username Boosteryuk *"
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" strokeWidth={2.4} />
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                placeholder="email@domain.com *"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>

          {/* METODE PEMBAYARAN */}
          <label htmlFor="manual-method" className="mb-1.5 mt-5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            Metode pembayaran
          </label>
          <select
            id="manual-method"
            value={methodCode}
            onChange={(e) => setMethodCode(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            {channels.map((channel) => (
              <option key={channel.code} value={channel.code}>
                {channel.name} ({channel.code.toLowerCase()})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-400">Daftar metode berasal dari channel Tripay aktif.</p>

          {/* 2 KARTU — Total Bayar & Estimasi Saldo */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/60 dark:border-slate-700">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Receipt className="h-3.5 w-3.5" strokeWidth={2.4} />
                Total Bayar
              </p>
              <p className="mt-1.5 text-[22px] font-black leading-none text-slate-900 dark:text-white">{formatRupiah(amount)}</p>
              <p className="mt-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                {fee > 0 ? `Termasuk biaya channel ${formatRupiah(fee)}` : 'Tanpa biaya channel'}
              </p>
            </div>

            <div className="rounded-xl border-2 border-cyan-400 bg-cyan-50 p-4 dark:bg-cyan-950/40">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-700">
                <Wallet className="h-3.5 w-3.5" strokeWidth={2.4} />
                Estimasi Saldo
              </p>
              <p className="mt-1.5 text-[22px] font-black leading-none text-cyan-600">{formatRupiah(estimate)}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
                <Gift className="h-3 w-3" strokeWidth={2.6} />
                Bonus {Math.round(getDepositBonus('MANUAL') * 100)}% · +{formatRupiah(bonus)}
              </p>
            </div>
          </div>

          {/* Pratinjau pesan WhatsApp */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:bg-slate-800/60 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pesan WhatsApp</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message);
                  } catch {
                    /* clipboard ditolak browser */
                  }
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold transition-all active:scale-95 ${
                  copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {copied ? <Check className="h-3 w-3" strokeWidth={3} /> : <Copy className="h-3 w-3" strokeWidth={2.6} />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {message}
            </pre>
          </div>

          {error ? (
            <p className="mt-3 text-[11.5px] font-semibold text-amber-600">{error}</p>
          ) : null}

          {/* BUTTON — redirect ke WhatsApp admin */}
          <button
            type="button"
            onClick={openWhatsApp}
            disabled={!!error}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.6} />
            Kirim ke WhatsApp Admin
          </button>

          <p className="mt-2 text-center text-[10.5px] text-slate-400 dark:text-slate-400">
            Membuka WhatsApp {WHATSAPP_ADMIN.display} dengan pesan yang sudah terisi otomatis.
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 dark:text-slate-400">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
          Saldo ditambahkan admin setelah pembayaran diverifikasi.
        </p>
      </Reveal>
    </div>
  );
}
