import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  CreditCard,
  Info,
  Loader2,
  Megaphone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { PPOB_GRADIEN_BAWAAN, PPOB_NEWS_DEFAULT, type PpobBeritaAdmin, type PpobKartuAdmin } from '../../data/ppob';

/** Kelas input seragam untuk halaman admin (tidak bergantung CSS eksternal). */
const INPUT =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12.5px] font-semibold text-slate-800 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'mb-1 block text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-slate-400';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Waktu sekarang, mis. "28 November 2026 14:05" — dipakai tombol "Sekarang". */
function nowStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Pilihan gradien siap pakai untuk kartu promo (boleh juga diisi CSS sendiri). */
const GRADIEN = [
  'linear-gradient(120deg,#1D4ED8 0%,#3B82F6 100%)',
  'linear-gradient(120deg,#EA580C 0%,#F5B73B 100%)',
  'linear-gradient(120deg,#0EA5E9 0%,#6366F1 100%)',
  'linear-gradient(120deg,#059669 0%,#34D399 100%)',
  'linear-gradient(120deg,#DB2777 0%,#F472B6 100%)',
  'linear-gradient(120deg,#0F172A 0%,#334155 100%)',
];

const WARNA_BADGE = ['#14B8A6', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#10B981'];

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Info; children: React.ReactNode }) {
  return (
    <section className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/70">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
        <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Admin Panel → "News Update PPOB".
 *
 * Mengatur dua hal yang tampil di halaman PPOB user:
 *  1. News Update — card berita + modal isinya (tag, warna badge, judul, tanggal, isi).
 *  2. Kartu promo "BAYAR TAGIHANMU / HANYA DI …" — jumlah bebas, barisnya digeser user.
 *
 * Semuanya disimpan ke database (site_settings.php, kunci `ppobNews`) sehingga berlaku
 * untuk semua user & child panel, bukan hanya di browser admin.
 */
export default function AdminPpobNewsPage() {
  const navigate = useNavigate();
  const { settings, setPpobBerita, setPpobKartu, sync } = useSiteSettings();
  const namaApp = settings.brandName || 'Boosteryuk';

  const tersimpan = settings.ppobNews || PPOB_NEWS_DEFAULT;
  const [berita, setBerita] = useState<PpobBeritaAdmin[]>(tersimpan.berita || []);
  const [kartu, setKartu] = useState<PpobKartuAdmin[]>(tersimpan.kartu || []);
  const [menyimpan, setMenyimpan] = useState<'berita' | 'kartu' | ''>('');
  const [pesan, setPesan] = useState('');

  // Ikuti perubahan dari server (mis. admin lain menyimpan, atau data bawaan termuat).
  useEffect(() => {
    setBerita(tersimpan.berita || []);
    setKartu(tersimpan.kartu || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.ppobNews]);

  useEffect(() => {
    if (sync.status === 'saved') setPesan('Tersimpan ke database — langsung tampil untuk semua user.');
    else if (sync.status === 'error') setPesan(sync.message || 'Gagal menyimpan ke database.');
  }, [sync.status, sync.message]);

  const idBaru = (list: { id: number }[]) => (list.reduce((m, x) => Math.max(m, x.id), 0) + 1);

  /* ---------- berita ---------- */
  const ubahBerita = (id: number, patch: Partial<PpobBeritaAdmin>) =>
    setBerita((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const tambahBerita = () =>
    setBerita((list) => [...list, { id: idBaru(list), tag: 'INFO', warna: '#3B82F6', title: '', desc: '', time: nowStamp() }]);
  const hapusBerita = (id: number) => setBerita((list) => list.filter((it) => it.id !== id));
  const geserBerita = (i: number, arah: -1 | 1) =>
    setBerita((list) => {
      const j = i + arah;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /* ---------- kartu promo ---------- */
  const ubahKartu = (id: number, patch: Partial<PpobKartuAdmin>) =>
    setKartu((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const tambahKartu = () =>
    setKartu((list) => [...list, { id: idBaru(list), title: '', subtitle: '', desc: '', gradien: GRADIEN[list.length % GRADIEN.length] }]);
  const hapusKartu = (id: number) => setKartu((list) => list.filter((it) => it.id !== id));
  const geserKartu = (i: number, arah: -1 | 1) =>
    setKartu((list) => {
      const j = i + arah;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /* ---------- simpan ---------- */
  const simpanBerita = () => {
    setMenyimpan('berita');
    setPesan('');
    setPpobBerita(berita.map((b, i) => ({ ...b, id: b.id || i + 1 })));
    setTimeout(() => setMenyimpan(''), 900);
  };
  const simpanKartu = () => {
    setMenyimpan('kartu');
    setPesan('');
    setPpobKartu(kartu.map((k, i) => ({ ...k, id: k.id || i + 1 })));
    setTimeout(() => setMenyimpan(''), 900);
  };
  const resetSemua = () => {
    setBerita(PPOB_NEWS_DEFAULT.berita);
    setKartu(PPOB_NEWS_DEFAULT.kartu);
    setPesan('Isi bawaan dimuat ke form — tekan Simpan untuk menyimpannya ke database.');
  };

  const contohKartu = useMemo(() => kartu.slice(0, 4), [kartu]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16">
      <Link to="/admin" className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Admin Panel
      </Link>

      <header className="mt-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-white">News Update PPOB</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          Atur berita News Update (card + modal) dan kartu promo yang bisa digeser di halaman PPOB. Semua perubahan
          tersimpan di database dan langsung tampil untuk setiap user.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/ppob')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11.5px] font-bold text-cyan-700 transition active:scale-95 dark:border-cyan-800/40 dark:bg-cyan-900/25 dark:text-cyan-300"
          >
            <Megaphone className="h-3.5 w-3.5" /> Lihat halaman PPOB
          </button>
          <button
            type="button"
            onClick={resetSemua}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-bold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Muat isi bawaan
          </button>
        </div>
        {pesan && (
          <p aria-live="polite" className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[11.5px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> {pesan}
          </p>
        )}
      </header>

      {/* ================= KARTU PROMO (bisa digeser user) ================= */}
      <Card title="Kartu Promo PPOB (baris geser)" icon={CreditCard}>
        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Kartu “BAYAR TAGIHANMU / HANYA DI {namaApp}” dan teman-temannya. Tambahkan sebanyak yang diperlukan — user
          menggesernya ke samping. Teks <code className="rounded bg-slate-100 px-1 font-mono text-[11px] dark:bg-slate-800">{'{APP}'}</code>{' '}
          otomatis diganti nama brand website/child panel.
        </p>

        {/* pratinjau baris geser */}
        <div className="ppob-admin-scroll mt-3 flex snap-x gap-2.5 overflow-x-auto pb-1">
          {(contohKartu.length ? contohKartu : PPOB_NEWS_DEFAULT.kartu).map((k) => (
            <article
              key={k.id}
              className="relative flex h-[104px] w-[260px] shrink-0 snap-start flex-col justify-center overflow-hidden rounded-2xl px-4 text-white"
              style={{ background: k.gradien || PPOB_GRADIEN_BAWAAN }}
            >
              <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
              <p className="relative text-[13px] font-extrabold leading-tight">{(k.title || 'Judul kartu').replace('{APP}', namaApp)}</p>
              <p className="relative mt-0.5 text-[11px] font-semibold text-white/85">{(k.subtitle || 'Subjudul kartu').replace('{APP}', namaApp)}</p>
              {k.desc ? <p className="relative mt-1 line-clamp-2 text-[10px] font-medium text-white/75">{k.desc.replace('{APP}', namaApp)}</p> : null}
            </article>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {kartu.map((k, i) => (
            <div key={k.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Kartu {i + 1}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => geserKartu(i, -1)} disabled={i === 0} aria-label="Naikkan kartu" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition active:scale-90 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => geserKartu(i, 1)} disabled={i === kartu.length - 1} aria-label="Turunkan kartu" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition active:scale-90 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => hapusKartu(k.id)} aria-label="Hapus kartu" className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 transition active:scale-90 dark:border-rose-900/50 dark:bg-slate-800">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Judul</span>
                  <input value={k.title} onChange={(e) => ubahKartu(k.id, { title: e.target.value })} className={INPUT} placeholder="BAYAR TAGIHANMU" data-kartu-judul={k.id} />
                </label>
                <label className="block">
                  <span className={LABEL}>Subjudul</span>
                  <input value={k.subtitle} onChange={(e) => ubahKartu(k.id, { subtitle: e.target.value })} className={INPUT} placeholder="HANYA DI {APP}" />
                </label>
              </div>
              <label className="mt-2 block">
                <span className={LABEL}>Keterangan (opsional)</span>
                <input value={k.desc} onChange={(e) => ubahKartu(k.id, { desc: e.target.value })} className={INPUT} placeholder="Pulsa, data, e-money & tagihan diproses otomatis" />
              </label>
              <div className="mt-2">
                <span className={LABEL}>Warna latar</span>
                <div className="flex flex-wrap gap-2">
                  {GRADIEN.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => ubahKartu(k.id, { gradien: g })}
                      aria-label={`Pakai gradien ${g}`}
                      aria-pressed={k.gradien === g}
                      className={`h-8 w-14 rounded-lg border-2 transition ${k.gradien === g ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                      style={{ background: g }}
                    />
                  ))}
                </div>
                <input value={k.gradien} onChange={(e) => ubahKartu(k.id, { gradien: e.target.value })} className={`${INPUT} mt-2 font-mono text-[11px]`} placeholder={PPOB_GRADIEN_BAWAAN} />
              </div>
            </div>
          ))}
          {kartu.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[12px] font-semibold text-slate-500 dark:border-slate-700">
              Belum ada kartu promo — halaman PPOB akan memakai kartu bawaan sampai admin menyimpan kartunya sendiri.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={tambahKartu} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" data-tambah-kartu="true">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Tambah kartu
          </button>
          <button type="button" onClick={simpanKartu} disabled={menyimpan === 'kartu'} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-cyan-700 active:scale-95 disabled:opacity-80" data-simpan-kartu="true">
            {menyimpan === 'kartu' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan kartu
          </button>
        </div>
      </Card>

      {/* ================= NEWS UPDATE (card + modal) ================= */}
      <Card title="News Update PPOB (card + modal)" icon={Info}>
        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Isi berita ini yang tampil sebagai card di halaman PPOB; saat user mengetuk card, modal menampilkan judul,
          tanggal, dan isi lengkap yang admin tulis di sini.
        </p>

        <div className="mt-4 space-y-3">
          {berita.map((b, i) => (
            <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Berita {i + 1}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => geserBerita(i, -1)} disabled={i === 0} aria-label="Naikkan berita" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition active:scale-90 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => geserBerita(i, 1)} disabled={i === berita.length - 1} aria-label="Turunkan berita" className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition active:scale-90 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => hapusBerita(b.id)} aria-label="Hapus berita" className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 transition active:scale-90 dark:border-rose-900/50 dark:bg-slate-800">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <label className="block">
                  <span className={LABEL}>Tag</span>
                  <input value={b.tag} onChange={(e) => ubahBerita(b.id, { tag: e.target.value })} className={INPUT} placeholder="INFO" data-berita-tag={b.id} />
                </label>
                <label className="block">
                  <span className={LABEL}>Tanggal / waktu</span>
                  <div className="flex gap-2">
                    <input value={b.time} onChange={(e) => ubahBerita(b.id, { time: e.target.value })} className={INPUT} placeholder={nowStamp()} />
                    <button type="button" onClick={() => ubahBerita(b.id, { time: nowStamp() })} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-[11.5px] font-bold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Sekarang
                    </button>
                  </div>
                </label>
              </div>

              <label className="mt-2 block">
                <span className={LABEL}>Judul</span>
                <input value={b.title} onChange={(e) => ubahBerita(b.id, { title: e.target.value })} className={INPUT} placeholder="Judul berita PPOB" data-berita-judul={b.id} />
              </label>

              <label className="mt-2 block">
                <span className={LABEL}>Isi (tampil di modal)</span>
                <textarea
                  value={b.desc}
                  onChange={(e) => ubahBerita(b.id, { desc: e.target.value })}
                  rows={4}
                  className={`${INPUT} resize-y leading-relaxed`}
                  placeholder="Tulis isi lengkap berita di sini…"
                  data-berita-isi={b.id}
                />
              </label>

              <div className="mt-2">
                <span className={LABEL}>Warna badge</span>
                <div className="flex flex-wrap gap-2">
                  {WARNA_BADGE.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => ubahBerita(b.id, { warna: w })}
                      aria-label={`Pakai warna ${w}`}
                      aria-pressed={b.warna === w}
                      className={`h-8 w-8 rounded-lg border-2 transition ${b.warna === w ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                      style={{ background: w }}
                    />
                  ))}
                </div>
              </div>

              {/* pratinjau card + modal */}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-sm dark:bg-slate-800">
                  <span className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white" style={{ background: b.warna || '#3B82F6' }}>
                    {b.tag || 'INFO'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-snug text-slate-800 dark:text-slate-100">{b.title || 'Judul berita'}</span>
                    <span className="mt-0.5 block text-[10.5px] text-slate-400">{b.time || nowStamp()}</span>
                  </span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
                  <span className="rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ background: b.warna || '#3B82F6' }}>
                    {b.tag || 'INFO'}
                  </span>
                  <p className="mt-1.5 text-[12px] font-extrabold leading-snug text-slate-900 dark:text-white">{b.title || 'Judul berita'}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-slate-400">{b.time || nowStamp()}</p>
                  <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{b.desc || 'Isi modal berita…'}</p>
                </div>
              </div>
            </div>
          ))}
          {berita.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[12px] font-semibold text-slate-500 dark:border-slate-700">
              Belum ada berita — bagian News Update di halaman PPOB memakai isi bawaan sampai admin menyimpan versinya.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={tambahBerita} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" data-tambah-berita="true">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Tambah berita
          </button>
          <button type="button" onClick={simpanBerita} disabled={menyimpan === 'berita'} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-cyan-700 active:scale-95 disabled:opacity-80" data-simpan-berita="true">
            {menyimpan === 'berita' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan berita
          </button>
        </div>
      </Card>

      <style>{`
        .ppob-admin-scroll { scrollbar-width: thin; }
      `}</style>
    </div>
  );
}
