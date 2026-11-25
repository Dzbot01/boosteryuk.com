import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const parser = new (require('php-parser'))({ parser: { php7: true } });
const read = (p) => fs.readFileSync(p, 'utf8');

/* Sintaks PHP tetap valid (order.php kini menolak server yang ditutup admin). */
for (const f of ['order.php', 'site_settings.php', 'admin_data.php', 'data_retention_lib.php']) {
  parser.parseCode(read('php-api/' + f));
}

const srv = read('src/pages/admin/AdminServerPage.tsx');
const card = read('src/components/BuatPesananCard.tsx');
const ctx = read('src/context/SiteSettingsContext.tsx');
const ss = read('php-api/site_settings.php');
const order = read('php-api/order.php');

/* 1. Server Panel hanya menampilkan API yang BENAR-BENAR dipakai */
const listStart = srv.indexOf('const PROVIDERS: Provider[] = [');
const listEnd = srv.indexOf('];', listStart);
assert.ok(listStart > -1 && listEnd > listStart, 'daftar provider ada');
const list = srv.slice(listStart, listEnd);
for (const unused of ['irvankedesmm.co.id', 'indosmm.id', 'djuragansosmed.com', 'Irvan Kedes SMM', 'IndoSMM', 'Djuragan Sosmed']) {
  assert.ok(!list.includes(unused), `provider yang tidak dipakai dihapus dari daftar: ${unused}`);
}
assert.match(srv, /sudah dihapus dari daftar/, 'penghapusan provider lama dicatat di komentar');
for (const used of ['https://fayupedia.id/api/services', 'https://naizop.com/api/v2', 'https://api.medanpedia.co.id', 'https://my.smmgen.com/api/v2']) {
  assert.ok(srv.includes(used), `API yang dipakai ditampilkan: ${used}`);
}
assert.equal((list.match(/server: '/g) || []).length, 4, 'empat API dipetakan ke nomor server internal');
/* URL di halaman admin = URL yang benar-benar dipanggil PHP. */
assert.match(read('php-api/naizop_lib.php'), /https:\/\/naizop\.com\/api\/v2/);
assert.match(read('php-api/smmgen_lib.php'), /https:\/\/my\.smmgen\.com\/api\/v2/);
assert.match(read('php-api/medanpedia_config.example.php'), /https:\/\/api\.medanpedia\.co\.id/);
assert.match(srv, /usedBy: string;/, 'admin melihat berkas PHP pemanggil tiap API');
assert.match(srv, /uiLabel: string;/, 'admin melihat pilihan server yang dikendalikan API itu');

/* Nama provider tidak boleh bocor ke label/pesan yang dilihat user (komentar kode boleh). */
const choicesStart = card.indexOf('const SERVER_CHOICES: Option[] = [');
const choices = card.slice(choicesStart, card.indexOf('];', choicesStart));
assert.ok(choicesStart > -1, 'daftar pilihan server ada');
for (const n of ['Fayupedia', 'Naizop', 'Medanpedia', 'SMMGen']) {
  assert.ok(!choices.includes(n), `nama provider tidak tampil di pilihan server user: ${n}`);
  assert.ok(!new RegExp(`label: '[^']*${n}`).test(card), `tidak ada label yang menyebut ${n}`);
  assert.ok(!new RegExp(`message: '[^']*${n}`).test(card), `tidak ada pesan yang menyebut ${n}`);
}
assert.match(card, /label: 'Server 1 — Ringkas & Stabil'/);
assert.match(card, /label: 'Server 2 — Baru · Layanan Lebih Lengkap'/);
assert.match(card, /label: 'Server 3 — Lengkap & Murah'/);

/* 2. Admin bisa menutup akses order di server tertentu */
assert.match(srv, /Tutup order/, 'tombol tutup order');
assert.match(srv, /Buka order/, 'tombol buka kembali');
assert.match(srv, /aria-pressed=\{isClosed\}/, 'status tombol terbaca screen reader');
assert.match(srv, /window\.confirm\(/, 'konfirmasi dulu sebelum menutup server');
assert.match(srv, /updateSettings\(\{ closedServers: next \}\)/, 'disimpan lewat pengaturan website (database)');
assert.match(srv, /\(settings\.closedServers \|\| \[\]\)\.map\(\(s\) => String\(s\)\)/, 'status dibaca dari pengaturan tersimpan');
assert.match(srv, /Order ditutup/, 'baris server yang ditutup diberi penanda');
assert.match(srv, /order\.php/, 'admin diberi tahu penolakan juga ditegakkan di server');

/* Penyimpanan: whitelist site_settings.php (kunci baru ikut terkirim & tersaring). */
assert.match(ss, /array_key_exists\('closedServers', \$patch\)/, 'closedServers masuk whitelist POST');
assert.match(ss, /array_slice\(\$list, 0, 4\)/, 'maksimal 4 server');
assert.match(ss, /in_array\(\$v, \['1', '2', '3', '4'\], true\)/, 'hanya nomor server valid yang disimpan');
assert.match(ss, /closedServers \(server yang order-nya ditutup admin\)/, 'dokumentasi kunci');

/* Konteks pengaturan: dibagikan ke semua pengunjung lewat database. */
assert.match(ctx, /closedServers: string\[\];/, 'tipe pengaturan');
assert.match(ctx, /^  'closedServers',$/m, 'closedServers di SHARED_KEYS (tersimpan ke database)');
assert.match(ctx, /closedServers: \[\],/, 'default: semua server terbuka');
assert.match(ctx, /k !== 'closedServers'/, 'daftar kosong dari server tetap dipakai (server dibuka lagi)');

/* Penegakan di server: ditolak SEBELUM harga dihitung & saldo dipotong. */
assert.match(order, /function bk_server_closed\(\$conn, \$server\)/, 'pemeriksa server tertutup');
assert.match(order, /SELECT setting_value FROM site_settings WHERE setting_key = 'site' LIMIT 1/, 'baca dari site_settings');
assert.match(order, /if \(bk_server_closed\(\$conn, \$server\)\) \{/, 'order ditolak bila server ditutup');
assert.ok(order.indexOf('if (bk_server_closed($conn, $server)) {') < order.indexOf('bk_order_price('), 'ditolak sebelum harga diverifikasi');
assert.ok(order.indexOf('if (bk_server_closed($conn, $server)) {') < order.indexOf('UPDATE users SET balance = balance - ?'), 'ditolak sebelum saldo dipotong');
assert.match(order, /http_response_code\(403\)/, 'balasan 403');
assert.match(order, /Server yang Anda pilih sedang ditutup sementara oleh admin\. Silakan pilih server lain\./, 'pesan user tanpa menyebut nama provider');
assert.match(order, /catch \(Throwable \$e\) \{\s*return false;/, 'gagal baca pengaturan = server dianggap terbuka');

/* Form order: server yang ditutup hilang dari pilihan & layanannya disembunyikan. */
assert.match(card, /const SERVER_CHOICES: Option\[\] = \[/, 'pilihan server jadi satu daftar');
assert.ok(!card.includes("options={[{ value: '1', label: 'Server 1"), 'opsi server tidak lagi hardcode di CustomSelect');
assert.match(card, /const closedServers = useMemo\(/, 'daftar server tertutup dari pengaturan');
assert.match(card, /SERVER_CHOICES\.filter\(\(o\) => !closedServers\.has\(o\.value\)\)/, 'server tertutup disaring dari dropdown');
assert.match(card, /options=\{serverOptions\}/, 'dropdown memakai daftar yang sudah disaring');
assert.match(card, /if \(!closedServers\.has\(String\(server\)\)\) return;/, 'tidak pindah server bila servernya masih terbuka');
assert.match(card, /Pesanan dialihkan ke server lain yang masih terbuka\./, 'user diberi tahu saat dipindahkan');
assert.match(card, /const openServices = useMemo\(/, 'layanan dari server yang ditutup disembunyikan');
assert.match(card, /services\.filter\(\(s\) => !closedServers\.has\(String\(s\.source\)\)\)/, 'filter layanan per sumber server (mis. M3: di dalam Server 1)');
assert.match(card, /\}, \[openServices\]\);/, 'kategori dihitung dari layanan yang masih terbuka');
assert.match(card, /placeholder=\{serverOptions\.length \? 'Pilih\.\.\.' : 'Semua server sedang ditutup'\}/, 'keterangan bila semua server ditutup');

console.log('PASS Server Panel: hanya 4 API yang benar-benar dipakai (Fayupedia/Naizop/Medanpedia/SMMGen) yang ditampilkan, provider lama dihapus, admin bisa menutup akses order per server (disimpan di site_settings.closedServers, ditegakkan order.php 403 sebelum saldo dipotong, dropdown + daftar layanan user ikut menyesuaikan).');
