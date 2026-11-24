/**
 * servicesApi.ts
 *
 * Browser → PHP Proxy (services.php) → Fayupedia API
 * Credentials aman di server
 */

import { server2Label } from '../lib/server2Presentation';
import { invokeProxy } from '../supabase';
import type { ServiceCategory } from '../constants';
import { markupFactor } from '../lib/tenant';

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  type: string;
  rate: number | null;
  min: number | null;
  max: number | null;
  refill: boolean;
  cancel: boolean;
  description: string;
  /** Server asal layanan (1/2/3). Item Server 3 digabung ke UI Server 1 tanpa teks tambahan. */
  source?: 1 | 2 | 3;
}

export interface ServicesResult {
  ok: boolean;
  message: string;
  services: ServiceItem[];
  /** Server 3: daftar kategori yang ikut dikembalikan endpoint publik (subset GM Review). */
  categories?: string[];
}

/**
 * True when a service requires custom comments (one per line).
 */
export function isCustomCommentService(service: ServiceItem | null): boolean {
  if (!service) return false;
  const type = (service.type || '').toLowerCase();
  if (type === 'custom_comment' || type.includes('custom')) return true;
  const text = `${service.name} ${service.category}`.toLowerCase();
  return /custom\s*komentar|custom\s*comment/.test(text);
}

type RawService = Record<string, unknown>;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n)? n : null;
}

function str(value: unknown): string {
  return value === null || value === undefined? '' : String(value);
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = str(value).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function normalize(raw: RawService): ServiceItem {
  return {
    id: str(raw.service?? raw.id?? raw.service_id),
    name: str(raw.name?? raw.service_name?? raw.title),
    category: str(raw.category?? raw.kategori?? ''),
    type: str(raw.type?? 'Default'),
    rate: num(raw.rate?? raw.price?? raw.harga),
    min: num(raw.min?? raw.min_order),
    max: num(raw.max?? raw.max_order),
    refill: bool(raw.refill),
    cancel: bool(raw.cancel),
    description: str(raw.description?? raw.desc?? ''),
  };
}

/** Pull an array of services out of whatever shape the API returns. */
function extractList(data: unknown): RawService[] | null {
  if (Array.isArray(data)) return data as RawService[];

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Explicit failure envelope
    if (obj.status === false) return null;

    for (const key of ['services', 'data', 'result', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as RawService[];
    }

    // Some panels return a keyed map of services
    const values = Object.values(obj).filter(
      (v) => v && typeof v === 'object' &&!Array.isArray(v),
    );
    if (values.length > 0 && values.every((v) => 'name' in (v as object))) {
      return values as RawService[];
    }
  }

  return null;
}

/** Fetch every service from the catalogue. */
/** Fetch every service from the catalogue. */
export async function fetchServices(server: 1 | 2 | 3 = 1): Promise<ServicesResult> {
  const edge = await invokeProxy<unknown>({
    action: 'services',
    server,
    id: '',
  });

  if (edge.error ||!edge.data) {
    return {
      ok: false,
      message: edge.error || 'Gagal memuat layanan.',
      services: []
    };
  }

  const list = extractList(edge.data);
  if (!list) {
    const msg = (edge.data as { msg?: string; message?: string })?.msg || 'Daftar layanan tidak tersedia.';
    return { ok: false, message: msg, services: [] };
  }
  const categories = server === 3 && Array.isArray((edge.data as { categories?: unknown }).categories)
    ? ((edge.data as { categories: unknown[] }).categories).map((c) => String(c))
    : undefined;

  const all = list.map(normalize).map(s => server === 2 ? {...s, name: server2Label(s.name), category: server2Label(s.category)} : s);

  // FILTER KHUSUS TRIPAY
  const banned = ['😢', '🤬', '😥', '😭', '😡'];
  const keep = (s: ServiceItem) => {
    const text = `${s.category} ${s.name}`.toLowerCase();
    return !banned.some(k => text.includes(k));
  };
  const safe = all.filter(keep);

  // Server 3 diberi namespace ID (M3:) agar tidak bertabrakan dengan ID Server 1/2
  // saat daftar digabung dalam satu UI; prefix dilepas kembali hanya saat order.
  const tagged = safe.map(s => server === 3 ? { ...s, id: `M3:${s.id}`, source: 3 as const } : { ...s, source: server as 1 | 2 });

  if (server !== 1) return { ok: true, message: 'Layanan dimuat.', services: tagged, categories };

  // SERVER 1 = SATU UI: layanan Server 3 (Google Maps Review) ikut dimuat & digabung
  // ke daftar yang sama, tampilan default tanpa teks/tanda tambahan.
  const gm = await invokeProxy<unknown>({ action: 'services', server: 3, id: '' }).catch(() => null);
  const gmList = gm && !gm.error && gm.data ? extractList(gm.data) : null;
  const gmServices = gmList
    ? gmList.map(normalize).filter(keep).map(s => ({ ...s, id: `M3:${s.id}`, source: 3 as const }))
    : [];

  return { ok: true, message: 'Layanan dimuat.', services: [...tagged, ...gmServices], categories };
}

/** Keep only the services that belong to the given platform. */
export function filterByCategory(
  services: ServiceItem[],
  category: ServiceCategory,
): ServiceItem[] {
  const keys = category.keywords.map((k) => k.toLowerCase());

  return services.filter((s) => {
    const haystack = `${s.category} ${s.name}`.toLowerCase();
    return keys.some((k) => haystack.includes(k));
  });
}

/** Group services by their API category so the detail page can show sections. */
export function groupByCategory(services: ServiceItem[]): Map<string, ServiceItem[]> {
  const map = new Map<string, ServiceItem[]>();
  for (const s of services) {
    const key = s.category || 'Lainnya';
    const bucket = map.get(key);
    if (bucket) bucket.push(s);
    else map.set(key, [s]);
  }
  return map;
}

/** Markup applied on top of the API rate, per 1.000 units (default). */
export const RATE_MARKUP_PER_1000 = 4425;
/** Reduced markup for Boosteryuk Plus members, per 1.000 units. */
export const RATE_MARKUP_PLUS_PER_1000 = 1000;

export function applyMarkup(rate: number | null, isPlus = false): number | null {
  if (rate === null) return null;
  const base = rate + (isPlus? RATE_MARKUP_PLUS_PER_1000 : RATE_MARKUP_PER_1000);
  // Child panel: + markup % milik panel (1 di web utama).
  const factor = markupFactor('smm');
  return factor === 1 ? base : Math.ceil(base * factor);
}

export function formatRate(rate: number | null, isPlus = false): string {
  const marked = applyMarkup(rate, isPlus);
  if (marked === null) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(marked);
}

export function formatQty(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('id-ID').format(value);
}