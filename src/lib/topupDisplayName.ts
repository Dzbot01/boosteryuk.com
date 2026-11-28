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
  ES: 'Express Supply',
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
/** Nama lengkap wilayah/server untuk label chip: singkatan diperjelas. */
const NAMA_WILAYAH: Record<string, string> = {
  ID: 'Indonesia', SG: 'Singapura', MY: 'Malaysia', BR: 'Brasil', TH: 'Thailand',
  BD: 'Bangladesh', PH: 'Filipina', VN: 'Vietnam', TR: 'Turki', RU: 'Rusia', // ejaan Indonesia
  KR: 'Korea', TW: 'Taiwan', LATAM: 'Amerika Latin', GLOBAL: 'Global',
};

/**
 * Label chip wilayah yang terbaca penuh: "Free Fire PH" → "Free Fire Filipina",
 * "Free Fire  ID Fast" → "Free Fire Indonesia Fast" (spasi ganda dirapikan).
 * Hanya untuk tampilan — identitas chip tetap string `jenis` asli penyedia.
 */
export function namaWilayahJenis(label: string): string {
  const bersih = (label || '').replace(/\s+/g, ' ').trim();
  return bersih.replace(/\b(GLOBAL|LATAM|ID|SG|MY|BR|TH|BD|PH|VN|TR|RU|KR|TW)\b/gi, (t) => NAMA_WILAYAH[t.toUpperCase()] || t);
}

/** Token wilayah/server yang pernah muncul di kode produk penyedia. */
const TOKEN_WILAYAH = ['SG', 'MY', 'BR', 'PH', 'TH', 'VN', 'TR', 'RU', 'KR', 'TW', 'BD', 'GLOBAL', 'LATAM'];
/** "Free Fire  ID Fast" -> "FREEFIREIDFAST"; chip tanpa kata wilayah -> ''. */
function wilayahChip(label: string): string {
  const t = (label || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return TOKEN_WILAYAH.find((w) => t.includes(w)) || '';
}
/** Token wilayah yang melekat di kode: "FFSG100"->SG, "VFFGLOBAL100"->GLOBAL, "MFF5"->''. */
function wilayahKode(kode: string): string {
  // Token wilayah harus diikuti angka/ujung/batas (_ atau huruf), jadi "FFM", "FFMD20",
  // "FFB…" tidak dianggap wilayah; "FF_SG_100" dan "FFBDS25" ya.
  const m = /(GLOBAL|LATAM|SG|MY|BR|PH|TH|VN|TR|RU|KR|TW|BD)(?=\d|$|_|[A-Z])/.exec(kode);
  return m ? m[1] : '';
}

export type OpsiRapihkan = {
  /**
   * true = daftar ini sudah di-scope ke satu chip wilayah (mis. "Free Fire SG"),
   * jadi kode di luar daftar resmi game ber-aturan tetap ditampilkan lewat pola
   * generik. false (default) = aturan ketat: hanya kode resmi, server luar dibuang.
   */
  semuaWilayah?: boolean;
  /** Nama chip/varian aktif ("Free Fire  ID Fast", "Free Fire SG", …). */
  wilayah?: string;
};

export function rapihkanKatalog(slug: string, items: TopupItemBernama[], opsi?: OpsiRapihkan): KatalogRapih {
  const semuaWilayah = !!opsi?.semuaWilayah;
  const wilayahChipAktif = wilayahChip(opsi?.wilayah || '');
  const eceran = new Map<string, TopupItemBernama>();
  const paket = new Map<string, TopupItemBernama>();
  const berAturan = !!ATURAN_PER_SLUG[slug];
  for (const it of items) {
    const k = (it.kode || '').toUpperCase().trim();
    if (!k || /^CEK/.test(k)) continue;
    // Kode ber-token wilayah (Rusia, Singapura, Malaysia, Brazil, Filipina, Latam,
    // Global, …) tidak dicampur ke daftar Indonesia: tiap wilayah punya chip-nya
    // sendiri di halaman detail. Di dalam chip, hanya kode wilayah chip itu yang
    // lolos sehingga "Free Fire SG" tidak ikut menampilkan produk MY/Global.
    const wKode = wilayahKode(k);
    if (wKode) {
      if (wilayahChipAktif) {
        if (wKode !== wilayahChipAktif) continue;
      } else if (!semuaWilayah) continue;
    }
    const n = (it.nama || '').trim();
    let nama: string;
    let jenis: 'eceran' | 'paket';
    const resmi = berAturan ? parseKodeResmi(slug, k) : null;
    if (resmi) {
      jenis = resmi.jenis;
      nama = n && n.toUpperCase() !== k ? n : resmi.nama;
    } else if (berAturan && !semuaWilayah) {
      continue; // chip Indonesia: kode di luar daftar resmi tidak ditampilkan sama sekali
    } else {
      // Game tanpa daftar resmi: pola sama seperti FF/ML — kode huruf+angka jadi
      // "N <satuan game>" (UC/CP/Diamond/…), token khusus jadi nama paket;
      // nama asli penyedia (bila dikirim) tetap dipakai.
      // Kode kanal nyata punya sufiks saluran ("PUBGM120_S2", "PUBGMKP120", "ZZZ60M"):
      // sufiks saluran yang berarti "produk sama, kanal lain" dilebur tanpa tag.
      const m = /^([A-Z]+)(\d+)(_[A-Z0-9]+|[A-Z]+)?$/.exec(k);
      let khusus: string | null = null;
      let tag = '';
      if (m) {
        if (TOKEN_KHUSUS[m[1]]) khusus = TOKEN_KHUSUS[m[1]];
        else for (const t of ['LUP', 'WDP', 'BP', 'TP', 'ES']) if (m[1].endsWith(t)) { khusus = TOKEN_KHUSUS[t]; break; }
        let suf = m[3] || '';
        if (/^_S\d+$/.test(suf)) suf = '';
        else if (suf === 'M' || suf === 'KP' || suf === 'KPEP' || suf === 'KPEPP') suf = '';
        if (suf) tag = suf.replace(/^_/, '');
      } else {
        for (const t of ['LUP', 'WDP', 'BP', 'TP', 'ES', 'M', 'B']) if (k.endsWith(t)) { khusus = TOKEN_KHUSUS[t]; break; }
      }
      jenis = khusus ? 'paket' : 'eceran';
      if (n && n.toUpperCase() !== k) nama = n;
      else if (khusus && m) nama = `${khusus} ${m[2]}`;
      else if (khusus) nama = khusus;
      else if (m) nama = `${Number(m[2])} ${UNIT_PER_SLUG[slug] || 'Diamond'}${tag ? ` (${tag})` : ''}`;
      else nama = humanisasiKode(k);
    }
    const target = jenis === 'paket' ? paket : eceran;
    const ada = target.get(nama);
    if (!ada || it.harga < ada.harga) target.set(nama, { ...it, nama });
  }
  const urut = (m: Map<string, TopupItemBernama>) => [...m.values()].sort((a, b) => a.harga - b.harga);
  return { eceran: urut(eceran), paket: urut(paket) };
}
