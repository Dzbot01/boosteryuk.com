import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const parser = new (require('php-parser'))({ parser: { php7: true } });
const read = (p) => fs.readFileSync(p, 'utf8');

/* Sintaks PHP valid. */
for (const f of ['data_retention.php', 'data_retention_lib.php', 'admin_data.php']) parser.parseCode(read('php-api/' + f));

const lib = read('php-api/data_retention_lib.php');
const api = read('php-api/data_retention.php');
const sql = read('php-api/data_retention.sql');
const adminData = read('php-api/admin_data.php');

/* 1. Dua jadwal: TAHUNAN (semua riwayat > 1 tahun) & BULANAN (data gagal > 1 bulan) */
assert.match(lib, /return \$kind === 'yearly' \? 'INTERVAL 1 YEAR' : 'INTERVAL 1 MONTH';/, 'jendela simpan: 1 tahun / 1 bulan');
assert.match(lib, /`\$timeCol` < DATE_SUB\(NOW\(\), " \. dr_interval\(\$kind\) \./, 'penghapusan memakai batas waktu, bukan seluruh tabel');
assert.match(lib, /\$d->format\('Y'\) : \$d->format\('Y-m'\)/, 'periode jadwal dihitung dalam WIB');
assert.match(lib, /Asia\/Jakarta/, 'zona waktu WIB');
assert.match(lib, /function dr_next_run\(\$kind, \$now = null\)/, 'perkiraan pembersihan berikutnya');
assert.match(lib, /modify\('first day of next month'\)/, 'jadwal bulanan bergulir ke bulan berikutnya');

/* Target: riwayat pesanan + OTP + deposit + invoice deposit. */
for (const t of ['riwayat_pesanan', 'otp_orders', 'deposits', 'deposit_invoices']) {
  assert.ok(lib.includes(`['${t}', 'created_at'`), `tabel yang dibersihkan: ${t}`);
}
/* Definisi "gagal" untuk pembersihan bulanan. */
assert.match(lib, /"status = 'batal'"/, 'pesanan batal = gagal');
assert.match(lib, /"status IN \('batal','gagal'\)"/, 'OTP batal/gagal = gagal');
assert.match(lib, /"LOWER\(status\) <> 'paid'"/, 'deposit yang tidak terbayar = gagal');
assert.match(lib, /"status IN \('CANCELLED','FAILED','EXPIRED','REFUND'\)"/, 'invoice gateway terminal = gagal');
/* Data uang/pendapatan lain TIDAK dihapus. */
for (const keep of ['child_panel_orders', 'child_panel_income_adjustments', 'smm_order_profit', 'admin_balance_log', 'daily_streak_receipts', 'users']) {
  assert.ok(!lib.includes(`['${keep}',`), `tabel yang tidak boleh disentuh: ${keep}`);
}
assert.ok(!/UPDATE users SET balance/.test(lib), 'pembersihan tidak mengubah saldo user');
assert.ok(!/TRUNCATE|DROP TABLE/i.test(lib), 'tidak ada TRUNCATE/DROP — hanya DELETE baris lama');

/* 2. Sekali per periode walau tanpa cron (log UNIQUE), aman dipanggil berulang */
assert.match(lib, /CREATE TABLE IF NOT EXISTS data_retention_log/, 'tabel log dibuat otomatis (lazy DDL)');
assert.match(lib, /UNIQUE KEY uniq_period \(kind, period_key\)/, 'satu pembersihan per periode');
assert.match(sql, /UNIQUE KEY uniq_period \(kind, period_key\)/, 'SQL twin memiliki kunci unik yang sama');
assert.match(lib, /INSERT IGNORE INTO data_retention_log \(kind, period_key, triggered_by\)/, 'klaim periode dulu, baru menghapus');
assert.match(lib, /if \(\$conn->affected_rows === 0\) \{/, 'periode yang sudah dibersihkan dilewati');
assert.match(lib, /DELETE FROM `\$table` WHERE \$cond LIMIT \$chunk/, 'penghapusan bertahap agar tidak mengunci tabel lama');
assert.match(lib, /\$chunk = 2000, \$maxLoops = 500/, 'batas chunk + jumlah putaran');
assert.match(lib, /function dr_maybe_run\(\$conn\)/, 'pemicu otomatis tanpa cron');
assert.match(lib, /catch \(Throwable \$e\) \{\s*error_log\('data_retention: '/, 'kegagalan pembersihan tidak merusak halaman admin');
assert.match(lib, /function dr_run_now\(\$conn, \$kind\)/, 'admin bisa menjalankan manual');
assert.match(lib, /\$key = 'manual ' \. date\('Y-m-d H:i:s'\)/, 'jalan manual dicatat terpisah dari slot periode');
assert.match(lib, /function dr_status\(\$conn\)/, 'ringkasan untuk halaman admin');
assert.match(lib, /function dr_pending_count/, 'jumlah baris yang akan dihapus ditampilkan lebih dulu');

/* 3. Pemicu otomatis: admin membuka halaman data → jadwal yang jatuh tempo dijalankan */
assert.match(adminData, /require_once __DIR__ \. '\/data_retention_lib\.php';/, 'admin_data.php memuat lib retensi');
assert.match(adminData, /^dr_maybe_run\(\$conn\);$/m, 'pembersihan dipicu tiap request admin');
assert.ok(adminData.indexOf('cp_require_admin') < adminData.indexOf('dr_maybe_run($conn);'), 'hanya setelah token admin valid');

/* 4. Endpoint admin (status | run) */
assert.match(api, /cp_require_admin\(\$conn, \$in\['token'\] \?\? ''/, 'hanya role admin');
assert.match(api, /Hanya admin yang boleh membuka pengaturan database\./, 'pesan penolakan');
assert.match(api, /in_array\(\$action, \['status', 'run'\], true\)/, 'aksi terbatas status/run');
assert.match(api, /in_array\(\$kind, \['yearly', 'monthly'\], true\)/, 'kind terbatas yearly/monthly');
assert.match(api, /\$result = dr_run_now\(\$conn, \$kind\);/, 'tombol jalankan sekarang');
assert.match(api, /\$auto = dr_maybe_run\(\$conn\);/, 'membuka halaman sekaligus menjalankan jadwal jatuh tempo');
assert.match(api, /if \(\$_SERVER\['REQUEST_METHOD'\] !== 'POST'\) dr_out\(\['ok' => false, 'message' => 'Gunakan POST\.'\], 405\);/, 'hanya POST');

/* 5. Halaman admin "Pengaturan Database" */
const app = read('src/App.tsx');
assert.match(app, /const AdminDatabasePage = lazy\(\(\) => import\('\.\/pages\/admin\/AdminDatabasePage'\)\);/, 'halaman dimuat lazy');
assert.match(app, /<Route path="admin\/database" element=\{<ProtectedRoute adminOnly><AdminDatabasePage \/><\/ProtectedRoute>\} \/>/, 'route khusus admin');
const home = read('src/pages/admin/AdminHomePage.tsx');
assert.match(home, /path: '\/admin\/database'/, 'kartu di Admin Panel');
assert.match(home, /title: 'Pengaturan Database'/);
assert.match(home, /icon: Database/);
const page = read('src/pages/admin/AdminDatabasePage.tsx');
assert.match(page, /title="Pengaturan Database"/);
assert.match(page, /const KINDS: RetentionKind\[\] = \['yearly', 'monthly'\];/, 'kedua jadwal ditampilkan');
assert.match(page, /KIND_LABEL: Record<RetentionKind, string> = \{ yearly: 'Setiap tahun', monthly: 'Setiap 1 bulan' \}/, 'label jadwal sesuai permintaan');
assert.match(page, /Jalankan pembersihan sekarang/, 'tombol jalankan manual');
assert.match(page, /window\.confirm\(/, 'konfirmasi sebelum menghapus data');
assert.match(page, /Data yang sudah terhapus tidak bisa dikembalikan/, 'peringatan backup');
assert.match(page, /Riwayat pembersihan/, 'tabel riwayat pembersihan');
assert.match(page, /dr_maybe_run\(\)/, 'penjelasan pemicu tanpa cron');
assert.match(page, /Saldo user TIDAK berubah/, 'penegasan tidak memotong saldo');
assert.match(page, /function ScheduleCard\(/, 'kartu jadwal dipisah dari komponen halaman');
const svc = read('src/services/dataRetentionApi.ts');
assert.match(svc, /const API = `\$\{MAIN_API\}\/data_retention\.php`;/, 'klien menunjuk endpoint baru');
assert.match(svc, /export type RetentionKind = 'yearly' \| 'monthly';/);
assert.match(svc, /run: \(kind: RetentionKind\) => call/, 'aksi run per jadwal');
assert.match(svc, /cache: 'no-store'/, 'status selalu segar');

console.log('PASS Pengaturan Database: pembersihan rutin tanpa cron — tahunan menghapus semua riwayat order & deposit > 1 tahun, bulanan menghapus data gagal (batal/gagal/tidak terbayar/invoice terminal) > 1 bulan, sekali per periode lewat data_retention_log, dipicu admin_data.php, dikendalikan admin dari /admin/database, saldo user tidak berubah.');
