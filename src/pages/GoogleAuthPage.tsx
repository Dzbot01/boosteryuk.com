import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { finishGoogleLogin, GOOGLE_CENTER, startGoogleLogin } from '../services/googleRedirect';
import Seo from '../components/Seo';

export default function GoogleAuthPage({ finish = false }: { finish?: boolean }) {
  const { refresh } = useAuth();
  const [error, setError] = useState('');
  useEffect(() => {
    // The finish route intentionally lives outside Layout (no third-party content).
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer';
    document.head.appendChild(meta);
    let alive = true;
    if (!finish) {
      const params = new URLSearchParams(window.location.search);
      const host = params.get('return') || '';
      const challenge = params.get('challenge') || '';
      if (!/^[a-z0-9.-]+$/.test(host) || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
        setError('Mulai login menggunakan tombol Google di website atau child panel asal.');
      } else {
        window.location.replace(`${GOOGLE_CENTER}/api/google_auth.php?${new URLSearchParams({ action: 'start', return: host, challenge })}`);
      }
    } else {
      void finishGoogleLogin().then(async () => {
        await refresh();
        if (alive) window.location.replace('/overview');
      }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Login gagal.'); });
    }
    return () => { alive = false; meta.remove(); };
    // Exchange is shared across StrictMode replays; refresh's identity changes on auth updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);
  return <main className="mx-auto max-w-lg space-y-4 px-5 py-24 text-center">
    <Seo title="Login Google" noindex />
    <h1 className="text-xl font-bold">{error ? 'Login belum berhasil' : 'Memproses login Google…'}</h1>
    {error && <><p role="alert" className="text-sm text-rose-600">{error}</p><button onClick={() => void startGoogleLogin().catch(() => setError('Tidak dapat memulai login. Buka kembali halaman asal.'))} className="rounded-lg bg-cyan-600 px-4 py-2 text-white">Coba login ulang</button><p><a href="/" className="text-sm underline">Kembali ke beranda</a></p></>}
  </main>;
}
