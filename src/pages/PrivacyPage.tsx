import { ShieldCheck } from 'lucide-react';
import { InfoLayout, TextSection } from '../components/InfoLayout';
import { SUPPORT_EMAIL } from '../constants';

/** Halaman kebijakan privasi. */
export default function PrivacyPage() {
  return (
    <InfoLayout
      title="Kebijakan Privasi"
      intro="Kebijakan ini menjelaskan data yang digunakan Boosteryuk untuk menyediakan layanan, memproses pesanan, dan membantu pelanggan."
      icon={ShieldCheck}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-400">
        Terakhir diperbarui: 2026
      </p>
      <TextSection title="Informasi yang kami gunakan">
        <p>
          Saat Anda menggunakan layanan, kami dapat memproses nama pengguna, alamat email, nomor kontak yang Anda
          berikan, tautan atau username target pesanan, rincian transaksi, serta komunikasi dengan tim dukungan.
          Informasi teknis seperti alamat IP, jenis perangkat, dan catatan akses dapat digunakan untuk keamanan dan
          pemecahan masalah.
        </p>
      </TextSection>
      <TextSection title="Penggunaan informasi">
        <p>
          Data digunakan untuk mengelola akun dan pesanan, mengirimkan layanan ke target yang Anda pilih, memproses
          deposit melalui penyedia pembayaran, memberi kabar tentang status transaksi, menjawab permintaan dukungan,
          dan mencegah penyalahgunaan atau aktivitas yang melanggar hukum.
        </p>
      </TextSection>
      <TextSection title="Pembayaran dan penyedia layanan">
        <p>
          Pembayaran online dapat diproses oleh payment gateway seperti Tripay. Data transaksi yang diperlukan akan
          diteruskan kepada penyedia tersebut. Detail autentikasi atau kredensial aplikasi pembayaran Anda tidak
          diminta oleh Boosteryuk dan jangan pernah dibagikan kepada siapa pun.
        </p>
        <p>
          Data target pesanan hanya dibagikan kepada penyedia layanan yang dibutuhkan untuk memproses pesanan. Kami
          tidak menjual data pribadi pelanggan untuk kepentingan iklan pihak lain.
        </p>
      </TextSection>
      <TextSection title="Penyimpanan dan keamanan">
        <p>
          Kami menerapkan langkah teknis dan operasional yang wajar untuk melindungi data. Informasi transaksi dapat
          disimpan selama diperlukan untuk memenuhi pesanan, dukungan pelanggan, pencatatan keuangan, keamanan, dan
          kewajiban hukum yang berlaku.
        </p>
      </TextSection>
      <TextSection title="Pilihan dan permintaan data">
        <p>
          Anda dapat meminta koreksi atau penghapusan data akun yang tidak lagi dibutuhkan dengan menghubungi support.
          Sebagian data transaksi mungkin tetap disimpan apabila diwajibkan untuk pencatatan, penyelesaian sengketa,
          atau kepatuhan hukum.
        </p>
      </TextSection>
      <TextSection title="Perubahan kebijakan">
        <p>
          Kebijakan dapat diperbarui ketika layanan atau ketentuan hukum berubah. Versi terbaru akan dipublikasikan di
          halaman ini. Jika ada pertanyaan, hubungi{' '}
          <a className="font-bold text-cyan-700 underline decoration-cyan-300 underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </TextSection>
    </InfoLayout>
  );
}
