import Logo from './Logo';
import { ShieldCheckIcon, HelpCircleIcon, MailIcon, BookOpenIcon, InfoIcon, ShieldIcon, BarChartIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const handleNavigate = (id) => {
    if (typeof setActiveTab === 'function') {
      setActiveTab(id);
    }
    const targetPath = ROUTE_MAP[id] || (isGuest && id === 'home' ? '/welcome' : '/scan');
    navigate(targetPath);
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
    ...(isGuest ? [] : [{ id: 'data', label: dir === 'rtl' ? 'إدارة بياناتي' : 'My data controls', path: '/settings/privacy' }]),
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
        {/* Brand & Mission Column */}
        <div className="footer-brand-section">
          <button
            type="button"
            className="footer-logo-btn"
            onClick={() => handleNavigate('home')}
            aria-label={t('nav.goHome')}
          >
            <Logo size="sm" showTagline={false} />
          </button>
          <p className="footer-tagline">{t('footer.tagline')}</p>
          <div className="footer-version-badge">
            <ShieldCheckIcon size={14} color="#16A34A" />
            <span>v1.0.0 MVP Stable</span>
          </div>
        </div>

        {/* Support & Resources Links Column */}
        <div className="footer-links-column">
          <h3 className="footer-column-title">{t('footer.supportSection')}</h3>
          <ul className="footer-links-list">
            {supportLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`footer-link-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavigate(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick Workspace Nav Links Column */}
        <div className="footer-links-column">
          <h3 className="footer-column-title">{t('footer.quickLinksSection')}</h3>
          <ul className="footer-links-list">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`footer-link-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavigate(item.id)}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="footer-links-column">
          <h3 className="footer-column-title">{dir === 'rtl' ? 'الحقوق والبيانات' : 'Legal & data'}</h3>
          <ul className="footer-links-list">
            {legalLinks.map((item) => (
              <li key={item.id}>
                <button type="button" className="footer-link-btn" onClick={() => navigate(item.path)}>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Security Notice Card */}
        <div className="footer-notice-card">
          <div className="notice-card-header">
            <ShieldCheckIcon size={18} color="var(--color-secondary)" />
            <span className="notice-card-title">{t('footer.securityTitle')}</span>
          </div>
          <p className="footer-notice-text">
            {t('footer.securityNotice')}
          </p>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <p className="footer-copyright">
          {t('footer.rights', { year: currentYear })}
        </p>
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
          grid-template-columns: 1.4fr 1fr 1fr 1.3fr;
          gap: 32px;
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
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        .footer-tagline {
          color: var(--color-text-secondary);
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
          max-width: 280px;
        }

        .footer-version-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 8px);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .footer-links-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-column-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
        }

        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-link-btn {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: color var(--transition-fast, 0.2s ease), transform var(--transition-fast, 0.2s ease);
        }

        .footer-link-btn:hover,
        .footer-link-btn.active {
          color: var(--color-secondary);
        }

        .footer-notice-card {
          background: var(--color-bg-subtle);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .notice-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .notice-card-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }

        .footer-notice-text {
          margin: 0;
          font-size: 12px;
          line-height: 1.65;
          color: var(--color-text-muted);
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
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
        }

        @media (max-width: 992px) {
          .footer-container {
            grid-template-columns: 1fr 1fr;
            gap: 28px;
          }
        }

        @media (max-width: 600px) {
          .footer-container {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .app-footer {
            padding: 36px 16px 88px; /* Extra bottom clearance for mobile bottom nav */
          }
        }
      `}</style>
    </footer>
  );
}
