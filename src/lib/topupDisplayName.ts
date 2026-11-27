/**
 * Nama produk top up yang manusiawi + penyaring kode resmi.
 *
 * Latar: endpoint penyedia `GET /produk/code` mengirim SEMUA kanal wholesale
 * (MFF, PFF, ZFF, KPPFF, IDFF, VFFGLOBAL, FFPH, FFMY, GMXFF, …) tanpa nama,
 * padahal web resmi penyedia (https://tokovoucher.me/pricelist, diverifikasi
 * 27 Nov 2026) hanya menjual satu keluarga kode per game — untuk Free Fire
 * seluruh 122 produk berprefiks `MFF` (daftar kode dikonfirmasi pemilik).
 * Maka:
 *  - hanya kode kanal RESMI per game yang ditampilkan (FF: `MFF…`);
 *  - nama disusun mengikuti konvensi pricelist resmi penyedia:
 *      MFF5 -> "5 Diamond", MFFM -> "Membership Mingguan",
 *      MFFB -> "Membership Bulanan", MFFLUP -> "Level Up Pass",
 *      MFFBP -> "Booyah Pass";
 *  - produk pass/membership (token non-angka) dipisah jadi kelompok `paket`,
 *    denominasi angka jadi kelompok `eceran`;
 *  - kode di luar pola resmi TIDAK ditampilkan sama sekali (bukan ditebak).
 */

export type TopupItemBernama = {
  kode: string;
  nama: string;
  harga: number;
  butuhServer?: boolean;
};

export type KatalogRapih = {
  /** Denominasi eceran (mis. "85 Diamond"). */
  eceran: TopupItemBernama[];
  /** Pass & membership (mis. "Booyah Pass", "Membership Mingguan"). */
  paket: TopupItemBernama[];
};

/** Satuan denominasi angka per slug game (mengikuti tagline resmi masing-masing game). */
const UNIT_PER_SLUG: Record<string, string> = {
  'free-fire': 'Diamond',
  'mobile-legends': 'Diamond',
  'hago': 'Diamond',
  'magic-chess-go-go': 'Diamond',
  'farlight-84': 'Diamond',
  'metal-slug-awakening': 'Diamond',
  'pubg-mobile': 'UC',
  'call-of-duty-mobile': 'CP',
  'genshin-impact': 'Genesis Crystal',
  'honkai-star-rail': 'Oneiric Shard',
  'zenless-zone-zero': 'Monochrome',
  'point-blank': 'Cash',
  'honor-of-kings': 'Token',
  'garena-undawn': 'Coin',
  'blood-strike': 'Gold',
  'moonlight-blade-m': 'Voucher',
};

type Aturan = {
  /** Akar kode produk game ini (setelah kode kanal). */
  root: string;
  /** Kode kanal resmi yang menempel DI DEPAN akar (FF: hanya M per web penyedia). */
  kanalDepan?: string[];
  /** Kode kanal resmi yang menempel SETELAH akar (ML: BB/A/B/C/D kanal denominasi). */
  kanalBelakang?: string[];
};

/**
 * Kanal RESMI per game. Free Fire dikunci ke `M` sesuai daftar 122 kode di web
 * penyedia (MFF5…MFF7290 + MFFM/MFFB/MFFLUP/MFFBP). Mobile Legends menunggu
 * daftar resmi yang sama; sementara kanal denominasi polos (BB/A/B/C/D) dipakai
 * dan digabung ke harga termurah, kanal aneh (RU, GMX, LMLM, …) dibuang.
 */
const ATURAN_PER_SLUG: Record<string, Aturan> = {
  'free-fire': { root: 'FF', kanalDepan: ['M'] },
  'mobile-legends': { root: 'ML', kanalDepan: [''], kanalBelakang: ['BB', 'A', 'B', 'C', 'D', ''] },
};

/** Token non-angka sesuai penamaan resmi pricelist penyedia (semua = kelompok paket). */
const TOKEN_KHUSUS: Record<string, string> = {
  M: 'Membership Mingguan',
  B: 'Membership Bulanan',
  LUP: 'Level Up Pass',
  BP: 'Booyah Pass',
  WDP: 'Weekly Diamond Pass',
  TP: 'Twilight Pass',
};

/** Huruf & angka dipisah spasi: "GMXFF1" -> "GMXFF 1". Tanpa mengarang kata. */
export function humanisasiKode(kode: string): string {
  const h = kode.replace(/([A-Z]+)(\d+)/g, '$1 $2').trim();
  return h || kode;
}

/**
 * Urai kode resmi satu game jadi {nama, jenis}. Mengembalikan null bila kode
 * bukan kode resmi/pola dikenal — artinya TIDAK boleh ditampilkan.
 */
function parseKodeResmi(slug: string, k: string): { nama: string; jenis: 'eceran' | 'paket' } | null {
  const a = ATURAN_PER_SLUG[slug];
  if (!a) return null;
  for (const kd of a.kanalDepan ?? ['']) {
    if (kd && !k.startsWith(kd)) continue;
    const sisaDepan = k.slice(kd.length);
    if (!sisaDepan.startsWith(a.root)) continue;
    let rest = sisaDepan.slice(a.root.length);
    for (const kb of a.kanalBelakang ?? ['']) {
      if (rest.startsWith(kb)) {
        rest = rest.slice(kb.length);
        break;
      }
    }
    const m = /^([A-Z]*)(\d+)$/.exec(rest);
    if (m) {
      if (!m[1]) return { nama: `${Number(m[2])} ${UNIT_PER_SLUG[slug] || 'Diamond'}`, jenis: 'eceran' };
      const kh = TOKEN_KHUSUS[m[1]];
      if (kh) return { nama: `${kh} ${m[2]}`, jenis: 'paket' };
      return null;
    }
    const kh = TOKEN_KHUSUS[rest];
    if (kh) return { nama: kh, jenis: 'paket' };
    return null;
  }
  return null;
}

/** Nama tampil satu produk (pakai nama asli penyedia bila dikirim; sonst pola resmi). */
export function namaTampilanTopup(slug: string, kode: string, namaPenyedia?: string): string {
  const k = (kode || '').toUpperCase().trim();
  const n = (namaPenyedia || '').trim();
  if (n && n.toUpperCase() !== k) return n;
  const p = parseKodeResmi(slug, k);
  return p ? p.nama : humanisasiKode(k);
}

/**
 * Rapikan katalog untuk UI:
 *  - buang produk tes penyedia (kode "CEK…");
 *  - game ber-aturan: hanya kode RESMI yang lolos; kode aneh dibuang;
 *  - pisah kelompok `paket` (pass/membership) dan `eceran` (denominasi);
 *  - produk kembar lintas kanal resmi digabung ke harga termurah;
 *  - masing-masing kelompok urut menaik menurut harga.
 * Game tanpa aturan (belum ada daftar resmi) tampil apa adanya sebagai eceran.
 */
export function rapihkanKatalog(slug: string, items: TopupItemBernama[]): KatalogRapih {
  const eceran = new Map<string, TopupItemBernama>();
  const paket = new Map<string, TopupItemBernama>();
  const berAturan = !!ATURAN_PER_SLUG[slug];
  for (const it of items) {
    const k = (it.kode || '').toUpperCase().trim();
    if (!k || /^CEK/.test(k)) continue;
    const n = (it.nama || '').trim();
    let nama: string;
    let jenis: 'eceran' | 'paket';
    if (berAturan) {
      const p = parseKodeResmi(slug, k);
      if (!p) continue;
      jenis = p.jenis;
      nama = n && n.toUpperCase() !== k ? n : p.nama;
    } else {
      jenis = 'eceran';
      nama = n && n.toUpperCase() !== k ? n : humanisasiKode(k);
    }
    const target = jenis === 'paket' ? paket : eceran;
    const ada = target.get(nama);
    if (!ada || it.harga < ada.harga) target.set(nama, { ...it, nama });
  }
  const urut = (m: Map<string, TopupItemBernama>) => [...m.values()].sort((a, b) => a.harga - b.harga);
  return { eceran: urut(eceran), paket: urut(paket) };
}
