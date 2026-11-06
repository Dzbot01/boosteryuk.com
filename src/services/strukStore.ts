export interface Struk {
  orderId: string;
  layanan: string;
  target: string;
  jumlah: string;
  tanggal: string;
  ok: boolean;
  /** 6-char alphanumeric code, embedded in the success URL so the struk can be rebuilt later. */
  code?: string;
}

const DATA_PREFIX = 'boosteryuk-struk-data-';
const CODE_PREFIX = 'boosteryuk-struk-code-';
const CODE_LEN = 6;

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // without i, l, o, 0, 1 — no ambiguity

function randomCode(len: number = CODE_LEN): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

/** Persist a struk and (re)generate a code for its orderId, returning the code. */
export function saveStruk(struk: Struk): string {
  writeJson(`${DATA_PREFIX}${struk.orderId}`, struk);

  // Re-use an existing code if present — otherwise generate a fresh one.
  const existing = sessionStorage.getItem(`${CODE_PREFIX}${struk.orderId}`);
  const code = existing && isValidCode(existing) ? existing : randomCode();
  sessionStorage.setItem(`${CODE_PREFIX}${struk.orderId}`, code);
  return code;
}

/** Load a previously saved struk for an orderId. */
export function loadStruk(orderId: string): Struk | null {
  return readJson<Struk>(`${DATA_PREFIX}${orderId}`);
}

/** Look up the code associated with an orderId. Returns null when none exists. */
export function loadCode(orderId: string): string | null {
  const code = sessionStorage.getItem(`${CODE_PREFIX}${orderId}`);
  return code && isValidCode(code) ? code : null;
}

/** Validate that a candidate code matches the stored code for an orderId. */
export function verifyCode(orderId: string, candidate: string): boolean {
  const stored = loadCode(orderId);
  if (!stored) return false;
  return candidate.toLowerCase() === stored.toLowerCase();
}

function isValidCode(s: string): boolean {
  return s.length === CODE_LEN && new RegExp(`^[${CODE_CHARS}]+$`).test(s);
}

export { CODE_LEN };
