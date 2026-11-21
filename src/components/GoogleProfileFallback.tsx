import { useState } from 'react';

/** Google account photo when supplied by the API; otherwise its neutral default silhouette. */
export default function GoogleProfileFallback({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = src && /^https:\/\//i.test(src) ? src : null;
  if (photo && !failed) return <img src={photo} alt="Foto profil Google" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full rounded-full object-cover" />;
  return <svg role="img" aria-label="Foto profil Google default" viewBox="0 0 96 96" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
    <circle cx="48" cy="48" r="48" fill="#dadce0" />
    <circle cx="48" cy="35" r="17" fill="#fff" />
    <path d="M16 80c2-17 14-26 32-26s30 9 32 26A45 45 0 0 1 16 80Z" fill="#fff" />
  </svg>;
}
