/**
 * Penulis-ulang brand untuk child panel.
 *
 * Di subdomain child panel, semua teks "Boosteryuk" (termasuk variasi "BoosterYuk", "Booster Yuk",
 * "BOOSTERYUK") yang TAMPIL di halaman diganti dengan judul header panel (brandName + brandSuffix),
 * dan "boosteryuk.com" diganti dengan alamat panel. Bekerja di level DOM (text node + atribut
 * alt/title/aria-label/placeholder) dengan MutationObserver, sehingga juga mencakup teks yang muncul
 * belakangan (pindah halaman, modal, data API) tanpa mengubah ratusan string di kode.
 *
 * Tidak disentuh: email & URL (mis. support@boosteryuk.com, https://boosteryuk.com/...), isi input/
 * textarea, elemen ber-atribut data-no-brand. Di web utama komponen ini tidak melakukan apa-apa.
 */
import { useEffect } from 'react';
import { IS_CHILD_PANEL } from './apiBase';
import { useSiteSettings } from '../context/SiteSettingsContext';

const ATTRS = ['alt', 'title', 'aria-label', 'placeholder'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);
// Tidak didahului @ . / huruf (email/URL/kata lain) dan tidak diikuti huruf/@.
const BRAND_RE = /(?<![@\w./-])booster[ -]?yuk(\.com)?(?![\w@-])/gi;

let active: { brand: string; host: string } | null = null;

/** Ganti "Boosteryuk" → brand panel pada satu string (dipakai juga oleh penerjemah EN). */
export function applyBrand(text: string): string {
  if (!active || !text) return text;
  const { brand, host } = active;
  return text.replace(BRAND_RE, (m, dotCom: string | undefined) => {
    if (dotCom) return host;
    return m === m.toUpperCase() ? brand.toUpperCase() : brand;
  });
}

/** Kebalikan applyBrand: agar kamus terjemahan (berbasis teks asli "Boosteryuk") tetap cocok. */
export function unbrand(text: string): string {
  if (!active || !text) return text;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(esc(active.host), 'g'), 'boosteryuk.com')
    .replace(new RegExp(`(?<![\\w@])${esc(active.brand)}(?!\\w)`, 'gi'), 'Boosteryuk');
}

function skipped(node: Node | null): boolean {
  for (let el = node instanceof Element ? node : node?.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-brand') || (el instanceof HTMLElement && el.isContentEditable)) return true;
  }
  return false;
}

function rewriteText(node: Text) {
  const v = node.nodeValue;
  if (!v || !/booster/i.test(v)) return;
  const next = applyBrand(v);
  if (next !== v) node.nodeValue = next;
}

function rewriteAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && /booster/i.test(v)) {
      const next = applyBrand(v);
      if (next !== v) el.setAttribute(a, next);
    }
  }
}

function rewriteTree(root: Node) {
  if (skipped(root)) return;
  if (root.nodeType === Node.TEXT_NODE) return rewriteText(root as Text);
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  if (root instanceof Element) rewriteAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n instanceof Element && (SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-no-brand')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) rewriteText(n as Text);
    else rewriteAttrs(n as Element);
  }
}

/** Pasang sekali di dalam SiteSettingsProvider. */
export function BrandRewriter() {
  const { tenant, settings } = useSiteSettings();
  const brand = `${settings.brandName}${settings.brandSuffix}`.trim();

  useEffect(() => {
    if (!IS_CHILD_PANEL || !tenant || !brand || /^booster ?yuk$/i.test(brand)) {
      active = null;
      return;
    }
    active = { brand, host: window.location.hostname };
    rewriteTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') rewriteTree(m.target);
        else if (m.type === 'attributes' && m.target instanceof Element) {
          if (!skipped(m.target)) rewriteAttrs(m.target);
        } else m.addedNodes.forEach(rewriteTree);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      observer.disconnect();
      active = null;
    };
  }, [tenant, brand]);

  return null;
}
