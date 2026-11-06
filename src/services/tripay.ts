/**
 * =============================================================
 *  services/tripay.ts — integrasi Tripay Payment Gateway
 * -------------------------------------------------------------
 *  • Signature dibuat dengan HMAC-SHA256 (Web Crypto API)
 *    sesuai dokumentasi Tripay: hash(privateKey, merchantRef+amount)
 *  • Base URL bisa sandbox / production
 *  • Tersedia opsi proxy, karena API Tripay tidak mengizinkan
 *    pemanggilan langsung dari browser (CORS).
 *
 *  ⚠ PRIVATE KEY di file ini terlihat oleh siapa pun yang membuka
 *    halaman. Untuk produksi, pindahkan pemanggilan ke backend.
 * ============================================================= */

const LS_KEY = 'boosteryuk.tripay.config.v1';

export const TRIPAY_SANDBOX = 'https://tripay.co.id/api-sandbox';
export const TRIPAY_PRODUCTION = 'https://tripay.co.id/api';

/**
 * URL proxy resmi (Cloudflare Worker) untuk daftar channel pembayaran.
 * Endpoint ini menangani CORS + menyisipkan Authorization di server,
 * sehingga daftar channel bisa diambil langsung dari browser.
 */
export const TRIPAY_CHANNELS_PROXY =
  'https://api.boosteryuk.com/api/tripay/channels';

/**
 * URL worker untuk membuat transaksi deposit (POST /create).
 * Worker menambahkan signature HMAC + Authorization di sisi server,
 * jadi browser tidak perlu (dan tidak boleh) memegang private key.
 */
export const TRIPAY_CREATE_PROXY = 'https://api.boosteryuk.com/api/tripay/create';

export interface TripayConfig {
  apiKey: string;
  privateKey: string;
  baseUrl: string;
  /** URL proxy/backend Anda. Kosong = panggil Tripay langsung (butuh CORS). */
  proxyUrl: string;
}

export const DEFAULT_TRIPAY_CONFIG: TripayConfig = {
  apiKey: '*********',
  privateKey: '********',
  baseUrl: TRIPAY_SANDBOX,
  proxyUrl: '',
};

export function loadConfig(): TripayConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_TRIPAY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<TripayConfig>;
    return { ...DEFAULT_TRIPAY_CONFIG, ...parsed };
  } catch {
    return DEFAULT_TRIPAY_CONFIG;
  }
}

export function saveConfig(config: TripayConfig) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    /* penyimpanan lokal tidak tersedia */
  }
}

/* ------------------------------ signature ------------------------------ */

/** Ubah ArrayBuffer menjadi string hex (lowercase). */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** HMAC-SHA256 → hex, memakai Web Crypto API. */
export async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Web Crypto tidak tersedia. Buka halaman ini lewat HTTPS atau localhost agar signature bisa dibuat.',
    );
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(signature);
}

/* -------------------------------- types -------------------------------- */

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  product_url?: string;
  image_url?: string;
}

export interface Instruction {
  title: string;
  steps: string[];
}

export interface TripayTransaction {
  reference: string;
  merchant_ref: string;
  payment_method: string;
  payment_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  /** Total yang harus dibayar customer (sudah termasuk biaya customer). */
  amount: number;
  fee_merchant: number;
  fee_customer: number;
  total_fee: number;
  amount_received: number;
  /**
   * Nominal deposit murni yang dimasukkan user (tanpa fee).
   * Sumber: input user, atau amount - fee_customer dari respon Tripay.
   */
  deposit_amount: number;
  /** Total tagihan = data.amount dari Tripay. */
  total_due: number;
  /** Saldo yang masuk ke akun user setelah pembayaran. */
  saldo_masuk: number;
  pay_code: string | null;
  pay_url: string | null;
  checkout_url: string;
  status: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUND';
  expired_time: number;
  order_items: OrderItem[];
  instructions: Instruction[];
  qr_string: string | null;
  qr_url: string | null;
  created_time?: number;
}

export interface CreateTransactionInput {
  method: string;
  merchantRef: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderItems: OrderItem[];
  callbackUrl?: string;
  returnUrl?: string;
  expiredTime?: number;
}

export class TripayError extends Error {
  constructor(
    message: string,
    readonly kind: 'api' | 'network' | 'cors' | 'config',
  ) {
    super(message);
    this.name = 'TripayError';
  }
}

/* ------------------------------ transport ------------------------------ */

/** Bangun URL final — lewat proxy bila dikonfigurasi. */
function resolveUrl(config: TripayConfig, path: string): string {
  const target = `${config.baseUrl}${path}`;
  if (!config.proxyUrl.trim()) return target;
  const proxy = config.proxyUrl.trim();
  return `${proxy}${proxy.includes('?') ? '&' : '?'}target=${encodeURIComponent(target)}`;
}

async function request<T>(config: TripayConfig, path: string, init: RequestInit): Promise<T> {
  if (!config.apiKey.trim()) {
    throw new TripayError('API Key belum diisi. Buka panel "Pengaturan API".', 'config');
  }

  let response: Response;
  try {
    response = await fetch(resolveUrl(config, path), {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TripayError(
      `Tidak dapat menghubungi Tripay (${message}). API Tripay tidak mengizinkan permintaan langsung dari browser (CORS) — isi URL proxy/backend Anda di "Pengaturan API".`,
      'cors',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TripayError(
      `Respon Tripay tidak valid (HTTP ${response.status}). Pastikan URL & API Key benar.`,
      'api',
    );
  }

  const body = payload as { success?: boolean; message?: string; data?: T };
  if (!response.ok || body.success === false) {
    throw new TripayError(body.message || `Permintaan gagal (HTTP ${response.status}).`, 'api');
  }

  return (body.data ?? (payload as T)) as T;
}

/* -------------------------------- API calls ------------------------------ */

/** Bentuk request siap kirim (url + header + body) beserta signature-nya. */
export interface PreparedRequest {
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  signature: string;
}

/**
 * Siapkan body POST /transaction/create.
 * Signature close-payment = HMAC-SHA256(privateKey, merchant_ref + amount).
 */
export async function prepareCreateTransaction(
  input: CreateTransactionInput,
  config: TripayConfig,
): Promise<PreparedRequest> {
  const signature = await hmacSha256Hex(input.merchantRef + input.amount, config.privateKey.trim());
  return {
    path: '/transaction/create',
    method: 'POST',
    signature,
    body: JSON.stringify({
      method: input.method,
      merchant_ref: input.merchantRef,
      amount: input.amount,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone || undefined,
      order_items: input.orderItems,
      callback_url: input.callbackUrl || undefined,
      return_url: input.returnUrl || undefined,
      expired_time: input.expiredTime || undefined,
      signature,
    }),
  };
}

/**
 * Siapkan GET /transaction/status.
 * Signature status = HMAC-SHA256(privateKey, merchant_ref).
 */
export async function prepareStatusRequest(
  merchantRef: string,
  config: TripayConfig,
): Promise<PreparedRequest> {
  const signature = await hmacSha256Hex(merchantRef, config.privateKey.trim());
  return {
    path: `/transaction/status?merchant_ref=${encodeURIComponent(merchantRef)}&signature=${signature}`,
    method: 'GET',
    signature,
  };
}

/** Kirim request yang sudah disiapkan (dipakai ulang oleh helper di bawah). */
export async function sendPrepared<T>(config: TripayConfig, prepared: PreparedRequest): Promise<T> {
  return request<T>(config, prepared.path, { method: prepared.method, body: prepared.body });
}

/** POST /transaction/create — membuat invoice pembayaran. */
export async function createTransaction(
  input: CreateTransactionInput,
  config: TripayConfig,
): Promise<TripayTransaction> {
  const prepared = await prepareCreateTransaction(input, config);
  return sendPrepared<TripayTransaction>(config, prepared);
}

/* ------------------------ transaksi deposit via worker ------------------------ */

/** Data yang dibutuhkan worker POST /create. */
export interface WorkerCreateInput {
  /** Nominal deposit dalam Rupiah (angka, bukan string). */
  amount: number;
  /** Kode channel yang dipilih user, mis. QRIS, BCAVA, MANDIRIVA, BRIVA. */
  method: string;
  /** Nomor invoice unik, mis. BY-1712345678901. */
  merchantRef: string;
  customerName: string;
  customerEmail: string;
}

/** Nomor invoice deposit: 'BY-' + timestamp. */
export function makeDepositRef(userId?: number | string): string {
  const uid = userId ? String(userId) : '0';
  return `BY-${uid}-${Date.now()}`;
}

/**
 * Body JSON untuk worker POST /create — persis 5 field:
 * amount, method, merchant_ref, customer_name, customer_email.
 */
export function buildWorkerCreateBody(input: WorkerCreateInput) {
  return {
    amount: Math.round(Number(input.amount)), // pastikan angka
    method: input.method.toUpperCase(),
    merchant_ref: input.merchantRef,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
  };
}

/**
 * Lengkapi respon worker dengan nilai default, supaya tampilan invoice
 * tidak rusak (NaN / undefined) bila ada field Tripay yang tidak dikirim.
 */
function normalizeTransaction(
  raw: Partial<TripayTransaction>,
  fallback?: { amount: number; merchantRef: string; method: string; customerName: string; customerEmail: string },
): TripayTransaction {
  /* amount Tripay = total tagihan (sudah termasuk biaya customer) */
  const totalDue = Number(raw.amount ?? fallback?.amount ?? 0) || 0;
  const feeMerchant = Number(raw.fee_merchant ?? 0) || 0;
  const feeCustomer = Number(raw.fee_customer ?? 0) || 0;

  /* Nominal deposit murni:
     prioritas nilai yang user input, fallback amount - fee_customer. */
  const fromResponse = Math.max(0, totalDue - feeCustomer);
  const depositAmount = fallback ? Number(fallback.amount) || fromResponse : fromResponse;

  return {
    deposit_amount: depositAmount,
    total_due: totalDue,
    saldo_masuk: depositAmount,
    reference: raw.reference ?? fallback?.merchantRef ?? '',
    merchant_ref: raw.merchant_ref ?? fallback?.merchantRef ?? '',
    payment_method: raw.payment_method ?? fallback?.method ?? '',
    payment_name: raw.payment_name ?? fallback?.method ?? '',
    customer_name: raw.customer_name ?? fallback?.customerName ?? '',
    customer_email: raw.customer_email ?? fallback?.customerEmail ?? '',
    customer_phone: raw.customer_phone ?? null,
    amount: totalDue,
    fee_merchant: feeMerchant,
    fee_customer: feeCustomer,
    total_fee: Number(raw.total_fee ?? feeMerchant + feeCustomer) || 0,
    amount_received: Number(raw.amount_received ?? totalDue - feeMerchant) || 0,
    pay_code: raw.pay_code ?? null,
    pay_url: raw.pay_url ?? null,
    checkout_url: raw.checkout_url ?? '',
    status: raw.status ?? 'UNPAID',
    // Default 24 jam bila worker tidak mengirim expired_time
    expired_time: Number(raw.expired_time) || Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    order_items: raw.order_items ?? [],
    instructions: raw.instructions ?? [],
    qr_string: raw.qr_string ?? null,
    qr_url: raw.qr_url ?? null,
    created_time: raw.created_time,
  };
}

/**
 * POST https://boosteryuk.boosteryukid.workers.dev/create
 * Membuat invoice Tripay lewat worker. Respon worker boleh berupa
 * format Tripay `{ success, message, data }` atau objek transaksi langsung.
 */
export async function createTransactionViaWorker(
  input: WorkerCreateInput,
): Promise<TripayTransaction> {
  let response: Response;
  try {
    response = await fetch(TRIPAY_CREATE_PROXY, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWorkerCreateBody(input)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TripayError(`Tidak dapat menghubungi worker /create (${message}).`, 'network');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TripayError(`Respon worker tidak valid (HTTP ${response.status}).`, 'api');
  }

  const body = payload as { success?: boolean; message?: string; error?: string; data?: TripayTransaction };
  if (!response.ok || body.success === false) {
    throw new TripayError(
      body.message || body.error || `Gagal membuat transaksi (HTTP ${response.status}).`,
      'api',
    );
  }

  const raw = (body.data ?? payload) as Partial<TripayTransaction> | null;
  if (!raw || typeof raw !== 'object') {
    throw new TripayError('Worker tidak mengembalikan data transaksi.', 'api');
  }
  // Minimal harus ada salah satu cara bayar: reference, link checkout, QR, atau kode bayar.
  if (!raw.reference && !raw.checkout_url && !raw.qr_string && !raw.qr_url && !raw.pay_code) {
    throw new TripayError('Respon worker tidak berisi data pembayaran (reference/checkout_url kosong).', 'api');
  }
  return normalizeTransaction(raw, input);
}

/** Perintah cURL untuk request worker yang sama persis (bantuan debugging). */
export function workerCreateCurl(input: WorkerCreateInput): string {
  const body = JSON.stringify(buildWorkerCreateBody(input)).replace(/'/g, "'\\''");
  return [
    `curl -X POST '${TRIPAY_CREATE_PROXY}'`,
    `  -H 'Accept: application/json'`,
    `  -H 'Content-Type: application/json'`,
    `  -d '${body}'`,
  ].join(' \\\n');
}

/**
 * GET /transaction/status — cek status invoice (dipakai untuk polling).
 * Respon dinormalisasi agar field turunan (deposit_amount, total_due,
 * saldo_masuk) tetap terisi saat status diperbarui.
 */
export async function getTransactionStatus(
  merchantRef: string,
  config: TripayConfig,
): Promise<TripayTransaction> {
  const prepared = await prepareStatusRequest(merchantRef, config);
  const raw = await request<Partial<TripayTransaction>>(config, prepared.path, { method: prepared.method });
  return normalizeTransaction(raw, {
    amount: Math.max(0, Number(raw.amount ?? 0) - Number(raw.fee_customer ?? 0)),
    merchantRef,
    method: raw.payment_method ?? '',
    customerName: raw.customer_name ?? '',
    customerEmail: raw.customer_email ?? '',
  });
}

/**
 * Ubah request menjadi perintah cURL.
 * Berguna saat browser memblokir panggilan langsung (CORS) — perintah ini
 * bisa dijalankan dari terminal atau disalin ke backend.
 */
export function toCurl(prepared: PreparedRequest, config: TripayConfig): string {
  const lines = [
    `curl -X ${prepared.method} '${resolveUrl(config, prepared.path)}'`,
    `  -H 'Authorization: Bearer ${config.apiKey.trim()}'`,
    `  -H 'Accept: application/json'`,
  ];
  if (prepared.body) {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -d '${prepared.body.replace(/'/g, "'\\''")}'`);
  }
  return lines.join(' \\\n');
}

/* ----------------------- channel pembayaran merchant ----------------------- */

/** Struktur biaya channel (rupiah flat + persen). */
export interface ChannelFee {
  flat: number;
  percent: number;
}

/** Satu channel pembayaran dari GET /merchant/payment-channel. */
export interface PaymentChannel {
  group: string;
  code: string;
  name: string;
  type: string;
  fee_merchant: ChannelFee;
  fee_customer: ChannelFee;
  total_fee: ChannelFee;
  minimum_fee?: number;
  maximum_fee?: number;
  minimum_amount?: number;
  maximum_amount?: number;
  icon_url?: string | null;
  active: boolean;
}

/**
 * GET /merchant/payment-channel
 * Mengembalikan semua channel pembayaran milik merchant beserta
 * biaya, nominal minimum/maksimum, dan status aktifnya.
 *
 * Khusus endpoint daftar channel dipaksa lewat Worker proxy
 * (https://boosteryuk.boosteryukid.workers.dev/api/tripay/channels)
 * karena API Tripay tidak mengizinkan request CORS dari browser.
 * Worker ini diharapkan mengembalikan JSON mentah dari Tripay,
 * bisa berupa array langsung atau object { success, data }.
 */
export async function getPaymentChannels(): Promise<PaymentChannel[]> {
  let response: Response;
  try {
    response = await fetch(TRIPAY_CHANNELS_PROXY, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TripayError(
      `Gagal mengambil daftar channel dari worker (${message}).`,
      'network',
    );
  }

  if (!response.ok) {
    throw new TripayError(
      `Worker proxy merespons HTTP ${response.status} saat mengambil channel.`,
      'api',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TripayError('Respon daftar channel dari worker bukan JSON valid.', 'api');
  }

  /* Worker bisa mengembalikan array langsung, atau { success, data }. */
  let list: unknown;
  if (Array.isArray(payload)) {
    list = payload;
  } else {
    const obj = payload as { success?: boolean; message?: string; data?: unknown; channels?: unknown };
    if (obj.success === false) {
      throw new TripayError(obj.message || 'Worker menolak permintaan daftar channel.', 'api');
    }
    list = obj.data ?? obj.channels ?? [];
  }

  if (!Array.isArray(list)) return [];
  const channels = list as PaymentChannel[];
  /* Bersihkan channel yang nonaktif (bila ikut terkirim) agar daftar konsisten. */
  return channels.filter((channel) => channel.active !== false);
}

/**
 * Total biaya channel untuk sebuah nominal:
 * flat + (amount × percent / 100), dibatasi minimum_fee & maximum_fee.
 */
export function channelFeeTotal(channel: PaymentChannel, amount: number): number {
  const raw = (channel.total_fee?.flat ?? 0) + (amount * (channel.total_fee?.percent ?? 0)) / 100;
  const min = channel.minimum_fee;
  const max = channel.maximum_fee;
  let fee = raw;
  if (typeof min === 'number' && fee < min) fee = min;
  if (typeof max === 'number' && fee > max) fee = max;
  return Math.round(fee);
}

/** Nomor invoice unik, mis. INV345675 / INV-1712345678901. */
export function makeMerchantRef(prefix = 'INV'): string {
  return `${prefix}${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 90 + 10)}`;
}

/** URL QR fallback bila Tripay tidak mengirim qr_url. */
export function qrImageUrl(content: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(content)}`;
}
