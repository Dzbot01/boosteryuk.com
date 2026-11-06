import { Info } from 'lucide-react';
import { InfoLayout, TextSection } from '../components/InfoLayout';

/** Halaman informasi tentang Boosteryuk. */
export default function AboutPage() {
  return (
    <InfoLayout
      title="Tentang Kami"
      intro="Boosteryuk menyediakan akses praktis ke berbagai layanan digital dalam satu platform."
      icon={Info}
    >
      <TextSection title="Misi kami">
        <p>
          Boosteryuk dibangun untuk membantu kreator, pemilik usaha, dan pengguna digital mengelola kebutuhan promosi
          media sosial serta layanan server dari satu tempat. Kami berfokus pada alur pemesanan yang jelas, pilihan
          layanan yang mudah dipahami, dan bantuan pelanggan yang dapat dihubungi secara langsung.
        </p>
      </TextSection>
      <TextSection title="Layanan">
        <p>
          Platform menyediakan layanan booster media sosial, pengelolaan saldo untuk pembelian di dalam aplikasi, dan
          pilihan server digital. Ketersediaan, harga, estimasi waktu, serta spesifikasi dapat berbeda untuk tiap
          layanan dan ditampilkan pada halaman pemesanan.
        </p>
      </TextSection>
      <TextSection title="Dukungan manusia">
        <p>
          Dukungan pelanggan ditangani oleh admin. Kami tidak mengklaim dukungan otomatis sebagai layanan manusia;
          untuk bantuan pesanan atau pembayaran, hubungi admin melalui WhatsApp atau email pada halaman Kontak
          Support. Jam operasional harian dapat dilihat pada profil media komunikasi admin.
        </p>
      </TextSection>
      <TextSection title="Hubungan dengan platform pihak ketiga">
        <p>
          Boosteryuk adalah layanan independen dan bukan bagian dari, tidak disponsori oleh, dan tidak mewakili
          Instagram, TikTok, YouTube, Facebook, atau platform media sosial lainnya. Pengguna tetap wajib mematuhi
          kebijakan masing-masing platform.
        </p>
      </TextSection>
    </InfoLayout>
  );
}
