/**
 * i18n sederhana untuk Boosteryuk (Indonesia ⇄ English).
 *
 * Cara kerja:
 * - LanguageProvider menyimpan bahasa aktif di localStorage ('bt-lang') dan <html lang>.
 * - Saat bahasa = 'en', DomTranslator menelusuri semua teks yang tampil di halaman
 *   (text node + atribut placeholder/aria-label/title/alt) dan menukarnya memakai kamus EN.
 *   MutationObserver ikut menerjemahkan konten yang muncul belakangan (pindah halaman,
 *   modal dibuka, data selesai dimuat). Teks asli disimpan agar bisa dikembalikan saat
 *   bahasa diganti lagi ke Indonesia.
 * - Komponen baru bisa memakai useT() untuk menerjemahkan string secara langsung.
 * - Elemen dengan atribut data-no-translate (dan isinya) tidak pernah diterjemahkan,
 *   mis. isian/teks milik user.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN } from './en';

export type Lang = 'id' | 'en';

const STORAGE_KEY = 'bt-lang';
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT']);

/** Pola untuk teks dinamis (berisi angka/nama) yang tidak bisa dicocokkan persis. */
const PATTERNS: Array<[RegExp, (...m: string[]) => string]> = [
  [/^(\d+) paket tersedia untuk plan (.+?)( · harga estimasi)?$/, (_, n, f, est) => `${n} packages available for the ${f} plan${est ? ' · estimated price' : ''}`],
  [/^(\d+) region tersedia di HostVDS$/, (_, n) => `${n} regions available on HostVDS`],
  [/^Live dari HostVDS · diperbarui (.+)$/, (_, t) => `Live from HostVDS · updated ${t}`],
  [/^(\d+) hari lalu$/, (_, n) => `${n} days ago`],
  [/^Rating (\d+) dari 5 bintang$/, (_, n) => `Rated ${n} out of 5 stars`],
  [/^(\d+) layanan tersedia$/, (_, n) => `${n} services available`],
  [/^(\d+) menit lalu$/, (_, n) => `${n} minutes ago`],
  [/^(\d+) jam lalu$/, (_, n) => `${n} hours ago`],
];

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Terjemahkan satu string Indonesia ke Inggris; kembalikan null bila tidak dikenal. */
export function translateText(text: string): string | null {
  const key = normalize(text);
  if (!key) return null;
  const hit = EN[key];
  if (hit) return hit;
  for (const [re, fn] of PATTERNS) {
    const m = key.match(re);
    if (m) return fn(...m);
  }
  return null;
}

interface LangCtx {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LangCtx>({ lang: 'id', setLang: () => {} });

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id';
  } catch {
    return 'id';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage tidak tersedia (mode privat) — bahasa tetap berlaku untuk sesi ini */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
      <DomTranslator lang={lang} />
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);

/** t('Teks Indonesia') → teks Inggris saat bahasa = en, teks asli saat id. */
export function useT() {
  const { lang } = useLang();
  return useCallback((text: string) => (lang === 'en' ? translateText(text) ?? text : text), [lang]);
}

/* ------------------------------------------------------------------------------------ */
/* Penerjemah DOM                                                                        */
/* ------------------------------------------------------------------------------------ */

// Simpan teks asli + terjemahan terakhir agar bisa dikembalikan dan agar perubahan oleh
// React (teks baru) bisa dibedakan dari perubahan yang kita buat sendiri.
const textOriginals = new WeakMap<Text, { original: string; translated: string }>();
const attrOriginals = new WeakMap<Element, Map<string, { original: string; translated: string }>>();
// Set biasa (bukan WeakRef) karena target tsconfig ES2020; dikosongkan setiap restoreAll().
const touchedTexts = new Set<Text>();
const touchedElements = new Set<Element>();

function isSkipped(node: Node | null): boolean {
  for (let el = node instanceof Element ? node : node?.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-translate') || (el instanceof HTMLElement && el.isContentEditable)) return true;
  }
  return false;
}

function translateTextNode(node: Text) {
  const current = node.nodeValue ?? '';
  const record = textOriginals.get(node);
  // React mengganti isi node → anggap sebagai teks asli yang baru.
  const original = record && record.translated === current ? record.original : current;
  const translated = translateText(original);
  if (!translated) return;
  // Pertahankan spasi di awal/akhir node agar tata letak inline tidak berubah.
  const lead = original.match(/^\s*/)?.[0] ?? '';
  const trail = original.match(/\s*$/)?.[0] ?? '';
  const next = lead + translated + trail;
  if (current !== next) node.nodeValue = next;
  if (!record) touchedTexts.add(node);
  textOriginals.set(node, { original, translated: next });
}

function translateAttributes(el: Element) {
  for (const attr of ATTRS) {
    const current = el.getAttribute(attr);
    if (!current) continue;
    let map = attrOriginals.get(el);
    const record = map?.get(attr);
    const original = record && record.translated === current ? record.original : current;
    const translated = translateText(original);
    if (!translated) continue;
    if (current !== translated) el.setAttribute(attr, translated);
    if (!map) {
      map = new Map();
      attrOriginals.set(el, map);
      touchedElements.add(el);
    }
    map.set(attr, { original, translated });
  }
}

function translateTree(root: Node) {
  if (isSkipped(root)) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (!(root instanceof Element || root instanceof DocumentFragment || root instanceof Document)) return;
  if (root instanceof Element) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) =>
      n instanceof Element && (SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-no-translate'))
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n as Text);
    else translateAttributes(n as Element);
  }
}

/** Kembalikan semua teks yang pernah diterjemahkan ke bahasa Indonesia aslinya. */
function restoreAll() {
  for (const node of touchedTexts) {
    const record = textOriginals.get(node);
    if (record && node.nodeValue === record.translated) node.nodeValue = record.original;
    textOriginals.delete(node);
  }
  touchedTexts.clear();
  for (const el of touchedElements) {
    const map = attrOriginals.get(el);
    if (map) {
      for (const [attr, record] of map) if (el.getAttribute(attr) === record.translated) el.setAttribute(attr, record.original);
      attrOriginals.delete(el);
    }
  }
  touchedElements.clear();
}

function DomTranslator({ lang }: { lang: Lang }) {
  useEffect(() => {
    if (lang !== 'en') {
      restoreAll();
      return;
    }
    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') translateTree(m.target);
        else if (m.type === 'attributes' && m.target instanceof Element) {
          if (!isSkipped(m.target)) translateAttributes(m.target);
        } else m.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
    return () => observer.disconnect();
  }, [lang]);
  return null;
}
