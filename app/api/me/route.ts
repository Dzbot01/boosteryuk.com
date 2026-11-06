import { NextRequest, NextResponse } from 'next/server';
import { userFromToken, mapUser } from '@/lib/auth';

export const runtime = 'nodejs';

// me — validasi token (tabel sessions) lalu kembalikan data user. Sama seperti me.php lama.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  const user = await userFromToken(token);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, user: mapUser(user) });
}
