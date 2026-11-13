<?php
/**
 * agent_lifecycle.php — sinkron status order Sewa Agen AI dengan VPS + refund otomatis.
 *
 * VPS (server.js) menghentikan bot bila nomor belum tertaut dalam 10 menit dan melaporkan
 * status 'expired'. PHP lalu MENGEMBALIKAN SALDO di database (bukan hanya di UI):
 *   riwayat_pesanan.status: pending/proses → batal   (atomik, sekali saja per order)
 *   users.balance += harga order
 *   child_panel_orders (bila ada) dihapus agar tidak dihitung sebagai pendapatan panel.
 * Status 'linked' → riwayat 'selesai'.
 *
 * Dipicu oleh: agent.php?action=status (halaman pairing), my_agents.php & order_stats.php
 * (saat user membuka Agen AI Saya / Overview — untuk user yang sudah menutup halaman pairing).
 * Tidak ada refund untuk status lain/404 (mis. agen lama yang belum tercatat di VPS baru).
 */

/** GET status sesi agen dari VPS. @return array|null */
function agent_vps_status($orderId) {
    $token = getenv('AGENT_TOKEN') ?: '';
    $origin = getenv('AGENT_ORIGIN') ?: '';
    if ((!$token || !$origin) && is_file(__DIR__ . '/agent_config.php')) {
        $cfg = include __DIR__ . '/agent_config.php';
        if (is_array($cfg)) {
            if (!$token && !empty($cfg['token'])) $token = $cfg['token'];
            if (!$origin && !empty($cfg['origin'])) $origin = $cfg['origin'];
        }
    }
    if (!$token) return null;
    $origin = rtrim($origin ?: 'https://wa-origin.boosteryuk.com', '/');
    $ch = curl_init($origin . '/session/' . rawurlencode($orderId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HTTPHEADER => ['x-agent-token: ' . $token, 'Accept: application/json'],
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    $j = $body ? json_decode($body, true) : null;
    return is_array($j) ? $j : null;
}

/**
 * Refund order agen yang waktu tautnya habis. Atomik: hanya order berstatus pending/proses
 * yang diubah ke 'batal', dan saldo hanya ditambah bila perubahan itu terjadi.
 * @return array ['refunded'=>bool, 'amount'=>float]
 */
function agent_refund_expired($conn, $orderId, $uid) {
    $conn->begin_transaction();
    try {
        $st = $conn->prepare("SELECT price FROM riwayat_pesanan WHERE order_id = ? AND user_id = ? AND status IN ('pending','proses') LIMIT 1 FOR UPDATE");
        $st->bind_param('si', $orderId, $uid);
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        if (!$row) { $conn->rollback(); return ['refunded' => false, 'amount' => 0]; }
        $amount = (float)$row['price'];

        $st = $conn->prepare("UPDATE riwayat_pesanan SET status = 'batal' WHERE order_id = ? AND user_id = ? AND status IN ('pending','proses')");
        $st->bind_param('si', $orderId, $uid);
        $st->execute();
        $changed = $st->affected_rows;
        $st->close();
        if ($changed < 1) { $conn->rollback(); return ['refunded' => false, 'amount' => 0]; }

        $st = $conn->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
        $st->bind_param('di', $amount, $uid);
        $st->execute();
        $st->close();

        // Pendapatan child panel untuk order ini dibatalkan (tabel opsional).
        try {
            $st = $conn->prepare("DELETE FROM child_panel_orders WHERE order_id = ? AND kind = 'agent'");
            if ($st) { $st->bind_param('s', $orderId); $st->execute(); $st->close(); }
        } catch (Throwable $e) { /* tabel belum ada */ }

        $conn->commit();
        return ['refunded' => true, 'amount' => $amount];
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $e2) { /* abaikan */ }
        return ['refunded' => false, 'amount' => 0, 'error' => $e->getMessage()];
    }
}

/**
 * WhatsApp tertaut → riwayat 'selesai' (sekali saja), lalu BARU catat pendapatan child panel
 * bila order dibuat lewat subdomain panel (detail.child_panel_id).
 */
function agent_mark_linked($conn, $orderId, $uid) {
    $st = $conn->prepare("SELECT service_name, quantity, price, detail FROM riwayat_pesanan WHERE order_id = ? AND user_id = ? AND status IN ('pending','proses') LIMIT 1");
    $st->bind_param('si', $orderId, $uid);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$row) return false;
    $st = $conn->prepare("UPDATE riwayat_pesanan SET status = 'selesai' WHERE order_id = ? AND user_id = ? AND status IN ('pending','proses')");
    $st->bind_param('si', $orderId, $uid);
    $st->execute();
    $changed = $st->affected_rows;
    $st->close();
    if ($changed < 1) return false;
    $d = json_decode((string)($row['detail'] ?? ''), true) ?: [];
    if (!empty($d['child_panel_id'])) {
        try {
            require_once __DIR__ . '/child_panel_lib.php';
            cp_ensure_schema($conn);
            $base = isset($d['harga_dasar']) ? (float)$d['harga_dasar'] : (float)$row['price'];
            cp_record_order($conn, (int)$d['child_panel_id'], (int)$uid, $orderId, 'agent', $row['service_name'], $row['quantity'], $row['price'], $base);
        } catch (Throwable $e) { /* pencatatan pendapatan gagal tidak membatalkan status */ }
    }
    return true;
}

/**
 * Sinkron satu order dengan status VPS. $vps boleh diisi bila sudah diambil (hemat 1 request).
 * @return array ['status'=>?string, 'refunded'=>bool, 'amount'=>float]
 */
function agent_sync_order($conn, $orderId, $uid, $vps = null) {
    $vps = $vps ?: agent_vps_status($orderId);
    $status = is_array($vps) && !empty($vps['ok']) ? ($vps['status'] ?? null) : null;
    if ($status === 'linked') agent_mark_linked($conn, $orderId, $uid);
    if ($status === 'expired') return ['status' => $status] + agent_refund_expired($conn, $orderId, $uid);
    return ['status' => $status, 'refunded' => false, 'amount' => 0];
}

/** Cek order agen user yang masih menunggu tautan (maks 5 terbaru, 3 hari terakhir). */
function agent_sync_user($conn, $uid) {
    $st = $conn->prepare("SELECT order_id FROM riwayat_pesanan
                          WHERE user_id = ? AND status IN ('pending','proses') AND order_id LIKE 'AI%'
                            AND created_at >= NOW() - INTERVAL 3 DAY
                          ORDER BY id DESC LIMIT 5");
    $st->bind_param('i', $uid);
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    $out = [];
    foreach ($rows as $r) $out[$r['order_id']] = agent_sync_order($conn, $r['order_id'], (int)$uid);
    return $out;
}
