<?php
/** Trial is an expiring entitlement, NEVER a permanent users.plus_active flag. */
function pt_trial_until($conn,$uid) {
    try {
        $st=$conn->prepare('SELECT expires_at FROM user_plus_trials WHERE user_id=? AND expires_at>UTC_TIMESTAMP()');
        if(!$st)return null;
        $st->bind_param('i',$uid);if(!$st->execute())return null;
        $row=$st->get_result()->fetch_assoc();$st->close();
        return $row ? str_replace(' ','T',$row['expires_at']).'Z' : null;
    }catch(Throwable $e){return null;} // deployment before migration: no trial, never free permanent Plus
}
