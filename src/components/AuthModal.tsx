import { useEffect, useRef, useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { sendOtpEmail, genOtp, isValidEmail, otpRateCheck, otpRateRecord } from '../services/otp';
import { boostyVoice } from '../services/boostyVoice';
import { MAIN_API } from '../lib/apiBase';
import { useSiteSettings } from '../context/SiteSettingsContext';

const API_URL = MAIN_API;
type Mode = 'register' | 'login' | 'recover' | 'otp';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: Mode;
}

export default function AuthModal({ open, onClose, onSuccess, initialMode = 'login' }: Props) {
  const { login } = useAuth();
  const { voiceMode } = useSiteSettings();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  // OTP email (menggantikan captcha "verifikasi human") untuk register.
  const [regOtp, setRegOtp] = useState('');
  const sentCode = useRef<string | null>(null);
  const sentAt = useRef<number>(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMsg, setOtpMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setShowPw(false);
    setRegOtp('');
    setOtpSent(false);
    setOtpMsg('');
    sentCode.current = null;
    setError('');
    setOtp('');
    setSentOtp(false);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => firstInputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current &&!rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.body.style.overflow = original;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const gotoMode = (next: Mode) => {
    setError('');
    setOtpMsg('');
    setMode(next);
  };

  // LOGIC DARI KODE 2
  // Minta OTP: generate kode, kirim via worker Resend ke email user, verifikasi di sisi klien.
  const requestOtp = async () => {
    setError(''); setOtpMsg('');
    if (!isValidEmail(email)) { setError('Isi email yang valid dulu untuk minta OTP.'); return; }
    const rc = otpRateCheck(email);
    if (!rc.allowed) { setError(rc.message || 'Terlalu banyak permintaan OTP.'); return; }
    setOtpSending(true);
    const code = genOtp();
    const r = await sendOtpEmail(email.trim(), code);
    setOtpSending(false);
    if (r.ok) {
      otpRateRecord(email);
      sentCode.current = code; sentAt.current = Date.now();
      setOtpSent(true); setOtpMsg('Kode OTP dikirim ke email kamu.');
    } else {
      setError(r.error || 'Gagal mengirim OTP.');
    }
  };

  const submitRegister = async () => {
    setError('');
    if (!username.trim()) return setError('Username wajib diisi.');
    if (!isValidEmail(email)) return setError('Masukkan email yang valid.');
    if (password.length < 6) return setError('Password minimal 6 karakter.');
    if (password!== confirm) return setError('Konfirmasi password tidak cocok.');
    if (!regOtp.trim()) return setError('Masukkan kode OTP yang dikirim ke email.');
    if (!sentCode.current || regOtp.trim() !== sentCode.current) return setError('Kode OTP salah.');
    if (Date.now() - sentAt.current > 10 * 60_000) return setError('Kode OTP kedaluwarsa, minta ulang.');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      // register.php membalas status 400 untuk error validasi,
      // jadi baca dulu body-nya supaya pesan asli dari server tampil
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Respons register bukan JSON (HTTP ' + res.status + '):', text.slice(0, 300));
        throw new Error(`Respons server tidak valid (HTTP ${res.status})`);
      }
      if (data.ok) {
        setMode('login');
        setError('Daftar berhasil! Silakan login.');
      } else {
        setError(data.message || 'Gagal daftar');
      }
    } catch (err: any) {
      setError('Gagal konek ke server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async () => {
    setError('');
    if (!email.trim() ||!password) return setError('Email dan password wajib diisi.');
    if (!isValidEmail(email)) return setError('Masukkan email yang valid.');
    setLoading(true);
    // Buka kunci audio SEKARANG (masih di dalam gesture klik/enter, sebelum await login)
    // agar suara Guri Booster boleh diputar setelah login selesai — termasuk di Safari/iOS.
    boostyVoice.prime();
    try {
      const res = await login(email, password);
      if (res.ok) {
        // Suara Guri Booster diputar SETIAP kali user baru login. Refresh halaman tidak
        // memanggil submitLogin, jadi suara tidak diulang saat refresh.
        boostyVoice.start(voiceMode);
        onSuccess?.();
        onClose();
        navigate('/overview'); // redirect setelah login -> Overview
      } else {
        boostyVoice.stop();
        setError(res.message || 'Login gagal');
      }
    } catch (err: any) {
      boostyVoice.stop();
      setError('Gagal konek ke server: ' + (err.message || 'Coba lagi'));
    } finally {
      setLoading(false);
    }
  };

  const submitRecover = () => {
    setError('');
    if (!isValidEmail(email)) return setError('Masukkan email yang valid.');
    setSentOtp(true);
    setMode('otp');
  };

  const submitOtp = () => {
    setError('');
    if (!otp.trim()) return setError('Kode OTP wajib diisi.');
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setMode('register');
      setError('Verifikasi berhasil. Silakan buat password baru.');
    }, 900);
  };

  const showFlip = mode === 'login' || mode === 'register';

  // UI DARI KODE 1
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/55" onClick={onClose} />

      <div ref={rootRef} className="authflip-wrapper">
        <button onClick={onClose} aria-label="Tutup" className="authflip-close">
          <X className="h-4 w-4" strokeWidth={2.6} />
        </button>

        {showFlip? (
          <div className="authflip-card-switch">
            <div className="authflip-switch">
              <input
                id="authflip-mode-toggle"
                type="checkbox"
                className="authflip-toggle"
                checked={mode === 'register'}
                onChange={(e) => gotoMode(e.target.checked? 'register' : 'login')}
              />
              <label htmlFor="authflip-mode-toggle" className="authflip-slider" aria-label="Beralih antara Masuk dan Daftar" />
              <span className="authflip-card-side" aria-hidden />
              <div className="authflip-flip-card__inner">
                {/* FRONT — LOGIN (LOGIC BARU: EMAIL) */}
                <div className="authflip-flip-card__front">
                  <div className="authflip-title">Masuk</div>
                  {mode === 'login' && error && <p className="authflip-error">{error}</p>}
                  <form
                    className="authflip-flip-card__form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitLogin();
                    }}
                  >
                    <input
                      ref={mode === 'login'? firstInputRef : undefined}
                      className="authflip-flip-card__input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                      autoComplete="email"
                    />
                    <div className="flex justify-center py-0.5">
                      <span className="eye-loader" aria-hidden />
                    </div>
                    <div className="authflip-password-wrap">
                      <input
                        type={showPw? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="current-password"
                        className="authflip-flip-card__input authflip-has-eye"
                      />
                      <button type="button" onClick={() => setShowPw((v) =>!v)} className="authflip-eye-btn">
                        {showPw? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button type="submit" disabled={loading} className="authflip-flip-card__btn">
                      {loading? <span className="authflip-spinner" /> : 'Masuk'}
                    </button>
                  </form>
                  <p className="authflip-footnote">
                    <button type="button" onClick={() => gotoMode('recover')} className="authflip-link">Lupa password?</button>
                  </p>
                  <p className="authflip-footnote">
                    Belum punya akun? <button type="button" onClick={() => gotoMode('register')} className="authflip-link">Daftar</button>
                  </p>
                </div>

                {/* BACK — REGISTER (LOGIC BARU: USERNAME + EMAIL + CAPTCHA) */}
                <div className="authflip-flip-card__back">
                  <div className="authflip-title">Daftar</div>
                  {mode === 'register' && error && <p className="authflip-error">{error}</p>}
                  <form
                    className="authflip-flip-card__form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submitRegister();
                    }}
                  >
                    <input
                      ref={mode === 'register'? firstInputRef : undefined}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      type="text"
                      autoComplete="username"
                      className="authflip-flip-card__input"
                    />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                      autoComplete="email"
                      className="authflip-flip-card__input"
                    />
                    <div className="flex justify-center py-0.5">
                      <span className="eye-loader" aria-hidden />
                    </div>
                    <div className="authflip-password-wrap">
                      <input
                        type={showPw? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete="new-password"
                        className="authflip-flip-card__input authflip-has-eye"
                      />
                      <button type="button" onClick={() => setShowPw((v) =>!v)} className="authflip-eye-btn">
                        {showPw? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <input
                      type={showPw? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Konfirmasi Password"
                      autoComplete="new-password"
                      className="authflip-flip-card__input"
                    />

                    <div className="authflip-captcha">
                      <div className="flex items-center justify-between gap-2">
                        <span className="authflip-captcha-label">Verifikasi OTP</span>
                        <button type="button" onClick={requestOtp} disabled={otpSending} className="authflip-mini-btn">{otpSending ? '...' : otpSent ? 'Kirim ulang' : 'Minta OTP'}</button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input value={regOtp} onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Kode OTP dari email" className="authflip-flip-card__input authflip-captcha-a" style={{ fontFamily: 'monospace' }} />
                      </div>
                      {otpMsg && <p className="authflip-info" style={{ marginTop: 4 }}>{otpMsg}</p>}
                    </div>

                    <button type="submit" disabled={loading} className="authflip-flip-card__btn">
                      {loading? <span className="authflip-spinner" /> : 'Daftar'}
                    </button>
                  </form>
                  <p className="authflip-footnote">
                    Sudah punya akun? <button type="button" onClick={() => gotoMode('login')} className="authflip-link">Masuk</button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="authflip-static">
            <div className="authflip-title">{mode === 'recover'? 'Pulihkan Akun' : 'Verifikasi Kode'}</div>
            {error && <p className="authflip-error">{error}</p>}
            {mode === 'recover' && (
              <form className="authflip-flip-card__form" onSubmit={(e) => { e.preventDefault(); submitRecover(); }}>
                <input ref={firstInputRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="authflip-flip-card__input" />
                <button type="submit" className="authflip-flip-card__btn">Verifikasi</button>
              </form>
            )}
            {mode === 'otp' && (
              <form className="authflip-flip-card__form" onSubmit={(e) => { e.preventDefault(); submitOtp(); }}>
                {sentOtp && <p className="authflip-info">Kode OTP telah dikirim ke {email}.</p>}
                <input ref={firstInputRef} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="Kode OTP" className="authflip-flip-card__input" style={{ fontFamily: 'monospace' }} />
                <button type="submit" disabled={loading} className="authflip-flip-card__btn">{loading? <span className="authflip-spinner" /> : 'Konfirmasi'}</button>
              </form>
            )}
            <p className="authflip-footnote">
              {mode === 'recover'? (
                <>Ingat password? <button type="button" onClick={() => gotoMode('login')} className="authflip-link">Masuk</button></>
              ) : (
                <button type="button" onClick={() => gotoMode('recover')} className="authflip-link">Kirim ulang kode</button>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}