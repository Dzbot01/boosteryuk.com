import { useEffect, useState } from 'react';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';
/** loop=false intentionally keeps the failed-streak animation on its last frame. */
export default function RewardAnimation({ src, loop = true, label }: { src: string; loop?: boolean; label: string }) {
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const fail = () => setFailed(true);
    player?.addEventListener('loadError', fail);
    player?.addEventListener('renderError', fail);
    return () => { player?.removeEventListener('loadError', fail);player?.removeEventListener('renderError', fail); };
  }, [player]);
  return <div role="img" aria-label={label} className="h-full w-full">{failed ? <p className="p-4 text-center text-sm text-slate-500">{label}</p> : <DotLottieReact src={src} autoplay loop={loop} dotLottieRefCallback={setPlayer} layout={{ fit: 'contain', align: [0.5, 0.5] }} style={{ width: '100%', height: '100%' }} />}</div>;
}
