import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from './supabase/admin';

export type DbUser = {
  id: number; name: string; username: string; email: string; password: string;
  phone: string | null; balance: number; role: string | null; plus_active: number | null;
  created_at: string | null;
};

// Bentuk user yang dikonsumsi frontend (sama seperti respons PHP me.php sebelumnya).
export function mapUser(u: DbUser) {
  const initials = (u.name || u.username || 'U')
    .split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    initials,
    joined: u.created_at || '',
    phone: u.phone || '',
    timezone: '',
    balance: Number(u.balance || 0),
    role: u.role || 'user',
    plusActive: Number(u.plus_active) === 1,
    email_verified: true,
  };
}

// bcrypt PHP memakai prefix $2y$ — bcryptjs membandingkan $2a/$2b. Normalisasi agar cocok
// (algoritma identik, hasil sama). TIDAK mengubah logic verifikasi.
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const normalized = hash.startsWith('$2y$') ? '$2b$' + hash.slice(4) : hash;
  try { return await bcrypt.compare(plain, normalized); } catch { return false; }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

const TOKEN_TTL_DAYS = 30;

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

// Buat sesi baru (tabel sessions: id, user_id, token, expires_at).
export async function createSession(userId: number): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + TOKEN_TTL_DAYS * 86400_000).toISOString();
  await supabaseAdmin.from('sessions').insert({ user_id: userId, token, expires_at: expires });
  return token;
}

// Validasi token -> kembalikan baris user, atau null bila tidak valid/kedaluwarsa.
export async function userFromToken(token: string | null): Promise<DbUser | null> {
  if (!token) return null;
  const { data: sess } = await supabaseAdmin
    .from('sessions').select('user_id, expires_at').eq('token', token).maybeSingle();
  if (!sess) return null;
  if (sess.expires_at && new Date(sess.expires_at).getTime() < Date.now()) return null;
  const { data: user } = await supabaseAdmin
    .from('users').select('*').eq('id', sess.user_id).maybeSingle();
  return (user as DbUser) || null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}
