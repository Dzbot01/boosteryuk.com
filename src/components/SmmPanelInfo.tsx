import { Link } from 'react-router-dom';
import { staticSeo, type SeoFaq } from '../seo/content';

const PLATFORMS: [string, string][] = [
  ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['threads', 'Threads'], ['telegram', 'Telegram'],
  ['whatsapp', 'WhatsApp'], ['shopee', 'Shopee'], ['tokopedia', 'Tokopedia'], ['linkedin', 'LinkedIn'], ['snackvideo', 'SnackVideo'], ['roblox', 'Roblox'],
];

/**
 * Konten informasi halaman /layanan (SMM Panel): apa itu SMM panel, cara kerja, layanan, deposit & pemesanan,
 * harga & saldo, FAQ. Ditulis untuk calon pelanggan — bukan pengulangan kata kunci.
 */
export default function SmmPanelInfo() {
  const faq: SeoFaq[] = staticSeo('/layanan')?.faq || [];
  const h2 = 'font-display text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white';
  const p = 'mt-2 text-[14.5px] leading-[1.75] text-slate-600 dark:text-slate-300';
  const a = 'font-semibold text-cyan-700 underline decoration-cyan-700/30 underline-offset-2 hover:decoration-cyan-700 dark:text-cyan-400';
  return (
    <section aria-labelledby="smm-info" className="mt-14 border-t border-slate-200 pt-10 dark:border-slate-800">
      <div className="mx-auto max-w-3xl">
        <h2 id="smm-info" className={h2}>Apa itu SMM panel?</h2>
        <p className={p}>
          SMM panel adalah situs tempat kamu memesan layanan <i>social media marketing</i> secara mandiri: menambah followers, likes, views,
          atau anggota grup tanpa harus chat penjual satu per satu. Kamu memilih layanan, memasukkan link atau username, menentukan jumlah,
          lalu membayar dari saldo akun. Penjelasan lengkapnya ada di artikel{' '}
          <Link className={a} to="/artikel/apa-itu-smm-panel">Apa Itu SMM Panel?</Link>
        </p>

        <h2 className={`${h2} mt-9`}>Bagaimana cara kerjanya?</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14.5px] leading-[1.7] text-slate-600 marker:font-bold marker:text-cyan-700 dark:text-slate-300">
          <li>Isi saldo akun lewat menu <Link className={a} to="/deposit">Deposit</Link>.</li>
          <li>Pilih kategori dan layanan di card Buat Pesanan di atas, lalu baca keterangannya.</li>
          <li>Masukkan link atau username target yang bersifat publik dan jumlah pesanan.</li>
          <li>Klik Pesan. Pesanan diteruskan otomatis ke sistem penyedia dan mulai diproses.</li>
          <li>Pantau status di <Link className={a} to="/riwayat-pesanan">Riwayat Pesanan</Link> atau <Link className={a} to="/cek-status">Cek Status</Link>.</li>
        </ol>

        <h2 className={`${h2} mt-9`}>Layanan yang tersedia di Boosteryuk</h2>
        <p className={p}>Layanan dikelompokkan per platform. Buka platform untuk melihat layanan yang sedang aktif, waktu mulai, serta batas minimal dan maksimal.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PLATFORMS.map(([slug, name]) => (
            <li key={slug}>
              <Link to={`/layanan/${slug}`} className="inline-block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {name}
              </Link>
            </li>
          ))}
        </ul>
        <p className={p}>
          Di luar layanan SMM, ada <Link className={a} to="/artikel/apa-itu-agent-ai">Sewa Agen AI</Link> untuk membalas pelanggan WhatsApp
          otomatis, paket <Link className={a} to="/plus">Plus</Link> dengan harga layanan lebih murah, dan paket EXTRA untuk membuka{' '}
          <Link className={a} to="/artikel/apa-itu-child-panel">child panel</Link> dengan merek dan harga sendiri.
        </p>

        <h2 className={`${h2} mt-9`}>Deposit, harga, dan sistem saldo</h2>
        <p className={p}>
          Semua pesanan dibayar dari saldo akun. Saldo bisa diisi lewat QRIS, virtual account bank, atau gerai ritel, dan masuk setelah
          pembayaran terkonfirmasi. Harga setiap layanan ditulis <b>per 1.000</b>: memesan 500 dari layanan Rp10.000/1.000 berarti saldo
          terpotong Rp5.000. Total biaya selalu tampil sebelum kamu menekan tombol Pesan. Pesanan yang dibatalkan penyedia atau hanya terpenuhi
          sebagian dikembalikan sebagai saldo.
        </p>

        {faq.length > 0 && (
          <>
            <h2 className={`${h2} mt-9`}>Pertanyaan yang sering diajukan</h2>
            <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {faq.map((f) => (
                <details key={f.q} className="group py-3.5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[14.5px] font-bold text-slate-800 dark:text-slate-100">
                    {f.q}
                    <span aria-hidden="true" className="text-[18px] font-normal leading-none text-slate-400 group-open:hidden">+</span>
                    <span aria-hidden="true" className="hidden text-[18px] font-normal leading-none text-slate-400 group-open:inline">–</span>
                  </summary>
                  <p className="mt-2 text-[14px] leading-[1.7] text-slate-600 dark:text-slate-300">{f.a}</p>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
