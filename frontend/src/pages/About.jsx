import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  InfoIcon,
  ShieldIcon,
  CpuIcon,
  SparklesIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  HelpCircleIcon
} from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';

export default function About({ activeTab, setActiveTab }) {
  const { t } = useLanguage();

  return (
    <div className="page-wrapper">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content" id="main-content">
        <div className="about-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="breadcrumb-link" onClick={() => setActiveTab('home')}>
              {t('nav.breadcrumbHome')}
            </button>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{t('nav.about')}</span>
          </nav>

          {/* Header Card */}
          <div className="about-header-card">
            <div className="about-title-icon">
              <InfoIcon size={28} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="about-h1">{t('about.title')}</h1>
              <p className="about-subtitle">{t('about.subtitle')}</p>
            </div>
          </div>

          {/* Overview Section */}
          <section className="about-card">
            <div className="card-heading">
              <ShieldIcon size={20} color="var(--color-secondary)" />
              <h2>{t('about.overviewTitle')}</h2>
            </div>
            <p className="about-text">{t('about.overviewDesc')}</p>
          </section>

          {/* How It Works Section */}
          <section className="about-card">
            <div className="card-heading">
              <CpuIcon size={20} color="var(--color-secondary)" />
              <h2>{t('about.howItWorksTitle')}</h2>
            </div>

            <div className="how-it-works-grid">
              <div className="step-box">
                <div className="step-num">1</div>
                <h3>{t('about.step1Title')}</h3>
                <p>{t('about.step1Desc')}</p>
              </div>

              <div className="step-box">
                <div className="step-num">2</div>
                <h3>{t('about.step2Title')}</h3>
                <p>{t('about.step2Desc')}</p>
              </div>

              <div className="step-box">
                <div className="step-num">3</div>
                <h3>{t('about.step3Title')}</h3>
                <p>{t('about.step3Desc')}</p>
              </div>
            </div>
          </section>

          {/* Boundaries & Disclaimers */}
          <section className="about-card warning-border">
            <div className="card-heading">
              <AlertTriangleIcon size={20} color="var(--color-warning)" />
              <h2>{t('about.boundariesTitle')}</h2>
            </div>
            <ul className="bullets-list">
              <li>{t('about.boundary1')}</li>
              <li>{t('about.boundary2')}</li>
              <li>{t('about.boundary3')}</li>
            </ul>
          </section>

          {/* Implemented Features */}
          <section className="about-card">
            <div className="card-heading">
              <CheckCircleIcon size={20} color="var(--color-success)" />
              <h2>{t('about.featuresTitle')}</h2>
            </div>
            <div className="features-grid">
              <div className="feature-item">
                <CheckCircleIcon size={16} color="var(--color-success)" />
                <span>{t('about.feature1')}</span>
              </div>
              <div className="feature-item">
                <CheckCircleIcon size={16} color="var(--color-success)" />
                <span>{t('about.feature2')}</span>
              </div>
              <div className="feature-item">
                <CheckCircleIcon size={16} color="var(--color-success)" />
                <span>{t('about.feature3')}</span>
              </div>
              <div className="feature-item">
                <CheckCircleIcon size={16} color="var(--color-success)" />
                <span>{t('about.feature4')}</span>
              </div>
            </div>
          </section>

          {/* System & Metadata Card */}
          <section className="about-card meta-card">
            <div className="card-heading">
              <SparklesIcon size={20} color="var(--color-primary)" />
              <h2>{t('about.metaTitle')}</h2>
            </div>
            <div className="meta-details">
              <span className="meta-badge">{t('about.versionLabel')}</span>
              <span className="meta-badge">{t('about.engineLabel')}</span>
            </div>
          </section>

          {/* Bottom CTAs */}
          <div className="about-actions-row">
            <button
              type="button"
              className="btn-primary-lg"
              onClick={() => setActiveTab('scan')}
            >
              <ShieldIcon size={18} />
              <span>{t('about.startScanCta')}</span>
            </button>

            <button
              type="button"
              className="btn-secondary-lg"
              onClick={() => setActiveTab('guide')}
            >
              <BookOpenIcon size={18} />
              <span>{t('about.userGuideCta')}</span>
            </button>

            <button
              type="button"
              className="btn-secondary-lg"
              onClick={() => setActiveTab('faq')}
            >
              <HelpCircleIcon size={18} />
              <span>{t('about.faqCta')}</span>
            </button>
          </div>
        </div>
      </main>

      <Footer activeTab={activeTab} setActiveTab={setActiveTab} />

      <style>{`
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
        }

        .main-content {
          flex: 1;
          padding: var(--space-6, 24px) var(--space-4, 16px);
        }

        .about-page-container {
          max-width: 840px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-5, 20px);
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--color-text-muted);
        }

        .breadcrumb-link {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          color: var(--color-secondary);
          cursor: pointer;
        }

        .breadcrumb-link:hover {
          text-decoration: underline;
        }

        .about-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .about-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .about-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .about-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .about-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          box-shadow: var(--shadow-xs);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .about-card.warning-border {
          border-inline-start: 4px solid var(--color-warning);
        }

        .card-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-heading h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text);
        }

        .about-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-secondary);
        }

        .how-it-works-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 8px;
        }

        .step-box {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--color-primary);
          color: #ffffff;
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 700;
        }

        .step-box h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
        }

        .step-box p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          color: var(--color-text-secondary);
        }

        .bullets-list {
          margin: 0;
          padding-inline-start: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bullets-list li {
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 4px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--color-text-secondary);
          background: var(--color-bg);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .meta-card {
          background: var(--color-bg-subtle);
        }

        .meta-details {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .meta-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 14px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }

        .about-actions-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary-lg {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 12px 24px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .btn-secondary-lg {
          background: var(--color-surface);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          padding: 12px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .how-it-works-grid {
            grid-template-columns: 1fr;
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
          .about-actions-row {
            flex-direction: column;
          }
          .btn-primary-lg, .btn-secondary-lg {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
