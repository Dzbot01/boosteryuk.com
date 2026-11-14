import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { boostyVoice } from '../services/boostyVoice';
import { MAIN_API, IS_CHILD_PANEL } from '../lib/apiBase';

// Di child panel selalu lewat /api subdomain (header tenant dari Worker).
const API_URL = IS_CHILD_PANEL ? MAIN_API : import.meta.env.VITE_API_URL || MAIN_API;

type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  initials: string;
  joined: string;
  phone: string;
  timezone: string;
  balance: number;
  role: string;
  plusActive: boolean;
  email_verified?: boolean; // FIX: dipakai PengaturanAkunPage (dikirim server me.php)
  token?: string; // <-- TAMBAH INI
  /** Paket Upgrade dari plan_upgrade.php (EXTRA bulanan + child panel). */
  plan?: UserPlan;
}

export type UserPlan = {
  plus: boolean;
  extra_active: boolean;
  extra_until: string | null;
  promo_available: boolean;
  child_panel: { name: string; hostname: string; expires_at: string | null } | null;
  price_plus: number;
  price_extra: number;
  price_extra_first: number;
};

/** Event: sesi login berakhir (token kedaluwarsa / tidak valid) → SessionGuard mengarahkan ke beranda. */
export const AUTH_EXPIRED_EVENT = 'auth:expired';
const AUTH_CHECK_EVENT = 'auth:check';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ok: boolean, message?: string}>;
  register: (username: string, email: string, password: string) => Promise<{ok: boolean, message?: string}>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateUser: (data: Partial<User> & { password?: string }) => Promise<{ok: boolean, message?: string}>;
  topUp: (amount: number) => Promise<void>; // <-- TAMBAH
  activatePlus: () => Promise<void>; // <-- TAMBAH
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: React.ReactNode}){
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';
  // Refresh saat sudah login dilakukan diam-diam (tanpa layar loading) agar halaman tidak di-unmount.
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    refresh();
  }, []);

/** Status paket Upgrade (Plus/EXTRA). Gagal → null (tidak mengganggu login). */
const fetchPlan = async (token: string): Promise<UserPlan | null> => {
  try {
    const r = await fetch(`${MAIN_API}/plan_upgrade.php?token=${encodeURIComponent(token)}&t=${Date.now()}`, { cache: 'no-store' });
    const j = await r.json();
    return j?.ok && !j.guest ? (j as UserPlan) : null;
  } catch {
    return null;
  }
};

/** Sesi berakhir: hapus token, keluarkan user, beri tahu SessionGuard (redirect ke beranda). */
const expireSession = useCallback(() => {
  localStorage.removeItem('token');
  boostyVoice.stop();
  setUser(null);
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}, []);

/** Cek diam-diam apakah token masih berlaku (tanpa layar loading). */
const checkSession = useCallback(async () => {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/me.php?token=${token}&t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    // Hanya jawaban tegas "tidak valid" yang mengeluarkan user; error jaringan diabaikan.
    if (data && data.ok === false) expireSession();
  } catch {
    /* offline / server sibuk: biarkan */
  }
}, [expireSession]);

// Penjaga sesi: cek berkala, saat tab kembali aktif, dan saat ada API yang membalas 401.
useEffect(() => {
  if (!user) return;
  const onVisible = () => document.visibilityState === 'visible' && void checkSession();
  const onCheck = () => void checkSession();
  const t = window.setInterval(() => void checkSession(), 90_000);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener(AUTH_CHECK_EVENT, onCheck);
  return () => {
    window.clearInterval(t);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener(AUTH_CHECK_EVENT, onCheck);
  };
}, [user, checkSession]);

// Setiap respons 401 dari API PHP memicu cek sesi (sekali dipasang).
useEffect(() => {
  const w = window as unknown as { __byFetchPatched?: boolean };
  if (w.__byFetchPatched) return;
  w.__byFetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await orig(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      if (res.status === 401 && /\/api\//.test(url) && !/login\.php|register\.php/.test(url)) {
        window.dispatchEvent(new CustomEvent(AUTH_CHECK_EVENT));
      }
    } catch {
      /* abaikan */
    }
    return res;
  };
}, []);

const refresh = async () => {
  if (!userRef.current) setLoading(true);
  const token = localStorage.getItem('token');

  if(!token) { 
    setUser(null);
    setLoading(false); 
    return; 
  }
  
  try{
    const res = await fetch(`${API_URL}/me.php?token=${token}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await res.json();
    
    if(!res.ok || !data.ok){
      localStorage.removeItem('token');
      setUser(null);
      return;
    }
    
    const plan = await fetchPlan(token);
    setUser({ ...data.user, token, plan: plan || undefined, plusActive: !!data.user?.plusActive || !!plan?.plus });
  }catch(err){
    // Gangguan jaringan BUKAN berarti sesi habis: token disimpan, user dicoba lagi saat refresh berikutnya.
    console.error('Auth refresh error:', err);
    setUser(null);
  } finally {
    setLoading(false);
  }
}

  const login = async (username: string, password: string) => {
    try{
      const res = await fetch(`${API_URL}/login.php`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email: username, password})
      });
      const data = await res.json();
      if(data.ok){
        localStorage.setItem('token', data.token);
        setUser({ ...data.user, token: data.token });
        void fetchPlan(data.token).then((plan) => {
          if (plan) setUser((u) => (u ? { ...u, plan, plusActive: u.plusActive || plan.plus } : u));
        });
      }
      return data;
    }catch{
      return {ok: false, message: 'Gagal konek ke server'};
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try{
      const res = await fetch(`${API_URL}/register.php`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({username, email, password})
      });
      return res.json();
    }catch{
      return {ok: false, message: 'Gagal konek ke server'};
    }
  }

  // INI YANG BARU - biar ga error di UpgradePlusPage
  const topUp = async (amount: number) => {
    if(!user) return;
    setUser(prev => prev ? {...prev, balance: prev.balance + amount} : null);
    await refresh(); // sync ke server
  }

  const activatePlus = async () => {
    if(!user) return;
    setUser(prev => prev ? {...prev, plusActive: true} : null);
    await refresh(); // sync ke server
  }

  const updateUser = async (data: Partial<User> & { password?: string }) => {
    const token = localStorage.getItem('token');
    if(!token) return {ok: false, message: 'Belum login'};
    try{
      const res = await fetch(`${API_URL}/update_user.php`, {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if(result.ok){
        await refresh(); 
      }
      return result;
    }catch{
      return {ok: false, message: 'Pendaftaran sedang ditutup, coba lagi nanti atau refresh halaman'};
    }
  }

  const logout = () => {
    boostyVoice.stop(); // hentikan suara Guri Booster saat keluar
    localStorage.removeItem('token');
    setUser(null);
  }

  return <AuthContext.Provider value={{user, loading, isAdmin, login, register, logout, refresh, updateUser, topUp, activatePlus}}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if(!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}