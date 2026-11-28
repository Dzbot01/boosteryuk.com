import { TOPUP_MARKUP_PCT } from '../data/topupGames';
import type { Tenant } from './tenant';

/**
 * Harga satu akses markup child panel (Top Up Game / PPOB) — dibeli terpisah
 * (buka akses satu per satu) oleh pemilik child panel lewat Panel Admin.
 */
export const HARGA_AKSES_MARKUP = 35000;

/** Markup top up game (%): child panel ber-akses memakai setelannya; selain itu markup sistem. */
export function markupTopupPct(tenant: Tenant | null): number {
  if (tenant && tenant.access_topup_markup && typeof tenant.markup_topup_pct === 'number') return tenant.markup_topup_pct;
  return TOPUP_MARKUP_PCT;
}

/** Markup PPOB (%): hanya child panel yang sudah membeli akses PPOB; selain itu 0. */
export function markupPpobPct(tenant: Tenant | null): number {
  if (tenant && tenant.access_ppob_markup && typeof tenant.markup_ppob_pct === 'number') return tenant.markup_ppob_pct;
  return 0;
}

/** Modal + markup persen (eksak). */
export const hargaMarkup = (modal: number, pct: number) => modal * (1 + pct / 100);
