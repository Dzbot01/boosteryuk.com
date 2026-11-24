import { useState } from 'react';
import { Users, Heart, Eye, MessageCircle, Share2, Star, Music, Video, Globe, Gamepad2, Zap, Tag } from 'lucide-react';
import { brandIconUrl } from '../constants';
import { server2Brand, serviceGlyph } from '../lib/server2Presentation';
const GLYPHS = {users: Users, heart: Heart, eye: Eye, message: MessageCircle, share: Share2, star: Star, music: Music, video: Video, globe: Globe, game: Gamepad2, zap: Zap, tag: Tag};
/** CDN marks have a local semantic icon fallback, never an empty badge. */
export default function Server2ServiceBadge({ name }: { name: string }) {
  const brand = server2Brand(name);
  const src = brand ? brandIconUrl(brand) : '';
  const [failedSrc, setFailedSrc] = useState('');
  const Icon = GLYPHS[serviceGlyph(name)];
  const full = Boolean(brand?.fullColor);
  return <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden ${full ? '' : 'rounded-full ring-1 ring-black/5'}`} style={full ? undefined : {background: brand ? `#${brand.color}` : '#0284c7'}}>
    {src && failedSrc !== src ? <img src={src} alt="" loading="lazy" className={full ? 'h-4 w-4 object-contain' : 'h-3 w-3 object-contain'} onError={() => setFailedSrc(src)} /> : <Icon className="h-3 w-3 text-white" strokeWidth={2.2} />}
  </span>;
}
