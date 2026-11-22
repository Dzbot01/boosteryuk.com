export type Marker = Record<string, number>;
export type AdminMarkers = Record<string, Marker>;
export const seenKey = (adminId: string) => `by-admin-seen-v1:${adminId}`;
export function cleanMarkers(value: unknown): AdminMarkers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: AdminMarkers = {};
  for (const [path, marker] of Object.entries(value)) {
    if (!path.startsWith('/') || !marker || typeof marker !== 'object' || Array.isArray(marker)) continue;
    const entry: Marker = {};
    for (const [key, n] of Object.entries(marker)) if (typeof n === 'number' && Number.isFinite(n) && n >= 0) entry[key] = n;
    out[path] = entry;
  }
  return out;
}
export function hasNewData(marker: Marker = {}, seen: Marker = {}) {
  return Object.entries(marker).some(([key, n]) => n > (seen[key] || 0));
}
export function mergeSeen(seen: AdminMarkers, path: string, marker: Marker): AdminMarkers {
  const next = { ...seen[path] };
  for (const [key, n] of Object.entries(marker)) next[key] = Math.max(next[key] || 0, n);
  return { ...seen, [path]: next };
}
export function loadSeen(adminId: string): AdminMarkers {
  try { return cleanMarkers(JSON.parse(localStorage.getItem(seenKey(adminId)) || '{}')); } catch { return {}; }
}
export function saveSeen(adminId: string, seen: AdminMarkers): AdminMarkers {
  let merged = loadSeen(adminId);
  for (const [path, marker] of Object.entries(seen)) merged = mergeSeen(merged, path, marker);
  try { localStorage.setItem(seenKey(adminId), JSON.stringify(merged)); } catch { /* memory-only in restricted browsers */ }
  return merged;
}
