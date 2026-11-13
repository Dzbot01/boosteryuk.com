import { createContext, useContext, useEffect, useState } from 'react';
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
}

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

  useEffect(() => {
    refresh();
  }, []);

const refresh = async () => {
  setLoading(true);
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
    
    setUser({ ...data.user, token });
  }catch(err){
    console.error('Auth refresh error:', err);
    setUser(null);
    localStorage.removeItem('token');
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