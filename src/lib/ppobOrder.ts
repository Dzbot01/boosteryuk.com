/**
 * Aturan form order layanan PPOB (non-game) — dipakai halaman order per layanan
 * (/ppob/layanan/:id) supaya field yang diminta sesuai dokumentasi API penyedia.
 *
 * Dokumentasi transaksi penyedia (php-api/tokovoucher.php → POST /v1/transaksi):
 *   { ref_id, produk, tujuan, server_id, member_code, signature }
 * `ref_id`, `member_code`, `signature` dihitung server. Yang diminta dari user hanya:
 *   - `produk`  → kode produk asli dari katalog penyedia (dipilih di daftar produk)
 *   - `tujuan`  → nomor HP / ID pelanggan / nomor meter / email akun (ikut jenis layanan)
 *   - `server_id` → HANYA top up game (Mobile Legends), tidak dipakai layanan PPOB.
 */
import type { TvLayananKelompok } from '../services/tokovoucherApi';

/**
 * Slug kategori penyedia — HARUS sama dengan tv_slugify() di php-api/tokovoucher.php
 * (id kelompok = slug(kategori + ' ' + layanan), jadi slug kategori = awalan id kelompok).
 */
export function slugKategori(teks: string): string {
  return (teks || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

export interface FieldTujuan {
  /** Label field sesuai jenis layanan (mis. "Nomor HP", "ID Pelanggan PLN"). */
  label: string;
  placeholder: string;
  /** Penjelasan singkat + cara mengeceknya. */
  hint: string;
  /** Contoh nilai yang benar (ditampilkan sebagai chip contoh). */
  contoh: string[];
  tipeInput: 'tel' | 'text' | 'email';
  /** Pola validasi di browser; server tetap memvalidasi ulang. */
  pola: RegExp;
  min: number;
  max: number;
}

const NOMOR_HP: FieldTujuan = {
  label: 'Nomor HP',
  placeholder: '081234567890',
  hint: 'Nomor yang akan diisi. Pastikan nomornya aktif dan benar — pesanan yang masuk tidak bisa dibatalkan.',
  contoh: ['081234567890', '085712345678'],
  tipeInput: 'tel',
  pola: /^[0-9]{8,16}$/,
  min: 8,
  max: 16,
};

const NOMOR_INTERNASIONAL: FieldTujuan = {
  label: 'Nomor tujuan (kode negara)',
  placeholder: '66812345678',
  hint: 'Tulis nomor dengan kode negara tanpa tanda +, spasi, atau strip (contoh Thailand: 66 diikuti nomor).',
  contoh: ['66812345678', '60123456789'],
  tipeInput: 'tel',
  pola: /^[0-9]{8,18}$/,
  min: 8,
  max: 18,
};

const ID_PELANGGAN: FieldTujuan = {
  label: 'ID Pelanggan',
  placeholder: 'Nomor pelanggan / ID akun',
  hint: 'Nomor pelanggan yang tertera di tagihan atau aplikasi resmi penyedia layanan.',
  contoh: ['012345678901'],
  tipeInput: 'text',
  pola: /^[A-Za-z0-9._-]{4,40}$/,
  min: 4,
  max: 40,
};

const ID_METER: FieldTujuan = {
  label: 'ID Pelanggan / Nomor Meter',
  placeholder: '11 atau 12 digit ID PLN',
  hint: 'ID pelanggan PLN ada di struk token atau kartu PLN (11–12 digit). Token dikirim otomatis setelah bayar.',
  contoh: ['530123456789'],
  tipeInput: 'tel',
  pola: /^[0-9]{9,14}$/,
  min: 9,
  max: 14,
};

const NOMOR_BPJS: FieldTujuan = {
  label: 'Nomor Kartu BPJS',
  placeholder: '13 digit nomor kartu',
  hint: 'Nomor kartu BPJS Kesehatan (13 digit) peserta yang dibayarkan iurannya.',
  contoh: ['0001234567890'],
  tipeInput: 'tel',
  pola: /^[0-9]{10,16}$/,
  min: 10,
  max: 16,
};

const AKUN_EMAIL: FieldTujuan = {
  label: 'Email / Username akun',
  placeholder: 'nama@email.com atau username akun',
  hint: 'Akun tempat voucher atau langganan dikirim. Kode voucher juga tampil di Riwayat Pesanan.',
  contoh: ['nama@email.com', 'username_akun'],
  tipeInput: 'text',
  pola: /^[A-Za-z0-9._@+-]{3,64}$/,
  min: 3,
  max: 64,
};

const REKENING_TUJUAN: FieldTujuan = {
  label: 'Nomor rekening / akun tujuan',
  placeholder: 'Nomor rekening atau akun penerima',
  hint: 'Data penerima transfer dana. Periksa ulang sebelum membayar — transfer yang berhasil tidak dapat ditarik kembali.',
  contoh: ['0123456789'],
  tipeInput: 'text',
  pola: /^[A-Za-z0-9._-]{4,40}$/,
  min: 4,
  max: 40,
};

/**
 * Field `tujuan` untuk satu layanan: ditentukan dari kategori penyedia, lalu
 * diperhalus oleh nama layanan/operator & label produknya (BPJS, token PLN,
 * voucher digital, top up luar negeri, dst).
 */
export function fieldTujuan(g: Pick<TvLayananKelompok, 'kategori' | 'layanan' | 'labels'> | null): FieldTujuan {
  const kat = slugKategori(g?.kategori || '');
  const teks = `${g?.layanan || ''} ${(g?.labels || []).join(' ')}`.toLowerCase();

  if (/pln|token|listrik/.test(kat) || /token pln|meteran|listrik/.test(teks)) return ID_METER;
  if (/bpjs/.test(teks) || /bpjs/.test(kat)) return NOMOR_BPJS;
  if (/transfer-dana/.test(kat) || /transfer dana/.test(teks)) return REKENING_TUJUAN;
  if (/hiburan|voucher-digital/.test(kat)) return AKUN_EMAIL;
  if (/^tv$/.test(kat) || /parabola|nex parabola/.test(teks)) return ID_PELANGGAN;
  if (/pascabayar|tagihan|asuransi|pajak|tilang|pdam|\bair\b|internet-rumah|telkom/.test(kat) || /pascabayar|tagihan|asuransi|pajak|tilang|pdam/.test(teks)) return ID_PELANGGAN;
  if (/e-?money|e-?wallet|dompet/.test(kat) || /e-?money|e-?wallet|ovo|gopay|dana|shopee\s*pay|link\s*aja|astrapay|i\.saku|indrive|maxim|grab/.test(teks)) {
    return { ...NOMOR_HP, label: 'Nomor HP akun e-money', placeholder: '081234567890', hint: 'Nomor HP yang terdaftar di akun e-money tujuan. Saldo masuk otomatis setelah transaksi berhasil.' };
  }
  if (/malaysia|vietnam|thailand|singapore|internasional/.test(kat)) return NOMOR_INTERNASIONAL;
  if (/esim/.test(kat)) return AKUN_EMAIL;
  if (/pulsa|paket-data|voucher-data|telpon|sms|masa-aktif|aktivasi|injek/.test(kat)) return NOMOR_HP;

  // Kategori tak dikenal: nomor HP tetap aman untuk mayoritas layanan telekomunikasi,
  // dan server menolak nilai yang tidak sesuai pola karakter tujuan.
  return NOMOR_HP;
}

/** Nomor contoh pertama sebagai tombol isi cepat (mempermudah format yang benar). */
export function contohTujuan(f: FieldTujuan): string {
  return f.contoh[0] || '';
}

/** Pesan galat validasi `tujuan` (dipakai tombol order & onBlur). */
export function galatTujuan(nilai: string, f: FieldTujuan): string {
  const v = (nilai || '').trim();
  if (v === '') return `${f.label} wajib diisi.`;
  if (!f.pola.test(v)) {
    if (f.tipeInput === 'tel') return `${f.label} hanya angka, ${f.min}–${f.max} digit (tanpa spasi, +, atau strip).`;
    return `${f.label} tidak sesuai format (${f.min}–${f.max} karakter, tanpa spasi).`;
  }
  return '';
}

/**
 * Mode halaman order: 'grup' = satu layanan spesifik (mis. ACT AXIS),
 * 'kategori' = semua operator dalam satu kategori (mis. Aktivasi Perdana),
 * 'tak-dikenal' = id tidak ada di katalog penyedia.
 */
export function modeLayanan(id: string, kelompok: TvLayananKelompok[]): 'grup' | 'kategori' | 'tak-dikenal' {
  if (kelompok.some((k) => k.id === id)) return 'grup';
  const slug = slugKategori(id);
  if (kelompok.some((k) => slugKategori(k.kategori || '') === slug && slug !== '')) return 'kategori';
  return 'tak-dikenal';
}
