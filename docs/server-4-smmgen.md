# Server 3 di UI — provider SMMGen (internal `server=4`)

Nomor urut yang terlihat pengguna: **Server 1**, **Server 2**, **Server 3**. Di kode, Medanpedia
(gabungan katalog Server 1, prefix `S3-`) tetap memakai internal `server=3`, sehingga provider
baru SMMGen memakai internal `server=4` dengan prefix ID pesanan `S4-` agar tidak bertabrakan.

## Endpoint & berkas PHP (upload ke `/api`)
- `smmgen_lib.php` — klien API: POST form-encoded `key` + `action` (+ param aksi) ke
  `https://my.smmgen.com/api/v2`; error eksplisit provider `{"error":…}` → `SmgReject`;
  katalog cache 600 dtk (`smmgen_services_cache.json`) dengan tarif USD→IDR harian
  (`smmgen_fx_cache.json`, sumber open.er-api.com) supaya setara kolom harga server lain.
- `smmgen_config.php` (PRIVAT, salin dari `smmgen_config.example.php`) — `$SMG_BASE_URL`, `$SMG_API_KEY`.
- `smmgen_services.php` — katalog untuk dropdown Buat Pesanan (`{ok,services}`).
- `smmgen_status.php` / `smmgen_refill.php` — status & refill bentuk sama dengan server lain
  (prefix `S4-`, termasuk `S4-PENDING-…`; ID angka polos diterima untuk auto-deteksi Cek Status).
- `admin_data.php` action `smmgen_balance` — saldo provider (USD), HANYA dipanggil halaman
  Admin Panel → My Profit; gerbang `cp_require_admin`.

## Perilaku order (`order.php`, `order_price.php`)
- `server=4`: harga diverifikasi dari katalog SMMGen (markup web/Plus/panel sama seperti Server 1).
- Penolakan eksplisit provider → refund atomik + HTTP 400 "Order ditolak Server 3: … Saldo telah dikembalikan."
- Timeout/ambigu → ID `S4-PENDING-<16hex>` (saldo tetap, rekonsiliasi manual admin).
- Nama pesanan di riwayat diberi prefix `[Server 3] `.

## Frontend
- Dropdown Buat Pesanan: opsi `{ value: '4', label: 'Server 3 — SMMGen · Layanan Lengkap' }`;
  custom comments aktif untuk layanan bertipe custom; badge merek kategori ikut tampil.
- Routing `invokeProxy`: services→`smmgen_services.php`, status→`smmgen_status.php`,
  refill/refill_status→`smmgen_refill.php` (berdasar prefix `S4-`).
- Cek Status: grup ID `S4-` terpisah; ID angka polos mencoba Server 1 → Medanpedia → SMMGen.
