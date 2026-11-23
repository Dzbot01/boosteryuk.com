/** Dedicated root branding; legacy assets remain untouched for child panels. */
export const ROOT_LOGO = '/branding/root-logo-zigzag.png';
export const ROOT_FAVICON = '/branding/root-favicon-zigzag.png';
export const ROOT_APPLE_ICON = '/branding/root-apple-zigzag.png';
export function applyRootBranding<T extends { logoUrl: string; faviconUrl: string }>(settings: T, child: boolean): T {
  return child ? settings : { ...settings, logoUrl: ROOT_LOGO, faviconUrl: ROOT_FAVICON };
}
