import { X, ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const faqs = [
  {
    question: 'Bagaimana cara cek status booster saya?',
    answer: 'Masukkan ID pesanan pada kolom pencarian di halaman utama lalu tekan Cek Status. Status, progres, dan sisa jumlah akan langsung ditampilkan.',
  },
  {
    question: 'Apa arti status pending, processing, dan completed?',
    answer: 'Pending berarti pesanan baru dibuat. Processing berarti booster sedang dijalankan. Completed berarti target sudah terpenuhi. Partial berarti sebagian sudah masuk, dan canceled berarti pesanan dibatalkan.',
  },
  {
    question: 'Apa itu start count dan remains?',
    answer: 'Start count adalah jumlah awal sebelum booster berjalan. Remains adalah sisa jumlah yang masih dikirim. Semakin kecil remains, semakin mendekati selesai.',
  },
  {
    question: 'Berapa lama booster biasanya selesai?',
    answer: 'Waktu bervariasi tergantung platform dan jumlah pesanan. Banyak pesanan mulai berjalan dalam hitungan menit, namun volume besar bisa memakan waktu lebih lama.',
  },
  {
    question: 'Apakah ID pesanan aman dimasukkan di sini?',
    answer: 'Ya. ID hanya dipakai untuk meminta status ke API. Kami tidak menyimpan data pesanan secara permanen di perangkat Anda.',
  },
  {
    question: 'Bagaimana jika pesanan berstatus canceled atau partial?',
    answer: 'Hubungi admin melalui menu Hubungi Admin. Sertakan ID pesanan agar status dapat dicek ulang dan ditindaklanjuti.',
  },
];

export default function FAQModal({ isOpen, onClose }: FAQModalProps) {
  // Logo mengikuti pengaturan (child panel / admin), bukan logo Boosteryuk bawaan.
  const logoUrl = useSiteSettings().settings.logoUrl;
  const [expanded, setExpanded] = useState<number | null>(0);
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(query.toLowerCase()) ||
      f.answer.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <div className="fixed inset-0 z-50 animate-fade-in bg-slate-900/40 backdrop-blur-[3px]" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-0 sm:px-6">
        <div className="flex max-h-[82vh] w-full max-w-md animate-slide-up sm:max-w-xl flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl shadow-slate-900/30 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/40 sm:mb-6 sm:rounded-3xl sm:border">
          <div className="flex justify-center pt-3 sm:hidden">
            <span className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
            <img src={logoUrl} alt="FAQ" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Pertanyaan Umum</h2>
              <p className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">{filtered.length} topik seputar booster</p>
            </div>
            <button onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white active:scale-90">
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>

          <div className="px-5 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pertanyaan..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-700" />
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4 pb-8">
            <div className="space-y-2">
              {filtered.map((faq, i) => {
                const open = expanded === i;
                return (
                  <div key={faq.question} className={`overflow-hidden rounded-xl border transition-all duration-300 ${open ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:border-slate-600'}`}>
                    <button onClick={() => setExpanded(open ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition-colors ${open ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{i + 1}</span>
                      <span className="flex-1 text-[13.5px] font-semibold leading-snug text-slate-800 dark:text-slate-200">{faq.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 dark:text-slate-400 ${open ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'dark:text-slate-500'}`} />
                    </button>
                    <div className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <p className="px-4 pb-4 pl-[52px] text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada pertanyaan yang cocok.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
