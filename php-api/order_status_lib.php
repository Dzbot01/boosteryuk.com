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

    /** Status mentah provider → status riwayat: selesai / batal / proses; null = respons tak dikenal. */
    function osx_map_status($raw) {
        $s = strtolower(trim((string)$raw));
        if ($s === '') return null;
        if (in_array($s, ['completed', 'complete', 'selesai', 'finished', 'done'], true)) return 'selesai';
        if (in_array($s, ['canceled', 'cancelled', 'refunded', 'batal', 'error', 'failed'], true)) return 'batal';
        if (in_array($s, ['pending', 'processing', 'in progress', 'inprogress', 'partial', 'queued', 'queue', 'proses'], true)) return 'proses';
        return null;
    }

    function osx_fayupedia_status($num) {
        // config.php ($API_ID,$API_KEY,$BASE_URL) dimuat pemanggil (order.php); bila lib dipanggil
        // dari endpoint lain, muat sekali di scope fungsi ini.
        if (!isset($GLOBALS['BASE_URL']) && is_file(__DIR__ . '/config.php')) include_once __DIR__ . '/config.php';
        if (empty($GLOBALS['BASE_URL']) || empty($GLOBALS['API_KEY'])) return null;
        $ch = curl_init($GLOBALS['BASE_URL'] . 'status');
        curl_setopt_array($ch, [
            CURLOPT_POST => 1,
            CURLOPT_POSTFIELDS => http_build_query(['api_id' => (int)($GLOBALS['API_ID'] ?? 0), 'api_key' => $GLOBALS['API_KEY'], 'order' => $num]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $body = curl_exec($ch);
        curl_close($ch);
        $j = json_decode((string)$body, true);
        if (!is_array($j)) return null;
        return $j['status'] ?? $j['order_status'] ?? null;
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
