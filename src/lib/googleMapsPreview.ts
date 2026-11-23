const GOOGLE_MAP_HOST = /^(?:(?:www|maps)\.)?google\.(?:com|co\.id|co\.uk|com\.au|co\.jp|co\.in|com\.sg|com\.my|ca|de|fr)$/i;
export function googleMapsKind(url: URL): 'short' | 'map' | null {
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' && url.pathname.length > 1) return 'short';
  if (host === 'goo.gl' && url.pathname.startsWith('/maps/')) return 'short';
  if (GOOGLE_MAP_HOST.test(host) && (host.startsWith('maps.') || /^\/maps(?:\/|$)/.test(url.pathname))) return 'map';
  return null;
}
export interface MapPreview { title: string; embedUrl: string | null }
/** Derive a public embed from location data, never put arbitrary target URLs in an iframe. */
export function googleMapsPreview(url: URL): MapPreview {
  if (googleMapsKind(url) !== 'map') return {title: 'Lokasi Google Maps', embedUrl: null};
  if (url.pathname === '/maps/embed' && url.searchParams.get('pb')) {
    const embed = new URL('https://www.google.com/maps/embed');embed.searchParams.set('pb', url.searchParams.get('pb')!);
    return {title: 'Lokasi Google Maps', embedUrl: embed.href};
  }
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { /* malformed encoding: keep original */ }
  const place = path.match(/\/place\/([^/]+)/)?.[1]?.replace(/\+/g, ' ');
  const precise = path.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const center = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const coords = precise || center;
  const validCoords = coords && Math.abs(Number(coords[1])) <= 90 && Math.abs(Number(coords[2])) <= 180;
  const query = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('destination') || (validCoords ? `${coords[1]},${coords[2]}` : '') || place || url.searchParams.get('ll');
  const cid = url.searchParams.get('cid');
  const embed = new URL('https://www.google.com/maps');
  embed.searchParams.set('output', 'embed');
  if (cid && /^\d+$/.test(cid)) embed.searchParams.set('cid', cid);
  else if (query && query.length <= 1000) embed.searchParams.set('q', query);
  else return {title: place || 'Lokasi Google Maps', embedUrl: null};
  return {title: place || query || 'Lokasi Google Maps', embedUrl: embed.href};
}
