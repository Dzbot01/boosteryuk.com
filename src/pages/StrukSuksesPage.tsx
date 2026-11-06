import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Printer } from 'lucide-react';
import Reveal from '../components/Reveal';
import StrukCard from '../components/StrukCard';
import {
  loadStruk,
  saveStruk,
  verifyCode,
  type Struk,
} from '../services/strukStore';

const CODE_LEN = 6;
const PREFIX = 'sukses';

function parseSlug(slug: string): { orderId: string; code: string } | null {
  if (!slug.startsWith(PREFIX)) return null;
  const rest = slug.slice(PREFIX.length);
  if (rest.length <= CODE_LEN) return null;

  const code = rest.slice(-CODE_LEN);
  const orderId = rest.slice(0, -CODE_LEN);

  if (!/^\d+$/.test(orderId)) return null;
  if (!/^[a-z0-9]+$/i.test(code) || code.length !== CODE_LEN) return null;

  return { orderId, code };
}

/** Build a default struk when the URL is accessed without saved data. */
function buildDefault(orderId: string): Struk {
  return {
    orderId,
    layanan: '',
    target: '',
    jumlah: '',
    tanggal: new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
    ok: true,
    code: '',
  };
}

export default function StrukSuksesPage() {
  const navigate = useNavigate();
  const { slug = '' } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseSlug(slug), [slug]);

  // Derive orderId / code, validate against storage, auto-rebuild when absent.
  const struk = useMemo<Struk | null>(() => {
    if (!parsed) return null;
    const saved = loadStruk(parsed.orderId);
    if (saved) return saved;

    // Code is valid but struk not in storage → rebuild a default and persist it.
    // This lets the unique URL outlive the original session.
    const rebuilt = buildDefault(parsed.orderId);
    saveStruk(rebuilt);
    return { ...rebuilt, code: parsed.code };
  }, [parsed]);

  // Invalid URL shape (no prefix / wrong format) → bounce home.
  if (!parsed) return <Navigate to="/" replace />;

  // Code does not match the stored code for this orderId → reject.
  if (!verifyCode(parsed.orderId, parsed.code)) return <Navigate to="/struk" replace />;

  // Safety: parsed ok but struk resolution failed (shouldn't happen after rebuild).
  if (!struk) return <Navigate to="/struk" replace />;

  // Ensure this effect runs only once per mount to keep behaviour predictable.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const copyStruk = () => {
    const text = struk.ok
      ? [
          'Sukses! Pesanan anda berhasil di buat',
          `Id Pesanan : ${struk.orderId}`,
          `Layanan : ${struk.layanan || '—'}`,
          `Target : ${struk.target || '—'}`,
          `Jumlah : ${struk.jumlah || '—'}`,
          `Tanggal pesanan : ${struk.tanggal}`,
        ].join('\n')
      : 'Gagal! Data pesanan tidak lengkap.';

    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-md flex-col items-center px-4 py-8 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/struk')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Buat struk baru
        </button>
      </Reveal>

      <Reveal delay={40} className="flex w-full flex-1 flex-col items-center">
        <StrukCard struk={struk} />

        <div className="mt-8 grid w-full grid-cols-2 gap-3">
          <button
            onClick={() => window.print()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-[13.5px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Printer className="h-4 w-4" strokeWidth={2.3} />
            Cetak / PDF
          </button>
          <button
            onClick={copyStruk}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 text-[13.5px] font-bold text-cyan-700 transition-all hover:bg-cyan-100 active:scale-[0.99] dark:border-cyan-800/50 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/35"
          >
            {copied ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Copy className="h-4 w-4" strokeWidth={2.3} />}
            {copied ? 'Tersalin' : 'Salin Teks'}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          Tautan ini bersifat unik. Simpan URL ini untuk mengakses kembali struk di lain waktu.
        </p>
      </Reveal>
    </div>
  );
}
