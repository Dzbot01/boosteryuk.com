/**
 * Klien API transaksi TokoVoucher (top up game) — php-api/tokovoucher.php.
 *
 * SEMUA rahasia (secret key & perhitungan signature MD5) ada di server; browser hanya
 * mengirim token login + data pesanan, lalu menerima hasil dari penyedia.
 */
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/tokovoucher.php`;

const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

type Res<T> = T & {
  ok: boolean;
  message?: string;
  /**
   * true bila kegagalan terjadi di JALAN (browser tidak sampai ke server / balasan
   * bukan JSON). Nasib pesanan tidak pasti -> UI memperlakukannya sebagai PENDING,
   * bukan error: pesanan bisa saja sudah tercatat di server.
   */
  transport?: boolean;
};

async function get<T>(qs: string): Promise<Res<T>> {
  try {
    const r = await fetch(`${API}?${qs}`, { cache: 'no-store' });
    return ((await r.json().catch(() => null)) || { ok: false, transport: true, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, transport: true, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<Res<T>> {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token(), action, ...body }),
    });
    return ((await r.json().catch(() => null)) || { ok: false, transport: true, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, transport: true, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export interface TvStatus {
  /** true bila user_code & secret sudah diisi di server (php-api/tokovoucher_config.php). */
  configured: boolean;
  /** user_code tersamarkan, mis. U261***568YV — untuk tampilan info saja. */
  user_code: string;
}

export interface TvTransaksi {
  ref_id: string;
  /** Status penyedia: pending | sukses | gagal | error | unknown. */
  status?: string;
  message?: string;
  /** error_msg asli penyedia bila ditolak (mis. "Ip Not Allow", "Signature Invalid"). */
  error_msg?: string;
  /** ID transaksi TokoVoucher (TRXID) bila ada. */
  trx_id?: string;
  /** Serial number / alasan gagal dari penyedia. */
  sn?: string;
  price?: number;
  sisa_saldo?: number;
  /** Varian panggilan yang dipakai server: "POST+signature" (docs) atau "GET+secret" (fallback). */
  metode?: string;
  /* ----- tambahan untuk pesanan top up game & PPOB (harga/saldo dihitung server) ----- */
  /** Jenis pesanan yang dikenali server dari katalog: 'topup' (game) | 'ppob' (layanan). */
  jenis?: 'topup' | 'ppob';
  /** Nama produk asli penyedia yang dipesan. */
  produk_nama?: string;
  /** Nama game / layanan penyedia. */
  layanan?: string;
  /** Harga jual yang DITAGIH ke user (modal + markup), dihitung server. */
  harga?: number;
  /** Harga modal dari katalog penyedia. */
  harga_modal?: number;
  /** Persen markup yang dipakai server (child panel atau sistem). */
  markup_pct?: number;
  /** Sisa saldo website setelah pesanan dibuat (bila server mengirim). */
  saldo?: number;
  /**
   * true bila pesanan berstatus PENDING sesuai aturan API penyedia: semua HTTP error
   * dan network timeout diset PENDING (bukan gagal), saldo TIDAK dikembalikan, dan
   * status final menunggu callback penyedia / cek berkala tiap 10 menit.
   */
  pending?: boolean;
  /** Alasan PENDING dari server (mis. "HTTP 500 dari penyedia", "timeout"). */
  alasan_pending?: string;
  /** Nominal saldo yang benar-benar dipotong untuk pesanan ini (0 = belum dipotong). */
  saldo_dipotong?: number;
  /** Cuplikan respons asli penyedia untuk troubleshooting. */
  raw?: string;
  /** Balasan mentah penyedia (sudah dibuang field sensitif) untuk detail/troubleshooting. */
  provider?: Record<string, unknown>;
}

/** Info konfigurasi integrasi (aman: tanpa secret). */
export const tvStatus = () => get<TvStatus>('action=status');

/**
 * Ajukan transaksi top up ke penyedia lewat proxy server.
 * `server_id` boleh kosong bila produk tidak memilikinya.
 */
export const tvTransaksi = (body: { player_id: string; server_id?: string; kode_produk: string }) =>
  post<TvTransaksi>('transaksi', body);

export interface TvPricelistItem {
  kode: string;
  nama: string;
  harga: number;
  butuh_server?: boolean;
  /** Varian/wilayah produk (mis. "Free Fire ID Fast", "Free Fire SG") untuk chip wilayah. */
  jenis?: string;
  /** true = varian Indonesia; false = server luar/Promo (chip tersendiri). */
  wilayah_ok?: boolean;
}

export interface TvPricelist {
  /** Asal data: provider (pricelist live), override (file server), snapshot (bundel), kosong. */
  source: 'provider' | 'override' | 'snapshot' | 'kosong';
  updated_at?: string;
  game?: string;
  items: TvPricelistItem[];
}

/**
 * Katalog produk ASLI untuk satu game dari proxy server (pricelist penyedia /
 * file override server). Dipakai halaman detail supaya tidak ada kode karangan.
 */
export const tvPricelist = (game?: string) =>
  get<TvPricelist>('action=pricelist' + (game ? `&game=${encodeURIComponent(game)}` : ''));

export interface TvKatalogGroup {
  /** Nama tampil game (kategori Topup, server ID Indonesia). */
  game: string;
  slug: string;
  jumlah: number;
  termurah: number;
  labels: string[];
  /** Logo resmi game dari penyedia (bila ada). */
  logo?: string;
}

export interface TvKatalog {
  ok: boolean;
  source: 'provider' | 'kosong';
  groups: TvKatalogGroup[];
  updated_at?: string;
}

/**
 * Daftar game top up LIVE dari penyedia (kategori Topup + ID Indonesia saja):
 * dipakai grid kartu /topup supaya tidak hardcode dan game baru penyedia ikut muncul.
 */
export const tvKatalog = () => get<TvKatalog>('action=katalog');

export interface TvLayananKelompok {
  /** id kelompok (slug kategori + nama layanan) — dipakai mengambil daftar produknya. */
  id: string;
  /** Nama layanan/operator asli penyedia (mis. "AIS", "TrueMove H", "DTAC", "OVO"). */
  layanan: string;
  /** Kategori penyedia (mis. "Pulsa", "Paket Data", "E-Money") — kosong bila tidak dikirim. */
  kategori: string;
  /** Logo resmi dari penyedia (boleh kosong). */
  logo?: string;
  jumlah: number;
  termurah: number;
  termahal: number;
  /** Contoh varian (jenis) di layanan ini. */
  labels: string[];
}

export interface TvLayanan {
  /** provider = katalog live; kosong = penyedia tidak punya layanan non-game. */
  source: 'provider' | 'kosong';
  sumber?: string;
  total_produk?: number;
  kelompok: TvLayananKelompok[];
  /** Diagnostik: daftar kategori & operator asli penyedia (untuk menyetel filter). */
  kategori_penyedia?: string[];
  operator_penyedia?: string[];
  updated_at?: string;
}

/**
 * Layanan SELAIN top up game dari katalog penuh penyedia (/member/produk/full):
 * pulsa, paket data, e-money, voucher, token listrik, tagihan, operator telekomunikasi.
 * Dipakai card "Menu Service" di halaman PPOB dan grid kartu halaman "Lainnya".
 */
export const tvLayanan = () => get<TvLayanan>('action=layanan&cb=' + Date.now().toString(36));

export interface TvLayananProdukItem {
  kode: string;
  nama: string;
  harga: number;
  jenis?: string;
}

/** Daftar produk (denominasi/varian) satu layanan, urut dari yang termurah. */
export const tvLayananProduk = (kelompok: string) =>
  get<{ kelompok: TvLayananKelompok | null; items: TvLayananProdukItem[]; updated_at?: string }>(
    'action=layanan_produk&kelompok=' + encodeURIComponent(kelompok),
  );

export interface TvCekAkun {
  ok: boolean;
  valid: boolean;
  /** Nama akun di game bila ditemukan (mis. "¥Vino_TZY™"). */
  username: string;
  /**
   * Alasan gagal: unconfigured | koneksi | ditolak | non_json | tanpa_data | not_found | unsupported.
   * Selain not_found, UI menampilkan pesannya (diagnostik) bersama `raw`.
   */
  reason?: string;
  message?: string;
  /** Cuplikan respons ASLI apigames untuk troubleshooting. */
  raw?: string;
  http?: number;
}

/**
 * Cek akun target lewat apigames.id (Free Fire & Mobile Legends).
 * Akun tidak ditemukan (reason:not_found) => UI melewatinya senyap;
 * kegagalan teknis => pesan + respons asli ditampilkan.
 */
export const tvCekAkun = (game: string, userId: string) =>
  get<TvCekAkun>('action=cek_akun&game=' + encodeURIComponent(game) + '&user_id=' + encodeURIComponent(userId));

export interface TvCekStatus {
  ref_id: string;
  /** Sumber jawaban: webhook penyedia (pasti) atau provider (cek langsung). */
  sumber?: 'webhook' | 'provider';
  /** pending | sukses | gagal | error | unknown. */
  status?: string;
  /** true = status belum pasti (penyedia tak terjangkau/menunggu) -> tetap PENDING. */
  pending?: boolean;
  /** Alasan status belum pasti. */
  alasan_pending?: string;
  trx_id?: string;
  sn?: string;
  message?: string;
  error_msg?: string;
  price?: number;
  raw?: string;
  /** Balasan mentah penyedia (sudah dibersihkan) berisi status transaksi. */
  provider?: Record<string, unknown>;
}

/**
 * Cek status transaksi per ref_id: status yang sudah dilaporkan webhook dipakai dulu,
 * selain itu POST /v1/transaksi/status {ref_id, member_code, signature} ke penyedia.
 */
export const tvCekStatus = (ref_id: string) =>
  get<TvCekStatus>('action=cek_status&ref_id=' + encodeURIComponent(ref_id));

export interface TvPendingSync {
  /** Berapa ref yang benar-benar ditanyakan ke penyedia pada putaran ini. */
  diperiksa?: number;
  /** Berapa pesanan yang mendapat status final (sukses -> selesai, gagal -> refund). */
  selesai?: number;
  /** Sisa detik menuju pemeriksaan berkala berikutnya (throttle server: 10 menit). */
  menunggu?: number;
  interval_detik?: number;
  hasil?: { ref_id: string; status: string; alasan?: string; sn?: string }[];
}

/**
 * Pemeriksaan berkala transaksi PENDING (aturan API TokoVoucher: setiap 10 menit).
 * Server menahan laju per user, jadi aman dipanggil setiap kali Riwayat Pesanan dibuka.
 */
export const tvPendingSync = (maks = 3) =>
  get<TvPendingSync>(
    'action=pending_sync&maks=' + encodeURIComponent(String(maks)) + '&token=' + encodeURIComponent(token()),
  );
