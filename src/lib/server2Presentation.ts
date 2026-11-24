import { CATEGORY_BRAND_ICONS, findBrandIcon, type BrandIcon } from '../constants';

/** Decode provider text only; never inject it as HTML. Handles double-encoded apostrophes. */
export function server2Label(value: string): string {
  let text = value;
  const named: Record<string, string> = {amp: '&', apos: "'", quot: '"', nbsp: ' ', rsquo: '’', lsquo: '‘', grave: '`'};
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/&(#x[\da-f]+|#\d+|amp|apos|quot|nbsp|rsquo|lsquo|grave);/gi, (entity, code: string) => {
      if (!code.startsWith('#')) return named[code.toLowerCase()] ?? entity;
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : entity;
    });
  }
  return text.replace(/\bnaizop(?:\s*['’‘`´]\s*s|s)?\b/gi, 'Boosteryuk').trim();
}
const EXTRA_BRANDS: BrandIcon[] = [
  {slug:'x',color:'111111',keywords:['x','x.com','twitter']},
  {slug:'reddit',color:'FF4500',keywords:['reddit']},
  {slug:'soundcloud',color:'FF5500',keywords:['soundcloud','sound cloud']},
  {slug:'kick',color:'15803D',keywords:['kick']},
  {slug:'rumble',color:'65A30D',keywords:['rumble']},
  {slug:'quora',color:'B92B1C',keywords:['quora']},
  {slug:'vimeo',color:'1AB7EA',keywords:['vimeo']},
  {slug:'dailymotion',color:'0066DC',keywords:['dailymotion','daily motion']},
  {slug:'deezer',color:'A238FF',keywords:['deezer']},
  {slug:'applemusic',color:'FA243C',keywords:['apple music']},
  {slug:'audiomack',color:'B86D00',keywords:['audiomack']},
  {slug:'mixcloud',color:'5000FF',keywords:['mixcloud']},
  {slug:'medium',color:'111111',keywords:['medium']},
  {slug:'tumblr',color:'36465D',keywords:['tumblr']},
  {slug:'steam',color:'1B2838',keywords:['steam']},
  {slug:'trustpilot',color:'008060',keywords:['trustpilot','trust pilot']},
  {slug:'tripadvisor',color:'15803D',keywords:['tripadvisor','trip advisor']},
  {slug:'imdb',color:'A16207',keywords:['imdb']},
  {slug:'vk',color:'0077FF',keywords:['vk','vkontakte']},
  {slug:'tiktok',color:'010101',keywords:['tik-tok']},
];
export type ServiceGlyph = 'users' | 'heart' | 'eye' | 'message' | 'share' | 'star' | 'music' | 'video' | 'globe' | 'game' | 'zap' | 'tag';
export function serviceGlyph(name: string): ServiceGlyph {
  const text = name.toLowerCase();
  if (/review|rating| ulasan|bintang/.test(text)) return 'star';
  if (/comment|reply|komentar|replies/.test(text)) return 'message';
  if (/follower|subscriber|member|pengikut|friend/.test(text)) return 'users';
  if (/like|reaction|favorite|favourite|suka/.test(text)) return 'heart';
  if (/view|impression|reach|watch|penonton/.test(text)) return 'eye';
  if (/share|repost|retweet/.test(text)) return 'share';
  if (/music|stream|song|listen|play|audio/.test(text)) return 'music';
  if (/video|reel|short|live/.test(text)) return 'video';
  if (/traffic|website|seo|visit|search/.test(text)) return 'globe';
  if (/game|gaming|robux/.test(text)) return 'game';
  if (/boost|speed|instant/.test(text)) return 'zap';
  return 'tag';
}
/** Word-boundary matching prevents IG in "high" and LINE in "online" matching brands. */
export function server2Brand(name: string): BrandIcon | null {
  return findBrandIcon(name, [...EXTRA_BRANDS, ...CATEGORY_BRAND_ICONS]);
}
