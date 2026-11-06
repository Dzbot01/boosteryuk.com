import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Megaphone,
  ImagePlus,
  X,
  Send,
  CheckCheck,
  Users,
  RefreshCw,
} from 'lucide-react';
import Reveal from '../../components/Reveal';

const API_BASE = 'https://cekidku.my.id/api';
const API_LIST = `${API_BASE}/listtoken.php`;
const API_BROADCAST = `${API_BASE}/broadcast.php`;

interface TokenRow {
  token: string;
}

export default function AdminBroadcastPage() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_LIST);
      const data = await res.json();
      // data bisa [] atau [{token}]
      const list = Array.isArray(data)? data : [];
      setTokens(list);
      // auto select all
      const next: Record<string, boolean> = {};
      list.forEach((t: TokenRow) => (next[t.token] = true));
      setSelected(next);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const selectedList = useMemo(
    () => tokens.filter((r) => selected[r.token]),
    [tokens, selected],
  );
  const allChecked = tokens.length > 0 && selectedList.length === tokens.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelected({});
    } else {
      const next: Record<string, boolean> = {};
      for (const r of tokens) next[r.token] = true;
      setSelected(next);
    }
  };

  const toggleOne = (token: string) =>
    setSelected((prev) => ({...prev, [token]:!prev[token] }));

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const send = async () => {
    if (!subject.trim() ||!message.trim() || selectedList.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(API_BROADCAST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: subject,
          body: message,
          tokens: selectedList.map((t) => t.token),
        }),
      });
      const data = await res.json();
      setSent(data.sukses?? selectedList.length);
      setTimeout(() => setSent(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Gagal broadcast');
    }
    setSending(false);
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13.5px] text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Admin Panel
        </button>
      </Reveal>

      <Reveal delay={30}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-600/25">
            <Megaphone className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
              Broadcast Push
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              Kirim push notifikasi ke {tokens.length} device terdaftar.
            </p>
          </div>
        </div>
      </Reveal>

      {/* Form card */}
      <Reveal delay={60}>
        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <p className="border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700/50 dark:text-slate-500">
            Isi Broadcast
          </p>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Judul Notifikasi
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Contoh: Update Harga Hari Ini"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Pesan
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Tulis isi pesan push…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Gambar (opsional)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] font-bold text-slate-600 transition-all hover:border-cyan-300 hover:text-cyan-700 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-400"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={2.2} />
                  Pilih Gambar
                </button>
                {image && (
                  <div className="relative">
                    <img
                      src={image}
                      alt={imageName}
                      className="h-14 w-20 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                    />
                    <button
                      onClick={() => {
                        setImage(null);
                        setImageName('');
                      }}
                      aria-label="Hapus gambar"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {imageName && (
                  <span className="max-w-[160px] truncate text-[12px] font-medium text-slate-500 dark:text-slate-400">
                    {imageName}
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickImage}
                />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Recipients card - REAL TOKENS */}
      <Reveal delay={110}>
        <div className="relative mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              <p className="font-display text-[14px] font-extrabold text-slate-900 dark:text-white">
                Device Terdaftar ({tokens.length})
              </p>
              <button onClick={fetchTokens} className="ml-2 rounded-full bg-slate-100 p-1.5 hover:bg-slate-200 dark:bg-slate-700">
                <RefreshCw className={`h-3.5 w-3.5 ${loading? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {selectedList.length}/{tokens.length} dipilih
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] font-semibold text-slate-500 dark:text-slate-300">
                Pilih semua
                <span
                  className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-all ${
                    allChecked
                     ? 'border-cyan-600 bg-cyan-600 text-white'
                      : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="sr-only"
                  />
                  {allChecked && <CheckCheck className="h-3 w-3" strokeWidth={3} />}
                </span>
              </label>
            </div>
          </div>

          <ul className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/50">
            {loading? (
              <li className="p-5 text-center text-[13px] text-slate-400 dark:text-slate-400">Loading token...</li>
            ) : tokens.length === 0? (
              <li className="p-5 text-center text-[13px] text-slate-400 dark:text-slate-400">Belum ada device. Buka web dan izinkan notifikasi dulu.</li>
            ) : (
              tokens.map((r) => {
                const checked =!!selected[r.token];
                return (
                  <li key={r.token}>
                    <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <span
                        className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-all ${
                          checked
                           ? 'border-cyan-600 bg-cyan-600 text-white'
                            : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(r.token)}
                          className="sr-only"
                        />
                        {checked && <CheckCheck className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {r.token.slice(0, 30)}...{r.token.slice(-10)}
                        </span>
                        <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                          FCM Token
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-slate-100 p-4 dark:border-slate-700/50">
            <button
              onClick={send}
              disabled={sending ||!subject.trim() ||!message.trim() || selectedList.length === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" strokeWidth={2.3} />
              {sending? 'Mengirim…' : `Kirim ke ${selectedList.length} device`}
            </button>
          </div>
        </div>
      </Reveal>

      {sent!== null && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 animate-fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-[13px] font-bold text-emerald-800 shadow-xl dark:border-emerald-800/50 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Sukses Broadcast dikirim ke {sent} device
        </div>
      )}
    </div>
  );
}