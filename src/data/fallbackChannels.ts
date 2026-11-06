import type { PaymentChannel } from '../services/tripay';

/**
 * =============================================================
 *  FALLBACK_CHANNELS — salinan respon GET /merchant/payment-channel
 * -------------------------------------------------------------
 *  Dipakai hanya bila browser memblokir permintaan langsung ke
 *  Tripay (CORS) sehingga daftar channel aktif tidak bisa
 *  diambil. Isi & urutan sama seperti respon asli Tripay.
 *  Sinkronkan bila merchant menambah/menghapus channel.
 * ============================================================= */
export const FALLBACK_CHANNELS: PaymentChannel[] = [
  { group: 'Virtual Account', code: 'MYBVA', name: 'Maybank Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'PERMATAVA', name: 'Permata Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'BNIVA', name: 'BNI Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'BRIVA', name: 'BRI Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'MANDIRIVA', name: 'Mandiri Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'BCAVA', name: 'BCA Virtual Account', type: 'direct', fee_merchant: { flat: 5500, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 5500, percent: 0 }, minimum_fee: 5500, maximum_fee: 6000, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'SMSVA', name: 'Sinarmas Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'MUAMALATVA', name: 'Muamalat Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'CIMBVA', name: 'CIMB Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Virtual Account', code: 'SAMPOERNAVA', name: 'Sahabat Sampoerna Virtual Account', type: 'direct', fee_merchant: { flat: 4250, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 4250, percent: 0 }, minimum_fee: 4000, maximum_fee: 4500, minimum_amount: 10000, maximum_amount: 10000000, active: true },
  { group: 'Convenience Store', code: 'ALFAMART', name: 'Alfamart', type: 'direct', fee_merchant: { flat: 6000, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 6000, percent: 0 }, minimum_fee: 5500, maximum_fee: 6500, minimum_amount: 10000, maximum_amount: 2500000, active: true },
  { group: 'Convenience Store', code: 'INDOMARET', name: 'Indomaret', type: 'direct', fee_merchant: { flat: 3500, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 3500, percent: 0 }, minimum_fee: 3000, maximum_fee: 4000, minimum_amount: 10000, maximum_amount: 2500000, active: true },
  { group: 'Convenience Store', code: 'ALFAMIDI', name: 'Alfamidi', type: 'direct', fee_merchant: { flat: 6000, percent: 0 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 6000, percent: 0 }, minimum_fee: 5500, maximum_fee: 6500, minimum_amount: 10000, maximum_amount: 2500000, active: true },
  { group: 'E-Wallet', code: 'QRIS', name: 'QRIS by ShopeePay', type: 'direct', fee_merchant: { flat: 750, percent: 0.7 }, fee_customer: { flat: 0, percent: 0 }, total_fee: { flat: 750, percent: 0.7 }, minimum_fee: 750, maximum_fee: 1000, minimum_amount: 1000, maximum_amount: 5000000, active: true },
];

/** Cari channel berdasarkan kode, dari data live maupun fallback. */
export function findChannel(channels: PaymentChannel[], code: string | undefined): PaymentChannel | null {
  if (!code) return null;
  const target = code.toUpperCase();
  return channels.find((channel) => channel.code.toUpperCase() === target) ?? null;
}
