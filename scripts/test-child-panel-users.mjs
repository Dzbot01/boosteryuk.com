import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

/* 1. Detail child panel (admin): total user yang login dari panel tersebut */
const lib = read('php-api/child_panel_lib.php');
const api = read('php-api/child_panel.php');
const svc = read('src/services/childPanelApi.ts');
const detail = read('src/components/childpanel/ChildPanelDetail.tsx');

// Sumber data: child_panel_activity menyimpan SATU baris per (panel, user) → COUNT(*) = jumlah user.
assert.match(lib, /PRIMARY KEY \(child_panel_id, user_id\)/, 'satu baris aktivitas per (panel, user)');
assert.match(lib, /INSERT INTO child_panel_activity \(child_panel_id, user_id, first_seen, last_seen, visits, last_action\)/, 'aktivitas dicatat saat user login/order lewat panel');
assert.match(lib, /function cp_user_count\(\$conn, \$panelId\)/, 'helper penghitung total user panel');
assert.match(lib, /SELECT COUNT\(\*\) AS total FROM child_panel_activity WHERE child_panel_id = \?/, 'hitung user per panel (prepared statement)');
assert.match(lib, /\$st = cp_q\(\$conn, 'SELECT COUNT\(\*\) AS total FROM child_panel_activity WHERE child_panel_id = \?', 'i', \(int\)\$panelId\);/, 'parameter panel di-bind sebagai integer');
assert.match(lib, /\$row = \$st->get_result\(\)->fetch_assoc\(\);\s*\$st->close\(\);\s*return \(int\)\(\$row\['total'\] \?\? 0\);/, 'hasil diambil lewat get_result() lalu stmt ditutup');
assert.ok(!/\$row = cp_q\(/.test(lib), 'mysqli_stmt dari cp_q() tidak boleh dipakai sebagai array (fatal di hosting)');
assert.match(lib, /return \(int\)\(\$row\['total'\] \?\? 0\);/, 'selalu membalas angka');

// Dikirim ke admin lewat aksi admin_detail (dan setelah admin_income_credit).
assert.match(api, /\$usersTotal = cp_user_count\(\$conn, \$pid\);/, 'total user dihitung untuk panel yang dibuka admin');
assert.match(api, /'users_total'=>\$usersTotal/, 'users_total ikut dibalaskan ke admin');
assert.ok(
  api.indexOf("$action === 'admin_detail'") < api.indexOf('cp_user_count'),
  'penghitungan ada di dalam blok admin_detail',
);
assert.ok(
  api.indexOf("'credits'=>$credits") < api.indexOf("'users_total'=>$usersTotal"),
  'users_total dikirim bersama detail panel',
);
assert.ok(!/'stats'=>/.test(api), 'tidak ada field statistik lama yang tertinggal');

// Klien admin: tipe + field di kartu Detail.
assert.match(svc, /users_total\?: number/, 'tipe PanelDetail memuat users_total');
assert.match(detail, /\['Total user yang login',`\$\{\(data\.users_total \?\? 0\)\.toLocaleString\('id-ID'\)\} user`\]/, 'field tampil di <dl> Detail panel');
assert.ok(
  detail.indexOf('Total user yang login') < detail.indexOf('Markup Merchant'),
  'field total user muncul sebelum baris markup',
);
assert.match(detail, /Total user yang login dihitung dari aktivitas akun \(unregister maupun visitor\)/, 'keterangan sumber angka untuk admin');

console.log('PASS Child Panel: kartu Detail admin menampilkan total user yang login dari panel tersebut (COUNT child_panel_activity per panel, dikirim admin_detail sebagai users_total).');
