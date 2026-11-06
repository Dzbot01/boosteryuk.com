import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  Headset,
  Mail,
  MessageCircle,
  X,
} from 'lucide-react';
import { InfoLayout, TextSection } from '../components/InfoLayout';
import { SUPPORT_EMAIL, WHATSAPP_ADMIN } from '../constants';

const WA_URL = `https://wa.me/${WHATSAPP_ADMIN.intl}`;

/** Halaman kontak support dengan modal pemberitahuan Customer Service. */
export default function SupportPage() {
  const [noticeOpen, setNoticeOpen] = useState(true);

  // Modal bisa ditutup dengan Escape.
  useEffect(() => {
    if (!noticeOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNoticeOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [noticeOpen]);

  return (
    <>
      <InfoLayout
        title="Kontak Support"
        intro="Hubungi admin secara langsung untuk bantuan akun, pembayaran, pesanan, atau layanan server."
        icon={Headset}
      >
        <TextSection title="Media dukungan">
          <p>
            Pilih WhatsApp untuk bantuan langsung atau email untuk menyampaikan detail yang lebih lengkap. Sertakan
            username dan ID pesanan jika pertanyaan berkaitan dengan transaksi.
          </p>
        </TextSection>

        {/* Kartu media kontak — aksi langsung, bukan kartu dekoratif. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={WA_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex min-h-28 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 transition-colors hover:bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:hover:bg-emerald-950/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <MessageCircle className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-emerald-700">WhatsApp Admin</span>
              <span className="mt-1 block text-[15px] font-extrabold text-slate-900 dark:text-white">{WHATSAPP_ADMIN.display}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                Chat WhatsApp <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </span>
          </a>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="group flex min-h-28 items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 transition-colors hover:bg-cyan-50 dark:bg-cyan-950/40 dark:border-cyan-800/60 dark:hover:bg-cyan-950/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white">
              <Mail className="h-5 w-5" strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-cyan-700">Email Support</span>
              <span className="mt-1 block break-all text-[14px] font-extrabold text-slate-900 dark:text-white">{SUPPORT_EMAIL}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-cyan-700">
                Tulis email <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </span>
          </a>
        </div>

        <TextSection title="Jam operasional">
          <p>
            Jam operasional harian mengikuti informasi terbaru pada profil WhatsApp admin. Silakan cek profil sebelum
            menghubungi; pesan yang dikirim di luar jam layanan akan dibalas saat admin kembali online.
          </p>
        </TextSection>

        <button
          type="button"
          onClick={() => setNoticeOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-bold text-slate-700 transition-colors hover:border-cyan-300 hover:text-cyan-700 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700"
        >
          <Clock3 className="h-4 w-4" />
          Baca informasi sebelum menghubungi
        </button>
      </InfoLayout>

      {/* MODAL INFO CUSTOMER SERVICE — dibuka otomatis saat halaman support dibuka. */}
      {noticeOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNoticeOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-notice-title"
            className="animate-fade-up w-full max-w-md overflow-hidden rounded-[22px] border border-white/60 bg-white shadow-[0_28px_80px_-24px_rgba(15,23,42,.65)] dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-600">Customer Support</p>
                <h2 id="support-notice-title" className="mt-1 text-[18px] font-black tracking-tight text-slate-900 dark:text-white">
                  Hubungi admin langsung
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNoticeOpen(false)}
                aria-label="Tutup informasi support"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-[14px] font-semibold leading-7 text-slate-700 dark:text-slate-200">
                Customer Service bukan Ai! Hubungi Admin secara langsung dari media platform dibawah ini ya dan cek
                profil waktu jam operasional hariannya.
              </p>

              <div className="mt-4 space-y-2">
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-left transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700">WhatsApp</span>
                    <span className="block text-[13px] font-extrabold text-slate-900 dark:text-white">{WHATSAPP_ADMIN.display}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                </a>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-3 rounded-xl bg-cyan-50 px-3.5 py-3 text-left transition-colors hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/40"
                >
                  <Mail className="h-4 w-4 shrink-0 text-cyan-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-cyan-700">Email</span>
                    <span className="block break-all text-[13px] font-extrabold text-slate-900 dark:text-white">{SUPPORT_EMAIL}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-cyan-600" />
                </a>
              </div>

              <button
                type="button"
                onClick={() => setNoticeOpen(false)}
                className="mt-4 h-11 w-full rounded-xl bg-slate-900 text-[13px] font-bold text-white transition-colors hover:bg-slate-800 active:scale-[0.99]"
              >
                Saya mengerti
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
