import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeAlert, Banknote, BookOpenCheck, ShieldCheck, Smartphone, Timer } from 'lucide-react';
import Reveal from '../components/Reveal';

/**
 * =============================================================
 *  HALAMAN PANDUAN & KEBIJAKAN ORDER NOMOR
 *  Dibuka dari card "Pelajari Panduan dan Kebijakan Order Nomor".
 * =============================================================
 */
const POINTS = [
  {
    icon: Smartphone,
    title: 'Nomor bersifat virtual',
    desc: 'Nomor yang dijual bersifat virtual tanpa kartu SIM fisik. Nomor hanya dapat menerima SMS OTP di dalam masa aktif yang tertera pada pesanan, bukan untuk telepon / SMS pribadi.',
  },
  {
    icon: BadgeAlert,
    title: 'Nomor ter-banned tidak dapat dipulihkan',
    desc: 'Jika nomor ter-banned (misalnya WhatsApp), maka nomor tidak dapat dipulihkan, di-refund, maupun diganti. Pastikan nomor masih bersih sebelum dipakai untuk registrasi penting dan jangan melanggar kebijakan aplikasi tujuan.',
  },
  {
    icon: Banknote,
    title: 'Pilih harga sesuai kebutuhan server',
    desc: 'Pilih harga yang sesuai dari beberapa pilihan Server. Tujuannya memberikan opsi layanan terbaik dengan harga yang bervariasi — server lebih mahal umumnya memiliki stok lebih stabil, kecepatan OTP lebih baik, dan tingkat keberhasilan lebih tinggi.',
  },
  {
    icon: Timer,
    title: 'OTP kedua tidak dijamin',
    desc: 'OTP berikutnya bergantung pada kemampuan nomor yang dibeli. Setelah OTP pertama diterima, masa aktif harus masih tersisa dan aktivasi belum ditutup. Pengiriman kode tetap bergantung pada aplikasi tujuan.',
  },
  {
    icon: ShieldCheck,
    title: 'Nomor sementara & refund',
    desc: 'Nomor bersifat sementara. Jangan mengandalkannya untuk login atau pemulihan akun setelah masa aktif habis. OTP yang sudah diterima tetap tidak dapat di-refund, termasuk saat menunggu kode berikutnya.',
  },
];

export default function OrderNomorGuidePage() {
  const navigate = useNavigate();

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      {/* Tombol kembali ke halaman Order Nomor */}
      <Reveal>
        <button
          onClick={() => navigate('/order-nomor')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali ke Order Nomor
        </button>
      </Reveal>

      {/* MODAL JUDUL HALAMAN */}
      <Reveal delay={30}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/30">
            <BookOpenCheck className="h-5 w-5" strokeWidth={2.3} />
          </span>
          <div>
            <h1 className="text-[24px] font-black leading-tight tracking-tight text-slate-900 sm:text-[28px] dark:text-white">
              Panduan & Kebijakan Order Nomor
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
              Wajib dibaca sebelum membeli nomor virtual / OTP.
            </p>
          </div>
        </div>
      </Reveal>

      {/* MODAL DAFTAR KEBIJAKAN */}
      <div className="mt-6 space-y-3">
        {POINTS.map((item, i) => (
          <Reveal key={item.title} delay={60 + i * 50}>
            <div className="flex gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:bg-slate-900 dark:border-slate-700">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 dark:bg-cyan-950/40">
                <item.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-slate-900 dark:text-white">
                  {i + 1}. {item.title}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">{item.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* MODAL CTA KEMBALI ORDER */}
      <Reveal delay={320}>
        <button
          onClick={() => navigate('/order-nomor')}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:opacity-90 active:scale-[0.99]"
        >
          Saya Mengerti — Kembali Order
        </button>
      </Reveal>
    </div>
  );
}
