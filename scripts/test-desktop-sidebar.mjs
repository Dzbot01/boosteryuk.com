import assert from 'node:assert/strict';
import fs from 'node:fs';
const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
const menu = fs.readFileSync('src/components/SideMenu.tsx', 'utf8');
// Desktop must always reserve the same 64px rail, including guest dashboard.
assert.match(layout, /lg:pl-16/);
assert.doesNotMatch(layout, /railVisible|lg:pl-0/);
// No route/auth-based visibility gate: mobile remains an independent overlay.
assert.doesNotMatch(menu, /stripVisible|railVisible|onDashboard/);
const desktop = menu.split('{/* ===== DESKTOP:')[1].split('{/* ===== MOBILE/TABLET:')[0];
assert.match(desktop, /hidden.*lg:flex/s);
assert.match(desktop, /translate-x-0 visible/);
assert.match(desktop, /onMouseEnter=\{openOnHover\}/);
assert.match(desktop, /isOpen \? 'w-\[272px\].* : 'w-16'/);
assert.doesNotMatch(desktop, /aria-hidden|invisible|pointer-events-none/);
assert.match(menu, /getUserMenuItems\(user !== null, isAdmin, IS_CHILD_PANEL\)/);
assert.match(menu, /AUTH_REQUIRED.includes\(item.id\) \|\| signedIn/);
assert.match(menu.split('{/* ===== MOBILE/TABLET:')[1], /lg:hidden/);
console.log('PASS desktop sidebar: guest dashboard rail visible, 64px space, hover expansion and auth filtering preserved, mobile overlay unchanged.');
