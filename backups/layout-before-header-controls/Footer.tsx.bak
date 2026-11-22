import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, FlaskConical, LogOut, Settings, Shield } from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePanelOwner } from '../services/panelApi';
import { IS_CHILD_PANEL } from '../lib/apiBase';
import { getAdminMenuItems, getUserMenuItems, ROUTE_PATH } from './SideMenu';
import './Footer.css';

// Preserve every previous footer link at the bottom, with its existing label.
const LINKS = [
  { to: '/layanan', label: 'Layanan' },
  { to: '/cek-status', label: 'Cek Status' },
  { to: '/artikel', label: 'Artikel' },
  { to: '/about', label: 'Tentang' },
  { to: '/terms', label: 'Syarat' },
  { to: '/privacy', label: 'Privasi' },
];

const SOCIALS = [
  { label: 'Instagram', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg> },
  { label: 'TikTok', icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 3h3c.2 2.1 1.4 3.7 4 4v3a9 9 0 0 1-4-1.3V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3Z" /></svg> },
  { label: 'YouTube', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" /></svg> },
  { label: 'X', icon: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L2.8 2h6.5l4.4 6.7L18.9 2ZM17.7 20h1.7L8.2 4H6.4l11.3 16Z" /></svg> },
];

/** Global footer: navigation follows exactly the hamburger's visibility rules. */
export default function Footer() {
  const { settings } = useSiteSettings();
  const { user, isAdmin, logout } = useAuth();
  const isPanelOwner = usePanelOwner(user?.token) === true && IS_CHILD_PANEL;
  const navigate = useNavigate();
  const items = isAdmin
    ? getAdminMenuItems(IS_CHILD_PANEL).map(item => ({ ...item, to: item.path }))
    : getUserMenuItems(user !== null, isAdmin, IS_CHILD_PANEL).map(item => ({ ...item, to: ROUTE_PATH[item.id] }));
  const rowContent = (label: string, Icon: typeof Settings) => <>
    <span className="site-footer-menu-icon"><Icon aria-hidden="true" strokeWidth={1.8} /></span>
    <span className="site-footer-menu-label">{label}</span>
    <ChevronRight className="site-footer-chevron" aria-hidden="true" />
  </>;

  return (
    <footer className="site-footer">
      <svg className="site-footer-wave" viewBox="0 0 720 60" preserveAspectRatio="none" width="100%" aria-hidden="true" focusable="false">
        <path d="M0,35 C100,70 220,0 320,0 C450,0 600,90 720,25 L720,60 L0,60 Z" />
      </svg>
      <div className="site-footer-body">
        <div className="site-footer-container">
          <div className="site-footer-grid">
            <div className="site-footer-brand">
              <div className="site-footer-identity">
                <span className="site-footer-logo"><img src={settings.logoUrl} alt="" /></span>
                <p className="site-footer-name font-display"><span>{settings.brandName}</span><span>{settings.brandSuffix}</span></p>
              </div>
              <p className="site-footer-description">Platform booster media sosial terpercaya — followers, likes, views, dan engagement untuk semua platform favorit Anda.</p>
              <div className="site-footer-socials" aria-label="Media sosial">
                {SOCIALS.map(social => <a key={social.label} href="#" aria-label={social.label}>{social.icon}</a>)}
              </div>
            </div>
            <nav aria-label="Navigasi footer" className="site-footer-nav">
              <h2>NAVIGASI</h2>
              <ul>
                {!IS_CHILD_PANEL && <li><Link to="/playground" className="site-footer-row">{rowContent('Playground', FlaskConical)}</Link></li>}
                {!isAdmin && isPanelOwner && <li><Link to="/panel-admin" className="site-footer-row">{rowContent('Admin Panel Toko', Shield)}</Link></li>}
                {items.map(item => <li key={item.id}><Link to={item.to} className="site-footer-row">{rowContent(item.label, item.icon)}</Link></li>)}
                {user && <>
                  <li><Link to="/profil" className="site-footer-row">{rowContent('Profil & Pengaturan', Settings)}</Link></li>
                  <li><button type="button" className="site-footer-row" onClick={() => { logout();navigate('/'); }}>{rowContent('Keluar', LogOut)}</button></li>
                </>}
              </ul>
            </nav>
          </div>
          <div className="site-footer-bottom">
            <nav aria-label="Tautan footer">{LINKS.map(link => <Link key={link.to} to={link.to}>{link.label}</Link>)}</nav>
            <p>{settings.footerText}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
