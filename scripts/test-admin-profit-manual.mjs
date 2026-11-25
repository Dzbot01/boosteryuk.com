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

/* Halaman Data Deposit: top up manual admin TIDAK lagi dihitung pada total (permintaan admin);
   barisnya tetap tampil di tabel sebagai catatan, bukan sebagai angka rekap. */
const depositPage = read('src/pages/admin/AdminDepositPage.tsx');
assert.ok(!/stats\.manual\?\.today/.test(depositPage), 'Data Deposit tidak lagi menjumlahkan top up manual admin');
assert.match(depositPage, /const today = stats \? stats\.today : null;/, 'total hari ini murni deposit gateway');
assert.match(depositPage, /const month = stats \? stats\.month : null;/, 'total bulan ini murni deposit gateway');
assert.match(depositPage, /TIDAK dihitung pada total/, 'keterangan halaman menegaskan manual tidak dihitung');
assert.match(depositPage, /'Manual admin'/, 'baris manual tetap tampil di tabel sebagai catatan');
assert.match(read('src/services/adminDataApi.ts'), /deposits: Period & \{ source: string \| null; count_month: number; manual\?: Period \}/, 'tipe ProfitData.deposits tetap menyediakan manual untuk halaman lain');

/* Server tetap menyediakan angka manual (dipakai Data Deposit + notifikasi admin), hanya kartu My Profit yang berhenti memakainya. */
const ad = read('php-api/admin_data.php');
assert.match(ad, /\$out\['manual'\] = \['today'/, 'admin_data.php masih menghitung top up manual untuk halaman Data Deposit');
assert.match(ad, /'method' => 'Manual admin'/, 'baris deposit manual tetap dikirim ke Data Deposit');
assert.match(read('php-api/admin_notifications_lib.php'), /'manual'=>\$manual/, 'notifikasi admin tetap memakai angka manual');

/* Syarat & ketentuan Order OTP: typo "masin" diperbaiki dan kalimat dipecah jadi dua paragraf. */
const otp = read('src/pages/OrderOtpPage.tsx');
assert.ok(!otp.includes('masin'), 'typo "masin" di syarat OTP dihapus');
assert.match(otp, /menunggu minimal 3 menit untuk menunggu kode OTP\s+muncul\.\s*<\/p>/, 'kalimat pertama ditutup setelah "muncul."');
assert.match(otp, /Jika masih belum muncul artinya stok yang di pilih pada harga tersebut sedang sedikit atau kosong -/, 'paragraf kedua perbaikan syarat OTP');

console.log('PASS My Profit & Data Deposit: manual admin tidak dihitung di kedua halaman (baris catatan tetap ada); syarat OTP diperbaiki.');
