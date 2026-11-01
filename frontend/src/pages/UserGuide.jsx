import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  BookOpenIcon,
  ShieldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  MailIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BarChartIcon,
  LinkIcon,
  MessageSquareIcon
} from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';

export default function UserGuide({ activeTab, setActiveTab }) {
  const { t, dir } = useLanguage();
  const [activeSection, setActiveSection] = useState('sec1');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const sections = [
    { id: 'sec1', title: t('guide.section1Title'), icon: ShieldIcon },
    { id: 'sec2', title: t('guide.section2Title'), icon: LinkIcon },
    { id: 'sec3', title: t('guide.section3Title'), icon: MessageSquareIcon },
    { id: 'sec4', title: t('guide.section4Title'), icon: CheckCircleIcon },
    { id: 'sec5', title: t('guide.section5Title'), icon: BarChartIcon },
    { id: 'sec6', title: t('guide.section6Title'), icon: AlertTriangleIcon },
  ];

  const currentSectionIndex = sections.findIndex((s) => s.id === activeSection);

  const handlePrev = () => {
    if (currentSectionIndex > 0) {
      setActiveSection(sections[currentSectionIndex - 1].id);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (currentSectionIndex < sections.length - 1) {
      setActiveSection(sections[currentSectionIndex + 1].id);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  return (
    <div className="page-wrapper">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content" id="main-content">
        <div className="guide-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="breadcrumb-link" onClick={() => setActiveTab('home')}>
              {t('nav.breadcrumbHome')}
            </button>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{t('nav.guide')}</span>
          </nav>

          {/* Header Card */}
          <div className="guide-header-card">
            <div className="guide-title-icon">
              <BookOpenIcon size={28} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="guide-h1">{t('guide.title')}</h1>
              <p className="guide-subtitle">{t('guide.subtitle')}</p>
            </div>
          </div>

          {/* Mobile TOC Selector */}
          <div className="mobile-toc-wrapper">
            <button
              type="button"
              className="mobile-toc-toggle"
              onClick={() => setMobileTocOpen((prev) => !prev)}
            >
              <span>{t('guide.tocTitle')}: {sections[currentSectionIndex]?.title}</span>
              <ChevronDownIcon size={18} />
            </button>
            {mobileTocOpen && (
              <div className="mobile-toc-dropdown">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    className={`mobile-toc-item ${activeSection === sec.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSection(sec.id);
                      setMobileTocOpen(false);
                    }}
                  >
                    <span>{sec.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Guide Content Area (Sidebar + Chapter Content) */}
          <div className="guide-layout">
            {/* Desktop TOC Sticky Sidebar */}
            <aside className="guide-toc-sidebar">
              <h3 className="toc-sidebar-title">{t('guide.tocTitle')}</h3>
              <nav className="toc-nav-list">
                {sections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      className={`toc-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveSection(sec.id)}
                    >
                      <Icon size={16} />
                      <span>{sec.title}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Reading Content Area */}
            <article className="guide-content-article">
              {activeSection === 'sec1' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section1Title')}</h2>
                  <p>{t('guide.section1Desc')}</p>

                  <div className="guide-tip-banner">
                    <ShieldIcon size={20} color="var(--color-secondary)" />
                    <div>
                      <strong>تلميحة سريعة:</strong> نبيه مجاني بالكامل ولا يطلب أي كلمة مرور أو بيانات تسجيل دخول.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveTab('scan')}
                  >
                    <ShieldIcon size={16} />
                    <span>{t('guide.quickScanBtn')}</span>
                  </button>
                </div>
              )}

              {activeSection === 'sec2' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section2Title')}</h2>
                  <p>{t('guide.section2Desc')}</p>

                  <div className="steps-list">
                    <div className="step-item">
                      <div className="step-badge">1</div>
                      <div>
                        <strong>نسخ الرابط المشتبه به:</strong> انسخ النص الكامل للرابط مع البروتوكول (http/https).
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-badge">2</div>
                      <div>
                        <strong>اللصق في الفحص:</strong> اختر تبويب "فحص رابط" وانقر على زر "لصق" المساعد.
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-badge">3</div>
                      <div>
                        <strong>بدء الفحص واستعراض التقرير:</strong> اضغط على زر "بدء الفحص الآمن" وتابع التحليل التفسيري التوليدي.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'sec3' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section3Title')}</h2>
                  <p>{t('guide.section3Desc')}</p>

                  <div className="steps-list">
                    <div className="step-item">
                      <div className="step-badge">1</div>
                      <div>
                        <strong>تحديد محتوى الرسالة:</strong> انسخ نص الرسالة النصية أو البريد المريب كاملاً.
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-badge">2</div>
                      <div>
                        <strong>فحص الرسالة:</strong> اختر تبويب "فحص نص / رسالة (SMS)" في صفحة الفحص والصق النص.
                      </div>
                    </div>

                    <div className="step-item">
                      <div className="step-badge">3</div>
                      <div>
                        <strong>قراءة التحليل:</strong> سيقوم المحرك بتحليل نصوص الادعاءات المالية ومحاولات الانتحال.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'sec4' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section4Title')}</h2>
                  <p>{t('guide.section4Desc')}</p>

                  <div className="badge-explain-grid">
                    <div className="badge-explain-box safe">
                      <span className="explain-tag safe">آمن (Safe)</span>
                      <p>الرابط خالٍ من التهديدات المعروفة ويمكن تصفحه بسلام.</p>
                    </div>

                    <div className="badge-explain-box suspicious">
                      <span className="explain-tag suspicious">مشبوه (Suspicious)</span>
                      <p>توجد مؤشرات خطورة محتملة. تجنب إدخال أي بيانات بنكية أو شخصية.</p>
                    </div>

                    <div className="badge-explain-box dangerous">
                      <span className="explain-tag dangerous">خطر (Dangerous)</span>
                      <p>تهديد مؤكد برابط احتيالي أو خبيث. يُحظر النقر عليه إطلاقاً.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'sec5' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section5Title')}</h2>
                  <p>{t('guide.section5Desc')}</p>

                  <ul className="guide-bullets">
                    <li>استخدم خانة البحث في صفحة "السجل" للوصول المباشر إلى فحص سابق باسم الرابط.</li>
                    <li>تتيح لك أزرار الفلترة تصفية الفحوصات الخطيرة أو المشبوهة بسهولة.</li>
                    <li>تعرض صفحة "الإحصائيات" رسوماً بيانية توضح توزيع التهديدات وتكرارها.</li>
                  </ul>
                </div>
              )}

              {activeSection === 'sec6' && (
                <div className="guide-section-card">
                  <h2>{t('guide.section6Title')}</h2>
                  <p>{t('guide.section6Desc')}</p>

                  <div className="guide-danger-banner">
                    <AlertTriangleIcon size={20} color="var(--color-danger)" />
                    <div>
                      <strong>قاعدة ذهبية:</strong> عند الشك في رسالة تطلب بياناتك المالية أو رمز تحقق، اتصل بالجهة عبر أرقامها الرسمية المعتمدة ولا تنقر على الروابط الواردة في الرسائل.
                    </div>
                  </div>
                </div>
              )}

              {/* Prev / Next Pagination Bar */}
              <div className="guide-pagination-bar">
                <button
                  type="button"
                  className="guide-nav-btn"
                  onClick={handlePrev}
                  disabled={currentSectionIndex === 0}
                >
                  {dir === 'rtl' ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
                  <span>{t('guide.prevSection')}</span>
                </button>

                <button
                  type="button"
                  className="guide-nav-btn"
                  onClick={handleNext}
                  disabled={currentSectionIndex === sections.length - 1}
                >
                  <span>{t('guide.nextSection')}</span>
                  {dir === 'rtl' ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />}
                </button>
              </div>
            </article>
          </div>

          {/* Bottom Help CTA */}
          <div className="guide-bottom-cta">
            <div>
              <h3>{t('guide.needMoreHelpTitle')}</h3>
              <p>{t('guide.needMoreHelpSub')}</p>
            </div>
            <div className="cta-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveTab('faq')}
              >
                <HelpCircleIcon size={16} />
                <span>{t('nav.faq')}</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab('contact')}
              >
                <MailIcon size={16} />
                <span>{t('nav.contact')}</span>
              </button>
            </div>
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

        .guide-page-container {
          max-width: 960px;
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

        .guide-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .guide-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .guide-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .guide-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .mobile-toc-wrapper {
          display: none;
          position: relative;
        }

        .mobile-toc-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 12px 16px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
        }

        .mobile-toc-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .mobile-toc-item {
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 1px solid var(--color-border);
          text-align: start;
          font-family: inherit;
          font-size: 13px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .mobile-toc-item.active {
          background: var(--color-bg-subtle);
          color: var(--color-secondary);
          font-weight: 600;
        }

        .guide-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: var(--space-6, 24px);
          align-items: start;
        }

        .guide-toc-sidebar {
          position: sticky;
          top: 80px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4, 16px);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .toc-sidebar-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toc-nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .toc-nav-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          text-align: start;
          transition: all var(--transition-fast);
        }

        .toc-nav-btn:hover,
        .toc-nav-btn.active {
          background: var(--color-bg-subtle);
          color: var(--color-secondary);
          font-weight: 600;
        }

        .guide-content-article {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .guide-section-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          box-shadow: var(--shadow-xs);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .guide-section-card h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--color-text);
        }

        .guide-section-card p {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-secondary);
        }

        .guide-tip-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-secondary-subtle);
          border: 1px solid var(--color-secondary);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-size: 13px;
          color: var(--color-text);
        }

        .guide-danger-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-danger-subtle);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-size: 13px;
          color: var(--color-danger);
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          background: var(--color-primary);
          color: #ffffff;
          border-radius: var(--radius-full);
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .badge-explain-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .badge-explain-box {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .explain-tag {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          width: fit-content;
        }

        .explain-tag.safe {
          background: var(--color-success-subtle);
          color: var(--color-success);
        }

        .explain-tag.suspicious {
          background: var(--color-warning-subtle);
          color: var(--color-warning);
        }

        .explain-tag.dangerous {
          background: var(--color-danger-subtle);
          color: var(--color-danger);
        }

        .badge-explain-box p {
          font-size: 12px;
          margin: 0;
          line-height: 1.5;
        }

        .guide-bullets {
          margin: 0;
          padding-inline-start: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .guide-pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
        }

        .guide-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 10px 16px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .guide-nav-btn:hover:not(:disabled) {
          border-color: var(--color-secondary);
          color: var(--color-secondary);
        }

        .guide-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
        }

        .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .guide-bottom-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          gap: 16px;
        }

        .guide-bottom-cta h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: var(--color-text);
        }

        .guide-bottom-cta p {
          margin: 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .cta-actions {
          display: flex;
          gap: 10px;
        }

        @media (max-width: 800px) {
          .guide-layout {
            grid-template-columns: 1fr;
          }
          .guide-toc-sidebar {
            display: none;
          }
          .mobile-toc-wrapper {
            display: block;
          }
          .badge-explain-grid {
            grid-template-columns: 1fr;
          }
          .guide-bottom-cta {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
