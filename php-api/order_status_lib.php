<?php
/**
 * order_status_lib.php — sinkron status pesanan OTOMATIS tanpa cron.
 *
 *  1. Seusai order berhasil disimpan, order.php langsung memanggil osx_sync_order()
 *     satu kali sehingga status 'pending' segera mengikuti keadaan asli di provider
 *     (proses / selesai / batal) — tidak menunggu diatur manual oleh admin.
 *  2. osx_maybe_run() = pengecekan otomatis 1 JAM SEKALI untuk semua pesanan user yang
 *     masih 'pending'/'proses' dan memiliki ID valid. Pola tanpa cron sama seperti
 *     data_retention_lib/agent_reminder: dipicu request biasa, maksimal sekali per jam
 *     lewat tabel order_status_sweep_log.
 *  3. ID placeholder gagal kirim (slug PENDING-, S2-PENDING-, S3-PENDING-, S4-PENDING- —
 *     termasuk order yang gagal karena saldo provider kurang) TIDAK pernah dicek ke
 *     provider: osx_provider_of() mengembalikan null untuk slug tersebut, dan query
 *     sweep memakai NOT LIKE '%PENDING-%'.
 */
if (!function_exists('osx_is_pending_slug')) {

    /** ID placeholder (pengiriman tidak pasti / saldo provider kurang) — bukan ID provider asli. */
    function osx_is_pending_slug($id) {
        return stripos((string)$id, 'PENDING-') !== false;
    }

    /** Provider pemilik pesanan, atau null bila ID tidak valid untuk dicek (termasuk slug PENDING). */
    function osx_provider_of($id) {
        $id = (string)$id;
        if (osx_is_pending_slug($id)) return null;
        if (preg_match('/^S2-[0-9]+$/', $id)) return 'naizop';
        if (preg_match('/^S3-[0-9]+$/', $id)) return 'medanpedia';
        if (preg_match('/^S4-[0-9]+$/', $id)) return 'smmgen';
        if (preg_match('/^[0-9]+$/', $id)) return 'fayupedia';
        return null;
    }

    /** Status mentah provider → status riwayat. Balasan provider yang dikenali (bukan pesan
     *  error) dianggap order sedang berjalan → 'proses', sehingga pesanan tidak menempel di
     *  'pending' hanya karena sebutan status provider tidak sama dengan daftar kita. */
    function osx_map_status($raw) {
        $s = strtolower(trim((string)$raw));
        if ($s === '' || $s === '0' || $s === 'false') return null;
        if (in_array($s, ['completed', 'complete', 'selesai', 'finished', 'done'], true)) return 'selesai';
        if (in_array($s, ['canceled', 'cancelled', 'refunded', 'batal', 'failed'], true)) return 'batal';
        // pesan error/temuan-bukan-order → jangan ubah status
        if (strpos($s, 'not found') !== false || strpos($s, 'invalid') !== false || strpos($s, 'error') !== false
            || strpos($s, 'unknown') !== false || strpos($s, 'tidak ditemukan') !== false) return null;
        return 'proses'; // pending/processing/in progress/partial/queue/sebutan lain = sedang berjalan
    }

    /** Jejak sync untuk debugging di hosting (id, balasan mentah, hasil pemetaan). */
    function osx_log($text) {
        @file_put_contents(__DIR__ . '/order_status_log.txt', date('Y-m-d H:i:s') . ' ' . $text . "\n", FILE_APPEND);
    }

    function osx_fayupedia_status($num) {
        // config.php ($API_ID,$API_KEY,$BASE_URL) dimuat pemanggil (order.php); bila lib dipanggil
        // dari endpoint lain, muat sekali di scope fungsi ini.
        if (!isset($GLOBALS['BASE_URL']) && is_file(__DIR__ . '/config.php')) include_once __DIR__ . '/config.php';
        if (empty($GLOBALS['BASE_URL']) || empty($GLOBALS['API_KEY'])) return null;
        $key = ['api_id' => (int)($GLOBALS['API_ID'] ?? 0), 'api_key' => $GLOBALS['API_KEY'], 'order' => $num];
        // Dua bentuk permintaan yang umum dipakai panel SMM: path /status dan param action=status.
        $tries = [
            [$GLOBALS['BASE_URL'] . 'status', $key],
            [$GLOBALS['BASE_URL'], $key + ['action' => 'status']],
        ];
        foreach ($tries as [$url, $fields]) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => 1,
                CURLOPT_POSTFIELDS => http_build_query($fields),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
            ]);
            $body = curl_exec($ch);
            curl_close($ch);
            $j = json_decode((string)$body, true);
            if (!is_array($j)) continue;
            $st = $j['status'] ?? $j['order_status'] ?? (is_array($j['order'] ?? null) ? ($j['order']['status'] ?? null) : null);
            if (is_string($st) && $st !== '') return $st;
            if ($st === false || $st === null) continue; // coba bentuk berikutnya
        }
        return null;
    }

    /** Ambil status mentah satu pesanan dari providernya; null = gagal/tidak dikenal (status tidak diubah). */
    function osx_fetch_status($id) {
        $prov = osx_provider_of($id);
        if ($prov === null) return null;
        try {
            if ($prov === 'fayupedia') {
                return osx_fayupedia_status((string)$id);
            }
            if ($prov === 'naizop') {
                require_once __DIR__ . '/naizop_lib.php';
                preg_match('/^S2-([0-9]+)$/', (string)$id, $m);
                $res = n2_call('status', ['orders' => $m[1]]);
                $e = is_array($res) ? ($res[$m[1]] ?? null) : null;
                return is_array($e) ? ($e['status'] ?? $e['order_status'] ?? null) : null;
            }
            if ($prov === 'medanpedia') {
                require_once __DIR__ . '/medanpedia_lib.php';
                preg_match('/^S3-([0-9]+)$/', (string)$id, $m);
                $parsed = mp_call('status', ['order' => $m[1]]);
                $entries = is_array($parsed['data'] ?? null) ? $parsed['data'] : (is_array($parsed['orders'] ?? null) ? $parsed['orders'] : (isset($parsed['order_status']) || isset($parsed['status']) ? [$m[1] => $parsed] : []));
                $e = $entries[$m[1]] ?? $entries[(int)$m[1]] ?? (count($entries) === 1 ? reset($entries) : null);
                return is_array($e) ? ($e['order_status'] ?? $e['status'] ?? null) : null;
            }
            require_once __DIR__ . '/smmgen_lib.php';
            preg_match('/^S4-([0-9]+)$/', (string)$id, $m);
            $parsed = smg_call('status', ['order' => $m[1]]);
            $e = (is_array($parsed) && (isset($parsed['order_status']) || (isset($parsed['status']) && is_string($parsed['status']))))
                ? $parsed
                : (is_array($parsed) ? ($parsed[$m[1]] ?? $parsed[(int)$m[1]] ?? null) : null);
            return is_array($e) ? ($e['order_status'] ?? $e['status'] ?? null) : null;
        } catch (Throwable $e) {
            return null; // provider tak membalas → biarkan status apa adanya, coba lagi jam berikutnya
        }
    }

    /**
     * Sinkronkan satu baris riwayat ke status provider terkini.
     * $row minimal: ['id'=>int, 'order_id'=>string, 'status'=>string].
     * Mengembalikan status baru atau null bila tidak berubah/tidak bisa dicek.
     */
    function osx_sync_order($conn, $row) {
        $oid = (string)($row['order_id'] ?? '');
        if (osx_provider_of($oid) === null) return null; // slug PENDING & ID tak valid dilewati
        $raw = osx_fetch_status($oid);
        $map = osx_map_status($raw);
        osx_log("sync id=$oid raw=" . json_encode($raw) . " map=" . json_encode($map) . " lama=" . json_encode($row['status']));
        if ($map === null || $map === (string)$row['status']) return null;
        try {
            $st = $conn->prepare("UPDATE riwayat_pesanan SET status = ? WHERE order_id = ? AND status IN ('pending','proses')");
            $st->bind_param('ss', $map, $oid);
            $st->execute();
            $done = $st->affected_rows === 1;
            $st->close();
            return $done ? $map : null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Sinkron pesanan SATU user yang masih pending/proses (dipanggil sesudah respons
     * riwayat_pesanan.php) — sehingga status terbaru terlihat saat user memuat ulang
     * riwayat, tanpa menunggu sweep 1 jam.
     */
    function osx_sync_user_orders($conn, $userId, $limit = 10) {
        try {
            $res = $conn->query("SELECT id, order_id, status FROM riwayat_pesanan
                                 WHERE user_id = " . (int)$userId . " AND status IN ('pending','proses') AND order_id NOT LIKE '%PENDING-%'
                                 ORDER BY id DESC LIMIT " . (int)$limit);
            $changed = 0;
            while ($res && ($r = $res->fetch_assoc())) {
                try { if (osx_sync_order($conn, $r) !== null) $changed++; } catch (Throwable $e) { /* lanjut */ }
            }
            return $changed;
        } catch (Throwable $e) {
            return 0;
        }
    }

    function osx_sweep_schema($conn) {
        $conn->query("CREATE TABLE IF NOT EXISTS order_status_sweep_log (
            id       INT AUTO_INCREMENT PRIMARY KEY,
            ran_at   DATETIME NOT NULL,
            checked  INT NOT NULL DEFAULT 0,
            changed  INT NOT NULL DEFAULT 0,
            KEY idx_ran (ran_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    /**
     * Pengecekan otomatis 1 jam sekali (tanpa cron): semua pesanan 'pending'/'proses'
     * ber-ID valid disinkronkan ke provider. Slug PENDING- tidak ikut.
     * Mengembalikan ringkasan ['checked'=>n,'changed'=>n] atau null bila belum jatuh tempo.
     */
    function osx_maybe_run($conn, $limit = 50) {
        try {
            osx_sweep_schema($conn);
            $last = $conn->query("SELECT MAX(ran_at) t FROM order_status_sweep_log")->fetch_assoc()['t'] ?? null;
            if ($last && (time() - strtotime((string)$last)) < 3600) return null; // belum 1 jam
            $conn->query("INSERT INTO order_status_sweep_log (ran_at, checked, changed) VALUES (NOW(), 0, 0)");
            $logId = (int)$conn->insert_id;
            $checked = 0; $changed = 0;
            $res = $conn->query("SELECT id, order_id, status FROM riwayat_pesanan
                                 WHERE status IN ('pending','proses') AND order_id NOT LIKE '%PENDING-%'
                                 ORDER BY id DESC LIMIT " . (int)$limit);
            while ($res && ($r = $res->fetch_assoc())) {
                $checked++;
                try { if (osx_sync_order($conn, $r) !== null) $changed++; } catch (Throwable $e) { /* lanjut ke order berikutnya */ }
            }
            $st = $conn->prepare("UPDATE order_status_sweep_log SET checked = ?, changed = ? WHERE id = ?");
            $st->bind_param('iii', $checked, $changed, $logId);
            $st->execute();
            $st->close();
            return ['checked' => $checked, 'changed' => $changed];
        } catch (Throwable $e) {
            error_log('order_status_sweep: ' . $e->getMessage());
            return null;
        }
    }
}
