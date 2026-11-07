import Logo from './Logo';
import { ShieldCheckIcon, HelpCircleIcon, MailIcon, BookOpenIcon, InfoIcon, ShieldIcon, BarChartIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';

const ROUTE_MAP = {
  home: '/dashboard',
  scan: '/scan',
  history: '/history',
  stats: '/stats',
  faq: '/faq',
  guide: '/guide',
  contact: '/contact',
  about: '/about',
  notifications: '/notifications',
  alerts: '/settings/alerts',
};

export default function Footer({ activeTab, setActiveTab }) {
  const { t, dir } = useLanguage();
  const { isGuest } = useAuth();
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  const routeFor = (id) => (id === 'home' && isGuest ? '/welcome' : ROUTE_MAP[id] || '/scan');
  const isCurrentPath = (path) => location.pathname === path;
  const handleNavigate = (id) => {
    if (typeof setActiveTab === 'function') setActiveTab(id);
  };

  const supportLinks = [
    { id: 'faq', label: t('nav.faq'), icon: HelpCircleIcon },
    { id: 'guide', label: t('nav.guide'), icon: BookOpenIcon },
    { id: 'contact', label: t('nav.contact'), icon: MailIcon },
    { id: 'about', label: t('nav.about'), icon: InfoIcon },
  ];

  const legalLinks = [
    { id: 'terms', label: dir === 'rtl' ? 'شروط الاستخدام' : 'Terms of use', path: '/terms' },
    { id: 'privacy', label: dir === 'rtl' ? 'سياسة الخصوصية' : 'Privacy policy', path: '/privacy' },
    { id: 'disclaimer', label: dir === 'rtl' ? 'إخلاء المسؤولية' : 'Disclaimer', path: '/disclaimer' },
    ...(!isGuest ? [{ id: 'data', label: dir === 'rtl' ? 'إدارة بياناتي' : 'My data controls', path: '/settings/privacy' }] : []),
  ];

  const quickLinks = isGuest
    ? [
        { id: 'scan', label: t('nav.scan'), icon: ShieldIcon },
        { id: 'about', label: t('nav.about'), icon: InfoIcon },
        { id: 'guide', label: t('nav.guide'), icon: BookOpenIcon },
        { id: 'faq', label: t('nav.faq'), icon: HelpCircleIcon },
      ]
    : [
        { id: 'home', label: t('nav.home'), icon: ShieldIcon },
        { id: 'scan', label: t('nav.scan'), icon: ShieldIcon },
        { id: 'history', label: t('nav.history'), icon: BarChartIcon },
        { id: 'stats', label: t('nav.stats'), icon: InfoIcon },
      ];

  return (
    <footer className="app-footer" role="contentinfo" dir={dir}>
      <div className="footer-container">
        <div className="footer-brand-section">
          <Link
            to={routeFor('home')}
            className="footer-logo-btn"
            onClick={() => handleNavigate('home')}
            aria-label={t('nav.goHome')}
          >
            <Logo size="sm" showTagline={false} />
          </Link>
          <p className="footer-tagline">{t('footer.tagline')}</p>
        </div>

        <nav className="footer-links-column" aria-label={t('footer.supportSection')}>
          <h3 className="footer-column-title">{t('footer.supportSection')}</h3>
          <ul className="footer-links-list">
            {supportLinks.map((item) => {
              const Icon = item.icon;
              const targetPath = routeFor(item.id);
              const current = isCurrentPath(targetPath);
              const active = activeTab === item.id || current;
              return (
                <li key={item.id}>
                  <Link
                    to={targetPath}
                    className={`footer-link-btn ${active ? 'active' : ''}`}
                    onClick={() => handleNavigate(item.id)}
                    aria-current={current ? 'page' : undefined}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav className="footer-links-column" aria-label={t('footer.quickLinksSection')}>
          <h3 className="footer-column-title">{t('footer.quickLinksSection')}</h3>
          <ul className="footer-links-list">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              const targetPath = routeFor(item.id);
              const current = isCurrentPath(targetPath);
              const active = activeTab === item.id || current;
              return (
                <li key={item.id}>
                  <Link
                    to={targetPath}
                    className={`footer-link-btn ${active ? 'active' : ''}`}
                    onClick={() => handleNavigate(item.id)}
                    aria-current={current ? 'page' : undefined}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav className="footer-links-column" aria-label={dir === 'rtl' ? 'الحقوق والبيانات' : 'Legal and data'}>
          <h3 className="footer-column-title">{dir === 'rtl' ? 'الحقوق والبيانات' : 'Legal & data'}</h3>
          <ul className="footer-links-list">
            {legalLinks.map((item) => {
              const current = isCurrentPath(item.path);
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className={`footer-link-btn ${current ? 'active' : ''}`}
                    aria-current={current ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <aside className="footer-notice-card" aria-label={t('footer.securityTitle')}>
          <div className="notice-card-header">
            <ShieldCheckIcon size={18} color="var(--color-secondary)" aria-hidden="true" />
            <span className="notice-card-title">{t('footer.securityTitle')}</span>
          </div>
          <p className="footer-notice-text">{t('footer.securityNotice')}</p>
        </aside>
      </div>

      <div className="footer-bottom-bar">
        <p className="footer-copyright">{t('footer.rights', { year: currentYear })}</p>
      </div>

      <style>{`
        .app-footer {
          background: var(--color-bg);
          border-top: 1px solid var(--color-border);
          margin-top: var(--space-8, 48px);
          padding: 48px 24px 28px;
          color: var(--color-text-secondary);
          font-size: 14px;
          transition: background var(--transition-base, 0.2s ease), border-color var(--transition-base, 0.2s ease);
        }

        .footer-container {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) repeat(3, minmax(0, 1fr)) minmax(0, 1.25fr);
          align-items: start;
          gap: clamp(16px, 2.4vw, 30px);
        }

        .footer-brand-section,
        .footer-links-column,
        .footer-notice-card {
          min-width: 0;
        }

        .footer-brand-section {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 14px;
        }

        [dir="rtl"] .footer-brand-section {
          align-items: flex-start;
        }

        .footer-logo-btn {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 0;
          border: 0;
          background: none;
          color: inherit;
          text-decoration: none;
          cursor: pointer;
        }

        .footer-tagline {
          max-width: 280px;
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .footer-links-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-column-title {
          margin: 0;
          color: var(--color-text);
          font-size: 15px;
          font-weight: 700;
          line-height: 1.5;
        }

        .footer-links-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .footer-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 34px;
          max-width: 100%;
          padding: 2px 0;
          border: 0;
          background: none;
          color: var(--color-text-secondary);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.5;
          text-align: start;
          text-decoration: none;
          overflow-wrap: anywhere;
          cursor: pointer;
          transition: color var(--transition-fast, 0.2s ease), transform var(--transition-fast, 0.2s ease);
        }

        .footer-link-btn:hover,
        .footer-link-btn.active {
          color: var(--color-secondary);
        }

        .footer-link-btn:focus-visible,
        .footer-logo-btn:focus-visible {
          border-radius: 6px;
          outline: 3px solid var(--color-secondary);
          outline-offset: 4px;
        }

        .footer-notice-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 18px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          background: var(--color-bg-subtle);
        }

        .notice-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .notice-card-title {
          color: var(--color-text);
          font-size: 13px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .footer-notice-text {
          margin: 0;
          color: var(--color-text-muted);
          font-size: 12px;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .footer-bottom-bar {
          max-width: 1280px;
          margin: 32px auto 0;
          padding-top: 20px;
          border-top: 1px solid var(--color-border);
          text-align: center;
        }

        .footer-copyright {
          margin: 0;
          color: var(--color-text-muted);
          font-size: 12px;
          font-weight: 500;
        }

        @media (max-width: 1100px) {
          .footer-container {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 26px;
          }

          .footer-notice-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 600px) {
          .app-footer {
            padding: 36px 16px 88px;
          }

          .footer-container {
            grid-template-columns: minmax(0, 1fr);
            gap: 24px;
          }

          .footer-notice-card {
            grid-column: auto;
          }
        }
      `}</style>
    </footer>
  );
}
