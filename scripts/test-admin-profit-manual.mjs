import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

/* My Profit → kartu "Deposit masuk": field Manual admin dihapus & tidak lagi dihitung. */
const profit = read('src/pages/admin/AdminProfitPage.tsx');
assert.ok(!profit.includes('Manual admin bulan ini'), 'baris "Manual admin bulan ini" dihapus');
assert.ok(!/dep\.manual/.test(profit), 'tidak ada lagi penjumlahan dep.manual di kartu deposit');
assert.ok(!profit.includes('gateway + top up manual admin'), 'keterangan kartu tidak lagi menyebut top up manual admin');
assert.match(profit, /label="Deposit masuk" value=\{dep \? rupiah\(dep\.month\) : null\}/, 'nilai kartu = deposit gateway bulan ini saja');
assert.match(profit, /sub="Bulan ini \(deposit gateway\)"/, 'keterangan kartu deposit gateway');
assert.match(profit, /<Row k="Hari ini" v=\{rupiah\(dep\.today\)\} \/>/, 'baris hari ini tanpa manual');
assert.match(profit, /<Row k="Total semua" v=\{rupiah\(dep\.all\)\} strong \/>/, 'total semua tanpa manual');
assert.match(profit, /Top up manual admin TIDAK lagi dihitung sebagai deposit masuk/, 'alasan perubahan dicatat di kode');

/* Halaman Data Deposit tidak diubah: top up manual admin masih tampil sebagai data (bukan penghasilan). */
const depositPage = read('src/pages/admin/AdminDepositPage.tsx');
assert.match(depositPage, /stats\.manual\?\.today/, 'Data Deposit tetap menghitung manual untuk rekapnya sendiri');
assert.match(depositPage, /'Manual admin'/, 'label sumber manual tetap ada di daftar deposit');
assert.match(read('src/services/adminDataApi.ts'), /deposits: Period & \{ source: string \| null; count_month: number; manual\?: Period \}/, 'tipe ProfitData.deposits tetap menyediakan manual untuk halaman lain');

/* Server tetap menyediakan angka manual (dipakai Data Deposit + notifikasi admin), hanya kartu My Profit yang berhenti memakainya. */
const ad = read('php-api/admin_data.php');
assert.match(ad, /\$out\['manual'\] = \['today'/, 'admin_data.php masih menghitung top up manual untuk halaman Data Deposit');
assert.match(ad, /'method' => 'Manual admin'/, 'baris deposit manual tetap dikirim ke Data Deposit');
assert.match(read('php-api/admin_notifications_lib.php'), /'manual'=>\$manual/, 'notifikasi admin tetap memakai angka manual');

console.log('PASS My Profit: field "Manual admin" di kartu Deposit masuk dihapus dan tidak lagi dijumlahkan; Data Deposit + notifikasi admin tetap menampilkan top up manual.');
