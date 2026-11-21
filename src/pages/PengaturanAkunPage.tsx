import AvatarPicker from '../components/AvatarPicker';
import UserAvatar from '../components/UserAvatar';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtpEmail, genOtp, otpVerifRateCheck, otpVerifRateRecord, otpVerifRateStatus, fmtCooldown } from '../services/otp';
import {
  User,
  Mail,
  AtSign,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  Save,
  ShieldAlert,
  KeySquare,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';

export default function PengaturanAkunPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwError, setPwError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email verification
  const [emailVerified, setEmailVerified] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifSuccess, setVerifSuccess] = useState(false);
  const [verifError, setVerifError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  // Cooldown progresif untuk tombol 'Verifikasi' (ke-2→1 mnt, ke-3→5 mnt, ke-4→30 mnt, ke-5+→24 jam)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const sentCode = useRef<string | null>(null);
  const sentAt = useRef<number>(0);

  // Minta OTP verifikasi email ke email user yang terdaftar (via worker Resend).
  // Cooldown progresif berlaku di sini: semakin sering diminta, semakin lama tunggunya.
  const requestEmailOtp = async () => {
    setVerifError('');
    if (!user?.email) { setVerifError('Email tidak ditemukan.'); return; }
    const gate = otpVerifRateCheck(user.email);
    if (!gate.allowed) {
      setCooldownUntil(gate.blockedUntil ?? null);
      setVerifError(gate.message || 'Terlalu banyak permintaan OTP. Coba lagi nanti.');
      return;
    }
    setOtpSending(true);
    const code = genOtp();
    const r = await sendOtpEmail(user.email, code);
    setOtpSending(false);
    setShowOtp(true);
    if (r.ok) {
      sentCode.current = code;
      sentAt.current = Date.now();
      const rl = otpVerifRateRecord(user.email);
      setCooldownUntil(rl.blockedUntil > Date.now() ? rl.blockedUntil : null);
    } else {
      setVerifError(r.error || 'Gagal mengirim OTP.');
    }
  };

  // Muat sisa cooldown dari localStorage saat halaman dibuka / email berubah (tahan reload).
  useEffect(() => {
    if (!user?.email) return;
    const st = otpVerifRateStatus(user.email);
    setCooldownUntil(st.blockedUntil > Date.now() ? st.blockedUntil : null);
  }, [user?.email]);

  // Tick tiap detik selama cooldown aktif; berhenti sendiri saat habis.
  useEffect(() => {
    if (!cooldownUntil) return;
    setCooldownTick(Date.now());
    const t = window.setInterval(() => setCooldownTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [cooldownUntil]);
  useEffect(() => {
    if (cooldownUntil && cooldownTick >= cooldownUntil) setCooldownUntil(null);
  }, [cooldownTick, cooldownUntil]);

  const cooldownLeft = cooldownUntil ? Math.max(0, cooldownUntil - cooldownTick) : 0;

  // Sync form dengan data user dari context/API
  useEffect(() => {
    if (user) {
      setName(user.name?? '');
      setUsername(user.username?? '');
      setEmail(user.email?? '');
      setEmailVerified(user.email_verified?? false);
    }
  }, [user]);

  // Redirect kalau belum login. JANGAN langsung di render
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) return null; // biar ga render dulu pas loading

  const saveProfile = async () => {
    setLoading(true);
    const res = await updateUser({
      name: name.trim() || user.name,
      username: username.trim() || user.username,
      email: email.trim() || user.email
    });
    setLoading(false);
    if(res?.ok){
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    }
  };

  const changePassword = async () => {
    setPwError('');
    if (!emailVerified) {
      setPwError('Verifikasi email dulu untuk ubah password.');
      return;
    }
    if (password.length < 6) {
      setPwError('Password minimal 6 karakter.');
      return;
    }
    if (password!== confirm) {
      setPwError('Konfirmasi password tidak cocok.');
      return;
    }
    setLoading(true);
    const res = await updateUser({ password });
    setLoading(false);
    if(res?.ok){
      setPassword('');
      setConfirm('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } else {
      setPwError(res?.message || 'Gagal ubah password');
    }
  };

  const verifyOtp = () => {
    setVerifError('');
    if (!otp.trim()) {
      setVerifError('Masukkan kode OTP yang dikirim ke email Anda.');
      return;
    }
    if (!sentCode.current || otp.trim() !== sentCode.current) {
      setVerifError('Kode OTP salah.');
      return;
    }
    if (Date.now() - sentAt.current > 10 * 60_000) {
      setVerifError('Kode OTP kedaluwarsa, minta ulang.');
      return;
    }
    setVerifSuccess(true);
    setEmailVerified(true);
    setShowOtp(false);
    setOtp('');
  };

  return (
    <div id="pengaturan-akun" className={embedded ? "mt-8 border-t border-slate-200 pt-8 dark:border-slate-700" : "page-align-left mx-auto max-w-2xl px-4 py-10 sm:px-6"}>

      <Reveal delay={40}>
        <div className="flex items-center gap-3.5">
          {!embedded && <span className="flex h-14 w-14 items-center justify-center font-display text-lg font-extrabold text-white">
            <UserAvatar user={user} fallbackClassName="rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-lg shadow-cyan-600/25">{user?.initials?? 'U'}</UserAvatar>
          </span>}
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
              Pengaturan Akun
            </h1>
            {/* Tampilkan username asli */}
            <p className="mt-1 text-[13px] font-semibold text-cyan-600 dark:text-cyan-400">
              @{user?.username?? '-'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
              Kelola data profil dan keamanan akun Anda.
            </p>
          </div>
        </div>
      </Reveal>

      {saved && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Check className="h-4 w-4" strokeWidth={2.6} />
          Perubahan berhasil disimpan
        </div>
      )}

      {!embedded && <div className="mb-6"><AvatarPicker /><a href="/profil" className="mt-3 inline-block text-xs font-semibold text-cyan-700 underline dark:text-cyan-400">Lihat halaman profil</a></div>}

      {/* Profile data */}
      <Reveal delay={70}>
        <div className="mt-6 overflow-hidden rounded-[28px] border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
            Data Profil
          </p>
          <div className="space-y-4 p-5">
            <Field label="Nama lengkap" icon={User}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="akun-input"
                placeholder="Nama lengkap"
              />
            </Field>
            <Field label="Username" icon={AtSign}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                className="akun-input font-mono"
                placeholder="username"
              />
            </Field>
            <Field label="Email" icon={Mail}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="akun-input"
                placeholder="email@contoh.com"
              />
            </Field>
            <button
              onClick={saveProfile}
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99] disabled:opacity-70"
            >
              {loading? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-4 w-4" strokeWidth={2.3} />}
              Simpan Profil
            </button>
          </div>
        </div>
      </Reveal>

      {/* Email Verification */}
      <Reveal delay={100}>
        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
            Verifikasi Email
          </p>
          <div className="space-y-4 p-5">
            {!emailVerified && (
              <div className="animate-pulse rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-500 dark:bg-amber-900/20">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
                  <p className="text-[12.5px] font-bold leading-relaxed text-amber-800 dark:text-amber-300">
                    Verifikasi email anda untuk keamanan agar dapat ubah password.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
                  <Mail className="h-5 w-5" strokeWidth={2.1} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
                    {user?.email}
                  </p>
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
                    {emailVerified? 'Email terverifikasi' : 'Email belum terverifikasi'}
                  </p>
                </div>
              </div>
              {emailVerified? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50">
                  <Check className="h-3 w-3" strokeWidth={2.6} />
                  Terverifikasi
                </span>
              ) : (
                <button
                  onClick={requestEmailOtp}
                  disabled={otpSending || cooldownLeft > 0}
                  className="shrink-0 rounded-lg bg-cyan-600 px-3 py-2 font-mono text-[12px] font-bold tabular-nums text-white transition-all hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-cyan-600"
                >
                  {cooldownLeft > 0 ? `Tunggu ${fmtCooldown(cooldownLeft)}` : otpSending ? 'Mengirim...' : 'Verifikasi'}
                </button>
              )}
            </div>

            {!emailVerified && (
              <p className="text-[10.5px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                Cooldown progresif — permintaan ke-2 → 1 menit, ke-3 → 5 menit, ke-4 → 30 menit, ke-5 dst → 24 jam.
              </p>
            )}
            {verifError && !showOtp && (
              <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">{verifError}</p>
            )}

            {!emailVerified && showOtp && (
              <div className="animate-fade-in space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 dark:border-cyan-800/40 dark:bg-cyan-900/15">
                <div className="relative">
                  <KeySquare className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Kode OTP (6 digit)"
                    className="akun-input font-mono!pl-10"
                  />
                </div>
                {verifError && (
                  <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">{verifError}</p>
                )}
                <button
                  onClick={verifyOtp}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99]"
                >
                  <Check className="h-4 w-4" strokeWidth={2.3} />
                  Konfirmasi
                </button>
              </div>
            )}

            {verifSuccess && (
              <p className="flex items-center gap-2 rounded-xl border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Check className="h-4 w-4" strokeWidth={2.6} />
                Email berhasil diverifikasi. Anda kini dapat mengubah password.
              </p>
            )}
          </div>
        </div>
      </Reveal>

      {/* Password */}
      <Reveal delay={110}>
        <div className="mt-5 overflow-hidden rounded-[28px] border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
            Ubah Password
          </p>
          <div className="space-y-4 p-5">
            <Field label="Password baru" icon={KeyRound}>
              <div className="relative">
                <input
                  type={showPw? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="akun-input pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) =>!v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400"
                >
                  {showPw? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Konfirmasi password" icon={KeyRound}>
              <input
                type={showPw? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="akun-input"
                placeholder="••••••••"
              />
            </Field>
            {pwError && (
              <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">{pwError}</p>
            )}
            <button
              onClick={changePassword}
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-[13.5px] font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-70"
            >
              {loading? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-600" /> : <KeyRound className="h-4 w-4" strokeWidth={2.3} />}
              Ubah Password
            </button>
          </div>
        </div>
      </Reveal>

      <style>{`
      .akun-input {
          height: 44px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0 12px 0 40px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: all.2s;
        }
      .akun-input:focus {
          border-color: #06b6d4;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(6,182,212,.12);
        }
      .dark.akun-input {
          border-color: #334155;
          background: rgba(51,65,85,.4);
          color: #f1f5f9;
        }
      .dark.akun-input:focus { background: rgba(51,65,85,.7); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-400" strokeWidth={2.1} />
        {children}
      </span>
    </label>
  );
}