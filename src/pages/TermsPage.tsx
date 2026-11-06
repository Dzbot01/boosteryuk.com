import { FileText } from 'lucide-react';
import { InfoLayout, TextSection } from '../components/InfoLayout';

/** Halaman syarat & ketentuan layanan. */
export default function TermsPage() {
  return (
    <InfoLayout
      title="Syarat & Ketentuan"
      intro="Dengan membuat akun, melakukan deposit, atau memesan layanan Boosteryuk, Anda menyetujui ketentuan berikut."
      icon={FileText}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-400">
        Terakhir diperbarui: 2026
      </p>
      <TextSection title="1. Akun dan informasi pesanan">
        <p>
          Anda bertanggung jawab atas keamanan akun serta keakuratan data, tautan, username, server, dan konfigurasi
          yang dimasukkan. Pastikan target dapat diakses sesuai persyaratan layanan. Kesalahan target atau perubahan
          privasi akun dapat menghambat pemrosesan.
        </p>
      </TextSection>
      <TextSection title="2. Layanan booster media sosial">
        <p>
          Layanan booster diproses melalui penyedia pihak ketiga. Estimasi waktu merupakan perkiraan dan dapat berubah
          karena antrean, perubahan sistem, atau kebijakan platform tujuan. Boosteryuk tidak menjamin hasil organik,
          jangkauan, engagement, atau keberlangsungan akun di luar ruang lingkup layanan yang dipesan.
        </p>
        <p>
          Jangan mengubah target, menghapus konten, atau menjadikan akun privat ketika pesanan sedang berjalan, kecuali
          instruksi layanan menyatakan lain. Pesanan yang sudah mulai diproses tidak selalu dapat dibatalkan.
        </p>
      </TextSection>
      <TextSection title="3. Voucher jika pesanan belum masuk">
        <p>
          Jika pesanan booster belum masuk atau belum terpenuhi dalam waktu <strong>2 × 24 jam</strong> sejak status
          pesanan diproses, Anda berhak meminta <strong>voucher gratis</strong>. Hubungi Customer Service dengan
          menyertakan ID pesanan dan bukti status. Setelah pesanan diverifikasi, admin akan memberikan voucher untuk
          digunakan pada pembelian layanan di dalam aplikasi.
        </p>
      </TextSection>
      <TextSection title="4. Saldo, deposit, dan pembayaran">
        <p>
          Saldo akun hanya dapat digunakan untuk pembelian layanan di dalam aplikasi. <strong>Saldo tidak dapat
          dicairkan, diuangkan, ditarik ke rekening, atau dipindahtangankan</strong>, kecuali diwajibkan oleh hukum
          atau disetujui secara tertulis oleh Boosteryuk.
        </p>
        <p>
          Deposit dianggap berhasil setelah pembayaran terverifikasi. Bonus deposit, voucher, dan promo merupakan
          manfaat non-tunai; semuanya tidak dapat ditukar menjadi uang dan mengikuti periode serta syarat promo yang
          berlaku.
        </p>
      </TextSection>
      <TextSection title="5. Penggunaan yang dilarang">
        <p>
          Layanan tidak boleh digunakan untuk aktivitas ilegal, penipuan, pelanggaran hak pihak lain, penyebaran
          konten berbahaya, atau tindakan yang melanggar ketentuan platform tujuan. Boosteryuk dapat menolak atau
          menghentikan pesanan yang berisiko disalahgunakan.
        </p>
      </TextSection>
      <TextSection title="6. Perubahan ketentuan dan bantuan">
        <p>
          Ketentuan dapat diperbarui sewaktu-waktu. Versi terbaru berlaku sejak dipublikasikan. Untuk klaim voucher,
          pertanyaan saldo, atau kendala layanan, hubungi support melalui halaman Kontak Support dengan ID pesanan
          terkait.
        </p>
      </TextSection>
    </InfoLayout>
  );
}
