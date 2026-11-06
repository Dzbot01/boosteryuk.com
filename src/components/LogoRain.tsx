import { useEffect, useState } from 'react';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface Particle {
  id: number;
  left: number; // 0 to 100%
  size: number; // 24px to 64px
  duration: number; // 3s to 6s
  delay: number; // 0s to 2s
  swayDuration: number; // 2s to 4s
  rotation: number; // -30 to 30 deg
}

export default function LogoRain({
  durationMs = 6000,
  onComplete,
}: {
  durationMs?: number;
  onComplete?: () => void;
}) {
  const { settings } = useSiteSettings();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate 35 particles with random positions, sizes, durations, and delays
    const items: Particle[] = Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      left: Math.random() * 92 + 2, // 2% to 94%
      size: Math.floor(Math.random() * 36) + 28, // 28px to 64px
      duration: Math.random() * 2.5 + 3.5, // 3.5s to 6s
      delay: Math.random() * 1.8, // 0s to 1.8s
      swayDuration: Math.random() * 1.5 + 2, // 2s to 3.5s
      rotation: (Math.random() - 0.5) * 60, // -30deg to 30deg
    }));

    setParticles(items);

    const timer = setTimeout(() => {
      onComplete?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute -top-20"
          style={{
            left: `${p.left}%`,
            animation: `fall ${p.duration}s linear ${p.delay}s forwards`,
          }}
        >
          <div
            style={{
              animation: `wind-sway ${p.swayDuration}s ease-in-out infinite alternate`,
              transform: `rotate(${p.rotation}deg)`,
            }}
          >
            <img
              src={settings.logoUrl}
              alt=""
              className="object-contain drop-shadow-[0_8px_16px_rgba(6,182,212,0.4)]"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
              }}
            />
          </div>
        </div>
      ))}

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          10% {
            opacity: 0.95;
          }
          85% {
            opacity: 0.95;
          }
          100% {
            transform: translateY(105vh);
            opacity: 0;
          }
        }

        @keyframes wind-sway {
          0% {
            transform: translateX(-18px) rotate(-12deg);
          }
          100% {
            transform: translateX(18px) rotate(12deg);
          }
        }
      `}</style>
    </div>
  );
}
