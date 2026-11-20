// Proof stays in the initiating tab; a stolen URL token alone cannot create a session.
export const GOOGLE_CENTER = 'https://boosteryuk.com';
export const GOOGLE_PROOF_KEY = 'by_google_login_proof';
export async function startGoogleLogin() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  sessionStorage.setItem(GOOGLE_PROOF_KEY, verifier);
  window.location.assign(`${GOOGLE_CENTER}/auth/google?${new URLSearchParams({ return: window.location.hostname, challenge })}`);
}

// Share a single exchange across React StrictMode's effect replay. Never persist the grant URL.
let pending: Promise<void> | null = null;
export function finishGoogleLogin(): Promise<void> {
  if (pending) return pending;
  const query = new URLSearchParams(window.location.search);
  const grant = query.get('token');
  const verifier = sessionStorage.getItem(GOOGLE_PROOF_KEY);
  window.history.replaceState(null, '', '/auth/finish');
  pending = (async () => {
    if (query.has('error')) throw new Error('Login Google dibatalkan. Silakan coba lagi.');
    if (!grant || !/^[a-f0-9]{64}$/.test(grant) || !verifier) throw new Error('Login tidak valid atau tab asal sudah ditutup. Mulai login ulang.');
    const response = await fetch(`${GOOGLE_CENTER}/api/google_auth.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, referrerPolicy: 'no-referrer', cache: 'no-store',
      body: JSON.stringify({ action: 'exchange', token: grant, verifier }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok || typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error(data.message || 'Token telah digunakan atau kedaluwarsa. Mulai login ulang.');
    localStorage.setItem('token', data.token);
    sessionStorage.removeItem(GOOGLE_PROOF_KEY);
  })();
  return pending;
}
