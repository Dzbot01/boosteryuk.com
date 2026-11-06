// Service Worker Firebase Cloud Messaging (notifikasi background).
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCOtYdDIPwwOObdVaxs1wRijJOswk0UExQ',
  authDomain: 'boosteryuk.firebaseapp.com',
  projectId: 'boosteryuk',
  storageBucket: 'boosteryuk.firebasestorage.app',
  messagingSenderId: '201460734565',
  appId: '1:201460734565:web:30e6d635e60be82dc8448c',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // GUARD: pesan data-only tidak punya payload.notification -> ambil fallback agar SW tidak error.
  const n = (payload && payload.notification) || (payload && payload.data) || {};
  const title = n.title || 'Boosteryuk';
  self.registration.showNotification(title, {
    body: n.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
  });
});
