<?php
/**
 * Salin menjadi callback_config.php DI SERVER (jangan di-commit), isi secret yang SAMA dengan header
 * X-Callback-Secret yang dikirim Worker (api.boosteryuk.com) ke callback.php.
 * Disarankan mengganti secret lama karena pernah tertulis di file/chat: ubah di Worker DAN di sini.
 */
return ['secret' => 'ISI_SECRET_CALLBACK'];
