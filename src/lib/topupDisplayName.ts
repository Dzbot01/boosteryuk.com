/**
 * Nama produk top up yang manusiawi.
 *
 * Endpoint penyedia `GET /produk/code` hanya mengirim kode + harga (tanpa nama),
 * sehingga field `nama` dari proxy jatuh balik ke kode ("FF5", "MLA85", …).
 * Modul ini menyusun nama tampil mengikuti konvensi pricelist RESMI penyedia
 * (https://tokovoucher.me/pricelist, diambil 27 Nov 2026):
 *   MFF5   -> "Free Fire 5 Diamonds"        => token angka  = "<n> Diamond"
 *   MFFM   -> "Free Fire Mingguan Membership" => token M    = "Membership Mingguan"
 *   MFFB   -> "Free Fire Bulanan Membership"  => token B    = "Membership Bulanan"
 *   MFFLUP -> "Free Fire Level Up Pass"       => token LUP  = "Level Up Pass"
 *   MFFBP  -> "BP Card"                       => token BP   = "BP Card"
 * Kode yang tidak cocok pola tetap ditampilkan dalam bentuk humanis
 * (huruf & angka dipisah) — tidak pernah mengarang nama produk.
 */

export type TopupItemBernama = {
  kode: string;
  nama: string;
  harga: number;
  butuhServer?: boolean;
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
  /** Kode kanal yang menempel DI DEPAN akar (mis. P/M/Z pada Free Fire). */
  kanalDepan?: string[];
  /** Kode kanal yang menempel SETELAH akar (mis. A/B/C/D/BB pada Mobile Legends). */
  kanalBelakang?: string[];
  /** Tag server/wilayah yang muncul setelah akar (mis. RU). */
  tag?: string[];
};

const ATURAN_PER_SLUG: Record<string, Aturan> = {
  'free-fire': { root: 'FF', kanalDepan: ['P', 'M', 'Z', ''] },
  'mobile-legends': { root: 'ML', kanalBelakang: ['BB', 'A', 'B', 'C', 'D', ''], tag: ['RU'] },
};

/** Token non-angka sesuai penamaan resmi pricelist penyedia. */
const TOKEN_KHUSUS: Record<string, string> = {
  M: 'Membership Mingguan',
  B: 'Membership Bulanan',
  LUP: 'Level Up Pass',
  BP: 'BP Card',
  WDP: 'Weekly Diamond Pass',
  TP: 'Twilight Pass',
};

/** Huruf & angka dipisah spasi: "GMXFF1" -> "GMXFF 1". Tanpa mengarang kata. */
export function humanisasiKode(kode: string): string {
  const h = kode.replace(/([A-Z]+)(\d+)/g, '$1 $2').trim();
  return h || kode;
}

function namaDariToken(token: string, unit: string): string | null {
  if (!token) return null;
  const m = /^([A-Z]*)(\d+)$/.exec(token);
  if (m) {
    const huruf = m[1];
    const angka = m[2];
    if (!huruf) return `${Number(angka)} ${unit}`;
    const khusus = TOKEN_KHUSUS[huruf];
    if (khusus) return `${khusus} ${angka}`;
    return null;
  }
  return TOKEN_KHUSUS[token] || null;
}

/**
 * Nama tampil satu produk: pakai nama asli bila penyedia mengirimnya; selain itu
 * susun dari kode mengikuti konvensi pricelist resmi; terakhir fallback humanis.
 */
export function namaTampilanTopup(slug: string, kode: string, namaPenyedia?: string): string {
  const k = (kode || '').toUpperCase().trim();
  const n = (namaPenyedia || '').trim();
  if (n && n.toUpperCase() !== k) return n;
  const aturan = ATURAN_PER_SLUG[slug];
  if (aturan) {
    for (const kd of aturan.kanalDepan ?? ['']) {
      if (kd && !k.startsWith(kd)) continue;
      const sisaDepan = k.slice(kd.length);
      if (!sisaDepan.startsWith(aturan.root)) continue;
      let rest = sisaDepan.slice(aturan.root.length);
      let tag = '';
      for (const t of aturan.tag ?? []) {
        if (rest.startsWith(t)) {
          tag = t;
          rest = rest.slice(t.length);
          break;
        }
      }
      for (const kb of aturan.kanalBelakang ?? ['']) {
        if (rest.startsWith(kb)) {
          rest = rest.slice(kb.length);
          break;
        }
      }
      const nama = namaDariToken(rest, UNIT_PER_SLUG[slug] || 'Diamond');
      if (nama) return tag ? `${nama} (${tag})` : nama;
    }
  }
  return humanisasiKode(k);
}

/**
 * Rapikan katalog untuk UI: buang produk tes penyedia (kode "CEK…", harga receh),
 * ganti nama kode jadi nama manusiawi, gabungkan produk kembar lintas kanal
 * (FF70 vs PFF70 vs MFF70 = produk sama) dengan menyimpan harga termurah,
 * lalu urutkan menaik menurut harga supaya denominasi terbaca rapi.
 */
export function rapihkanKatalog(slug: string, items: TopupItemBernama[]): TopupItemBernama[] {
  const peta = new Map<string, TopupItemBernama>();
  for (const it of items) {
    if (/^CEK/.test((it.kode || '').toUpperCase())) continue;
    const nama = namaTampilanTopup(slug, it.kode, it.nama);
    const ada = peta.get(nama);
    if (!ada || it.harga < ada.harga) peta.set(nama, { ...it, nama });
  }
  return [...peta.values()].sort((a, b) => a.harga - b.harga);
}
