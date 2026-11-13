// Firebase Cloud Messaging (notifikasi push).
//
// PENTING: inisialisasi messaging DITUNDA (lazy) dan dijaga dengan isSupported().
// Sebelumnya getMessaging()/onMessage() dipanggil di top-level modul, sehingga di
// browser yang tidak mendukung FCM (mis. iOS Safari lama, sebagian in-app webview,
// atau mode penyamaran) import modul ini melempar error dan MEMBUAT SELURUH APP
// GAGAL DIMUAT (layar putih) — termasuk halaman login. Dengan lazi-init, app tetap
// jalan normal dan notifikasi hanya diaktifkan saat benar-benar didukung & diminta user.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { MAIN_API } from './lib/apiBase';

const firebaseConfig = {
  apiKey: 'AIzaSyCOtYdDIPwwOObdVaxs1wRijJOswk0UExQ',
  authDomain: 'boosteryuk.firebaseapp.com',
  projectId: 'boosteryuk',
  storageBucket: 'boosteryuk.firebasestorage.app',
  messagingSenderId: '201460734565',
  appId: '1:201460734565:web:30e6d635e60be82dc8448c',
};

// VAPID public key (aman diekspos di client).
const VAPID_KEY = 'BJGVzDVRs_0o-japL9BEfNPImnElWo5HBPgYcGsxoZgyGZL5n5VMzlqaIANPWhS3bBi0Nl3YKAKy7z27RXJBaYg';

let app: FirebaseApp | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

/** Ambil instance Messaging bila didukung browser; null bila tidak. Hasilnya di-cache. */
async function getSupportedMessaging(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      try {
        if (!(await isSupported())) return null;
        app ??= initializeApp(firebaseConfig);
        const messaging = getMessaging(app);
        // Tampilkan notifikasi foreground lewat Service Worker (bukan new Notification()).
        onMessage(messaging, async (payload) => {
          try {
            const title = payload.notification?.title || 'Boosteryuk';
            const body = payload.notification?.body || '';
            if ('serviceWorker' in navigator) {
              const reg = await navigator.serviceWorker.ready;
              reg.showNotification(title, { body, icon: '/favicon.png', badge: '/favicon.png' });
            }
          } catch {
            /* abaikan: notifikasi foreground tidak kritis */
          }
        });
        return messaging;
      } catch (err) {
        console.warn('FCM tidak tersedia di browser ini:', err);
        return null;
      }
    })();
  }
  return messagingPromise;
}

/**
 * Minta izin notifikasi, daftarkan Service Worker, ambil token, lalu simpan ke server.
 * Mengembalikan token (string) bila sukses, atau null bila gagal/ditolak/tak didukung.
 */
export const mintaIzinNotif = async (): Promise<string | null> => {
  try {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      alert('Browser ini tidak mendukung notifikasi.');
      return null;
    }

    const messaging = await getSupportedMessaging();
    if (!messaging) {
      alert('Notifikasi tidak didukung di browser ini.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (permission === 'denied') {
        alert('Notifikasi diblokir. Klik gembok di address bar > Setelan situs > Izinkan notifikasi');
      }
      return null;
    }

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return null;

    // Simpan token ke backend (endpoint auth/user tidak diubah).
    await fetch(`${MAIN_API}/save.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {
      /* jaringan gagal — token tetap valid, cukup diabaikan agar UI tidak error */
    });

    return token;
  } catch (err) {
    console.error('ERROR FCM:', err);
    return null;
  }
};
