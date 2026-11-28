import AvatarPicker from '../components/AvatarPicker';
import OwnedTitles from '../components/OwnedTitles';
import TikTokAnalytics from '../components/TikTokAnalytics';
import PengaturanAkunPage from './PengaturanAkunPage';
import Seo from '../components/Seo';
import UserAvatar from '../components/UserAvatar';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  Crown,
  Hash,
  LogOut,
  Mail,
  Receipt,
  Send,
  Settings,
  User,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrderHistory } from '../context/OrderHistoryContext';
import { formatRupiah } from '../constants';

/** Versi app yang ditampilkan pada baris "Versi App" (variabel — mudah dinaikkan). */
const VERSI_APP = '6.1.4';

/**
 * Samarkan nomor/teks di tengah: "082212347543" → "0822••••7543".
 * Empat karakter pertama & terakhir tetap terlihat supaya user yakin itu nomornya.
 */
export function samarkanTengah(nilai: string): string {
  const s = (nilai || '').trim();
  if (!s) return '';
  if (s.length <= 8) return s.replace(/.(?=.{2})/g, '•');
  return `${s.slice(0, 4)}${'•'.repeat(Math.max(4, s.length - 8))}${s.slice(-4)}`;
}

/** Baris menu dalam card: ikon berwarna + label + nilai/chevron, ada efek tekan. */
function BarisMenu({
  ikon: Ikon,
  warnaIkon,
  latarIkon,
  label,
  nilai,
  to,
  onClick,
  chevron = true,
}: {
  ikon: typeof Wallet;
  warnaIkon: string;
  latarIkon: string;
  label: string;
  nilai?: string;
  to?: string;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const isi = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${latarIkon}`}>
        <Ikon className={`h-[18px] w-[18px] ${warnaIkon}`} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{label}</span>
      {nilai ? <span className="shrink-0 text-[12.5px] font-semibold text-slate-400">{nilai}</span> : null}
      {chevron ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2.4} /> : null}
    </>
  );
  const kelas =
    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[0.99] active:bg-slate-50 dark:active:bg-slate-800';
  return to ? (
    <Link to={to} className={kelas}>{isi}</Link>
  ) : (
    <button type="button" onClick={onClick} className={kelas}>{isi}</button>
  );
}

/**
 * Halaman Profil User — UI mobile-first (360–414px), gradient ungu + card rounded.
 * Fungsi lama tetap ada: salin ID akun, email, saldo, avatar picker, judul dimiliki,
 * analitik TikTok, isi saldo, keluar, dan Pengaturan Akun (ubah profil, verifikasi
 * email OTP, ubah/reset password) yang ter-embed di bagian bawah.
 */
export default function ProfilPage() {
  const { user, logout } = useAuth();
  const { orders } = useOrderHistory();
  const { hash } = useLocation();
  const [copied, setCopied] = useState(false);

  // Gulir ke blok Pengaturan Akun bila dibuka lewat /pengaturan-akun (redirect ke /profil#pengaturan-akun).
  useEffect(() => {
    if (hash === '#pengaturan-akun') document.getElementById('pengaturan-akun')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  // Pengeluaran = total harga pesanan yang tidak batal; Pemasukan = total saldo user.
  const pengeluaran = useMemo(
    () => orders.filter((o) => o.status !== 'batal').reduce((sum, o) => sum + (Number(o.price) || 0), 0),
    [orders],
  );

  if (!user) return null;

  const saldo = Number(user.balance) || 0;
  const pemasukan = saldo;
  const foto = user.picture && /^https:\/\//i.test(user.picture) ? user.picture : '';
  const telepon = samarkanTengah(user.phone || '');
  const trial = !!user.plan?.plus_trial_active && !user.plan.plus_permanent && !user.plan.extra_active;
  const until = user.plan?.plus_trial_until;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(user.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard ditolak browser */ }
  };

  const bukaPengaturan = () => document.getElementById('pengaturan-akun')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-[100px] dark:bg-slate-950">
      <Seo title="Akun Saya" description="Profil akun, saldo, riwayat pesanan, dan pengaturan keamanan." noindex />

      {/* ============ HEADER UNGU ============ */}
      <header
        className="relative overflow-hidden px-4 pb-8 pt-6 text-center"
        style={{ background: 'linear-gradient(160deg,#5B21B6 0%,#7C3AED 100%)' }}
      >
        {/* Pola gelombang halus ungu lebih terang di bagian bawah */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,64 C240,112 480,8 720,48 C960,88 1200,18 1440,64 L1440,120 L0,120 Z" fill="#8B5CF6" opacity="0.45" />
          <path d="M0,88 C260,126 520,46 780,74 C1040,102 1220,56 1440,90 L1440,120 L0,120 Z" fill="#A78BFA" opacity="0.4" />
        </svg>

        {/* Modul "Akun Saya" + ikon avatar: satu kesatuan baris, diposisikan di tengah. */}
        <div className="relative mx-auto mt-2 flex w-fit max-w-full items-center gap-3.5 text-left">
          {/* Avatar bulat ±64px, border putih tebal; tanpa foto → ikon user abu-abu di latar putih */}
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-lg shadow-violet-900/20">
            {foto ? (
              <img src={foto} alt={`Foto profil ${user.name}`} className="h-full w-full object-cover" />
            ) : (
              <UserAvatar user={user} fallbackClassName="bg-white">
                <User className="h-7 w-7 text-slate-400" strokeWidth={2} />
              </UserAvatar>
            )}
          </span>

          <span className="min-w-0">
            <h1 className="font-display text-[17px] font-extrabold tracking-tight text-white">Akun Saya</h1>

            {/* Nama + titik hijau indikator akun aktif */}
            <p className="mt-0.5 flex items-center gap-1.5 text-[15px] font-extrabold text-white">
              <span className="max-w-[220px] truncate">{user.name}</span>
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E] ring-2 ring-white/40" aria-label="Akun aktif" />
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-white/85">{telepon || `@${user.username}`}</p>

            {user.plusActive && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold text-white ring-1 ring-white/30">
                <Crown className="h-3.5 w-3.5" strokeWidth={2.3} />
                {trial ? 'PLUS TRIAL' : 'VIP PLUS'}
                {trial && until ? (
                  <span className="font-medium opacity-85">
                    sampai {new Date(until).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
                  </span>
                ) : null}
              </span>
            )}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl">
        {/* Desktop: semua card menyatu jadi SATU card besar; mobile tetap card terpisah. */}
        <div className="md:mt-8 md:rounded-3xl md:bg-white md:p-6 md:shadow-[0_18px_50px_-30px_rgba(76,29,149,0.45)] md:dark:bg-slate-900">
        {/* ============ CARD 1: RINGKASAN + SALDO (di bawah header, tidak tertutup) ============ */}
        <section className="mt-6 rounded-2xl bg-white p-4 shadow-[0_10px_30px_-12px_rgba(76,29,149,0.35)] dark:bg-slate-900 md:mt-0 md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:dark:bg-transparent">
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-2.5 pr-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22C55E]">
                <ArrowUp className="h-[18px] w-[18px] text-white" strokeWidth={2.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">Pemasukan</span>
                <span className="block truncate text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">{formatRupiah(pemasukan)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 pl-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]">
                <ArrowDown className="h-[18px] w-[18px] text-white" strokeWidth={2.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">Pengeluaran</span>
                <span className="block truncate text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">{formatRupiah(pengeluaran)}</span>
              </span>
            </div>
          </div>

          <div className="my-3 border-t border-slate-100 dark:border-slate-800" />

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <BarisMenu
              ikon={Wallet}
              warnaIkon="text-violet-600 dark:text-violet-400"
              latarIkon="bg-violet-50 dark:bg-violet-900/25"
              label="Saldo"
              to="/payment"
              nilai={formatRupiah(saldo)}
            />
            <BarisMenu
              ikon={CreditCard}
              warnaIkon="text-amber-600"
              latarIkon="bg-amber-50 dark:bg-amber-900/25"
              label="Kartu Saya"
              to="/deposit"
            />
          </div>
        </section>

        {/* ============ CARD 2: MENU UTAMA ============ */}
        <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] dark:bg-slate-900 md:mt-6 md:rounded-none md:bg-transparent md:shadow-none md:dark:bg-transparent md:border-t md:border-slate-100 md:pt-6 md:dark:border-slate-800 md:overflow-visible">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <BarisMenu ikon={Send} warnaIkon="text-emerald-600" latarIkon="bg-emerald-50 dark:bg-emerald-900/25" label="Transfer" to="/payment" />
            <BarisMenu ikon={Receipt} warnaIkon="text-rose-600" latarIkon="bg-rose-50 dark:bg-rose-900/25" label="Riwayat" to="/riwayat-pesanan" />
          </div>
        </section>

        {/* ============ CARD 3: PENGATURAN ============ */}
        <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] dark:bg-slate-900 md:mt-6 md:rounded-none md:bg-transparent md:shadow-none md:dark:bg-transparent md:border-t md:border-slate-100 md:pt-6 md:dark:border-slate-800 md:overflow-visible">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <BarisMenu ikon={Settings} warnaIkon="text-violet-600 dark:text-violet-400" latarIkon="bg-violet-50 dark:bg-violet-900/25" label="Pengaturan Profil" onClick={bukaPengaturan} />
            <BarisMenu ikon={Hash} warnaIkon="text-slate-500" latarIkon="bg-slate-100 dark:bg-slate-800" label="Versi App" nilai={VERSI_APP} chevron={false} />
          </div>
        </section>

        {/* ============ CARD 4: DATA AKUN (fitur lama dipertahankan) ============ */}
        <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] dark:bg-slate-900 md:mt-6 md:rounded-none md:bg-transparent md:shadow-none md:dark:bg-transparent md:border-t md:border-slate-100 md:pt-6 md:dark:border-slate-800 md:overflow-visible">
          <p className="border-b border-slate-100 px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800">
            Data Akun
          </p>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/25">
                <Hash className="h-[18px] w-[18px] text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 text-[13px] text-slate-600 dark:text-slate-300">
                ID akun <strong className="font-bold text-slate-800 dark:text-slate-100">{user.id}</strong>
              </span>
              <button
                type="button"
                onClick={() => void copyId()}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:text-slate-300"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/25">
                <Mail className="h-[18px] w-[18px] text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600 dark:text-slate-300">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/25">
                <UserRound className="h-[18px] w-[18px] text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600 dark:text-slate-300">
                @{user.username} · bergabung {user.joined}
              </span>
            </div>
          </div>
          <div className="flex gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
            <Link
              to="/deposit"
              className="flex-1 rounded-xl bg-[#7C3AED] py-3 text-center text-[13px] font-extrabold text-white shadow-md shadow-violet-600/25 transition active:scale-[0.99]"
            >
              Isi saldo
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-[13px] font-bold text-rose-500 transition active:scale-[0.99] dark:border-rose-900/50"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </section>

        {/* ============ FITUR LAMA YANG DIPERTAHANKAN ============ */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] dark:bg-slate-900 md:mt-6 md:rounded-none md:bg-transparent md:shadow-none md:dark:bg-transparent md:border-t md:border-slate-100 md:pt-6 md:dark:border-slate-800 md:overflow-visible md:p-0">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Ikon Profil</p>
          <AvatarPicker />
        </div>
        </div>
        <TikTokAnalytics />
        <OwnedTitles />
      </div>

      {/* Pengaturan Akun (ubah profil, verifikasi email OTP, ubah/reset password) — tetap ter-embed. */}
      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl">
        <PengaturanAkunPage embedded />
      </div>
    </div>
  );
}
