import { useState, useMemo } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  SearchIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BookOpenIcon,
  MailIcon,
  XCircleIcon
} from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';

export default function Faq({ activeTab, setActiveTab }) {
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIndex, setOpenIndex] = useState(0); // first question open by default

  const faqData = useMemo(() => [
    {
      id: 'q1',
      category: 'general',
      question: lang === 'ar' ? 'كيف أفحص رابطاً أو رسالة نصية عبر نبيه؟' : 'How do I scan a URL or SMS message with Nabeh?',
      answer: lang === 'ar'
        ? 'انسخ الرابط الإلكتروني أو نص الرسالة المشبوهة، ثم انتقل إلى تبويب "الفحص" في القائمة الرئيسية. الصق النص في حقل الإدخال وانقر على "بدء الفحص الآمن". ستظهر النتيجة التقييمية خلال ثوانٍ قليلة.'
        : 'Copy the suspicious URL or SMS message text, then go to the "Scan" tab in the navigation. Paste it into the input field and click "Start Safe Scan". Results will appear in seconds.',
      linkToGuide: true
    },
    {
      id: 'q2',
      category: 'results',
      question: lang === 'ar' ? 'ماذا تعني نتائج التصنيف الثلاثة: آمن (Safe)، مشبوه (Suspicious)، وخطر (Dangerous)؟' : 'What do the three classifications (Safe, Suspicious, Dangerous) mean?',
      answer: lang === 'ar'
        ? '• لم تُرصد مؤشرات: لم تظهر مؤشرات تهديد في المصادر التي استجابت، وهذا لا يثبت أن الرابط آمن أو أن الرسالة أصلية.\n• مشبوه: ظهرت مؤشرات تستدعي الحذر والتحقق المستقل.\n• خطير: اجتمعت أدلة قوية وفق سياسة الدمج؛ لا تفتح الرابط ولا تشارك بياناتك.'
        : '• No indicators detected: available sources returned no threat indicators; this does not prove a URL is safe or a message authentic.\n• Suspicious: indicators warrant caution and independent verification.\n• Dangerous: strong evidence met the fusion policy; do not open the link or share data.',
    },
    {
      id: 'q3',
      category: 'results',
      question: lang === 'ar' ? 'لماذا لا تظهر نسبة للثقة؟' : 'Why is no confidence percentage shown?',
      answer: lang === 'ar'
        ? 'لا نعرض درجات رقمية غير معايرة. التصنيف إشارة مساعدة مبنية على الأدلة المتاحة وقت الفحص، ولا يضمن خلو الرابط أو الرسالة من التهديد.'
        : 'Uncalibrated numeric scores are withheld. The classification is a decision-support signal based on evidence available at scan time and does not guarantee a URL or message is threat-free.',
    },
    {
      id: 'q4',
      category: 'results',
      question: lang === 'ar' ? 'كيف يجمع نبيه بين الذكاء الاصطناعي (Gemini)، محركات VirusTotal والتعلم الآلي (ML)؟' : 'How does Nabeh combine Gemini AI, VirusTotal, and Machine Learning?',
      answer: lang === 'ar'
        ? 'يستخدم نابه نموذج LightGBM محلياً لتقييم مؤشرات الرابط، ويستعلم عن VirusTotal عند توفر الخدمة. قد يساعد Gemini في تحليل سياق الرسالة أو شرح النتيجة عند تفعيله؛ وإذا نقصت الأدلة فالنتيجة غير محددة. عدم ظهور بلاغ لا يثبت السلامة.'
        : 'Nabeh uses a local LightGBM model to assess URL indicators and queries VirusTotal when available. Gemini may analyze message context or explain results when enabled. Insufficient evidence yields an inconclusive result; absence of reports is not proof of safety.',
    },
    {
      id: 'q5',
      category: 'general',
      question: lang === 'ar' ? 'ماذا أفعل إذا ظهرت النتيجة "مشبوهة" أو "خطيرة"؟' : 'What should I do if a result is "Suspicious" or "Dangerous"?',
      answer: lang === 'ar'
        ? 'إذا ظهرت النتيجة "مشبوهة" أو "خطيرة"، يُنصح بشدة بعدم النقر على الرابط، وعدم إدخال أي كلمات مرور أو رموز تحقق أو بيانات بطاقات ائتمانية. يمكنك الإبلاغ عن الرسالة أو مسحها فوراً.'
        : 'If classified as Suspicious or Dangerous, avoid clicking the link or entering sensitive credentials or banking info. Delete the message or report it.',
    },
    {
      id: 'q6',
      category: 'privacy',
      question: lang === 'ar' ? 'هل يفتح نبيه الرابط تلقائياً أثناء الفحص؟' : 'Does Nabeh automatically open the link during scanning?',
      answer: lang === 'ar'
        ? 'لا إطلاقاً. لا يقوم نبيه بفتح الرابط المشبوه أو تشغيل الكود في متصفحك أو جهازك أثناء الفحص. يتم تحليل المعطيات والنطاق بأمان عبر خوادم الأمان دون تعريض جهازك لأي خطر.'
        : 'No, absolutely not. Nabeh does not open the link or execute code on your device. Analysis is performed safely on security engines without exposing your browser.',
    },
    {
      id: 'q7',
      category: 'privacy',
      question: lang === 'ar' ? 'هل تُحفظ الروابط أو النصوص التي أفحصها؟ ومن يستطيع رؤيتها؟' : 'Are my scanned links or texts saved, and who can view them?',
      answer: lang === 'ar'
        ? 'تُحفظ سجلات الفحص محلياً على جهازك في سياق الجلسة والسجل لتتمكن من مراجعة عملياتك. لا يتم مشاركة مدخلاتك الحساسة أو بياناتك الشخصية مع أي طرف ثالث.'
        : 'Scan logs are kept locally on your session history so you can review past operations. Your sensitive personal data is never sold or shared with third parties.',
    },
    {
      id: 'q8',
      category: 'url_scan',
      question: lang === 'ar' ? 'لماذا قد يفشل الفحص أو تظهر النتيجة "غير محددة" (Unknown)؟' : 'Why might a scan fail or display an "Unknown" classification?',
      answer: lang === 'ar'
        ? 'قد يحدث ذلك في حال انقطاع الاتصال بالإنترنت، أو إذا كان الرابط غير صالح أو خادماً جديداً كلياً لم يُسجل في قواعد بيانات التهديدات بعد. يرجى التأكد من كتابة URL صحيح وإعادة الفحص.'
        : 'This may occur if network connectivity drops, if the URL syntax is invalid, or if it is a brand-new domain not yet indexed. Verify the URL syntax and try again.',
    },
    {
      id: 'q9',
      category: 'msg_scan',
      question: lang === 'ar' ? 'هل يمكن استخدام نبيه لفحص الرسائل النصية القصيرة (SMS) والبريد؟' : 'Can Nabeh inspect SMS messages and email text?',
      answer: lang === 'ar'
        ? 'نعم، يتيح نبيه تبويب "فحص نص/رسالة" لتحليل نصوص الرسائل والبريد لكشف محاولات الهندسة الاجتماعية، الوعود المالية الكاذبة، والروابط التصيدية المضمنة.'
        : 'Yes, Nabeh provides an "SMS / Text Scan" tab to inspect message text for social engineering, fake monetary promises, and embedded phishing URLs.',
    },
    {
      id: 'q10',
      category: 'privacy',
      question: lang === 'ar' ? 'هل أحتاج لتسجيل الدخول لاستخدام نظام نبيه؟' : 'Do I need to sign in or create an account to use Nabeh?',
      answer: lang === 'ar'
        ? 'لا، يمكنك استخدام كافة أدوات الفحص والسجل والإحصائيات مباشرة ودون الحاجة لتسجيل حساب أو إدخال بيانات شخصية.'
        : 'No, all scanning tools, scan history, and analytics are freely accessible directly without account creation.',
    }
  ], [lang]);

  const categories = [
    { id: 'all', label: t('faq.categoryAll') },
    { id: 'general', label: t('faq.categoryGeneral') },
    { id: 'url_scan', label: t('faq.categoryUrlScan') },
    { id: 'msg_scan', label: t('faq.categoryMsgScan') },
    { id: 'results', label: t('faq.categoryResults') },
    { id: 'privacy', label: t('faq.categoryPrivacy') },
  ];

  const filteredFaqs = useMemo(() => {
    return faqData.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [faqData, activeCategory, searchQuery]);

  return (
    <div className="page-wrapper">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content" id="main-content">
        <div className="faq-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="breadcrumb-link" onClick={() => setActiveTab('home')}>
              {t('nav.breadcrumbHome')}
            </button>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{t('nav.faq')}</span>
          </nav>

          {/* Page Header Title */}
          <div className="faq-header-card">
            <div className="faq-title-icon">
              <HelpCircleIcon size={28} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="faq-h1">{t('faq.title')}</h1>
              <p className="faq-subtitle">{t('faq.subtitle')}</p>
            </div>
          </div>

          {/* Search Box */}
          <div className="faq-search-wrapper">
            <div className="faq-search-input-box">
              <SearchIcon size={20} color="var(--color-text-muted)" />
              <input
                type="text"
                className="faq-search-input"
                placeholder={t('faq.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('faq.searchPlaceholder')}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="faq-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title={t('faq.clearSearch')}
                  aria-label={t('faq.clearSearch')}
                >
                  <XCircleIcon size={18} color="var(--color-text-muted)" />
                </button>
              )}
            </div>
          </div>

          {/* Category Chips */}
          <div className="faq-categories-row" role="tablist" aria-label="FAQ Categories">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`faq-chip-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  role="tab"
                  aria-selected={isActive}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* FAQ Accordion List */}
          {filteredFaqs.length > 0 ? (
            <div className="faq-accordion-list">
              {filteredFaqs.map((item, index) => {
                const isOpen = openIndex === index;
                return (
                  <div key={item.id} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="faq-question-btn"
                      onClick={() => setOpenIndex(isOpen ? -1 : index)}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-question-text">{item.question}</span>
                      {isOpen ? (
                        <ChevronUpIcon size={20} color="var(--color-primary)" />
                      ) : (
                        <ChevronDownIcon size={20} color="var(--color-text-muted)" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="faq-answer-body">
                        <p className="faq-answer-text">{item.answer}</p>
                        {item.linkToGuide && (
                          <button
                            type="button"
                            className="faq-guide-link-btn"
                            onClick={() => setActiveTab('guide')}
                          >
                            <BookOpenIcon size={16} />
                            <span>{t('faq.viewGuideBtn')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="faq-empty-card">
              <SearchIcon size={40} color="var(--color-text-muted)" />
              <h3>{t('faq.noResultsTitle')}</h3>
              <p>{t('faq.noResultsSub')}</p>
              <div className="faq-empty-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                  }}
                >
                  {t('faq.clearSearch')}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setActiveTab('contact')}
                >
                  <MailIcon size={16} />
                  <span>{t('faq.contactBtn')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Bottom Help CTA */}
          <div className="faq-bottom-cta">
            <div className="faq-cta-content">
              <h3>{t('faq.contactCtaTitle')}</h3>
              <p>{t('faq.contactCtaSub')}</p>
            </div>
            <button
              type="button"
              className="faq-cta-btn"
              onClick={() => setActiveTab('contact')}
            >
              <MailIcon size={18} />
              <span>{t('faq.contactBtn')}</span>
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

        .faq-page-container {
          max-width: 820px;
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

        .faq-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .faq-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .faq-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .faq-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .faq-search-wrapper {
          position: relative;
        }

        .faq-search-input-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          box-shadow: var(--shadow-xs);
          transition: border-color var(--transition-fast);
        }

        .faq-search-input-box:focus-within {
          border-color: var(--color-secondary);
        }

        .faq-search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          color: var(--color-text);
        }

        .faq-clear-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
        }

        .faq-categories-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .faq-chip-btn {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 8px 16px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .faq-chip-btn:hover {
          border-color: var(--color-secondary);
          color: var(--color-text);
        }

        .faq-chip-btn.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: #ffffff;
        }

        .faq-accordion-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .faq-accordion-item {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }

        .faq-accordion-item.open {
          border-color: var(--color-secondary);
        }

        .faq-question-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 16px 20px;
          background: none;
          border: none;
          font-family: inherit;
          text-align: start;
          cursor: pointer;
          gap: 12px;
        }

        .faq-question-text {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text);
        }

        .faq-answer-body {
          padding: 0 20px 20px;
          border-top: 1px solid var(--color-border);
          padding-top: 14px;
        }

        .faq-answer-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.7;
          color: var(--color-text-secondary);
          white-space: pre-line;
        }

        .faq-guide-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-secondary);
          cursor: pointer;
        }

        .faq-guide-link-btn:hover {
          text-decoration: underline;
        }

        .faq-empty-card {
          text-align: center;
          padding: var(--space-8, 48px) var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .faq-empty-card h3 {
          margin: 0;
          font-size: 18px;
          color: var(--color-text);
        }

        .faq-empty-card p {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .faq-empty-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
        }

        .faq-bottom-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          gap: var(--space-4, 16px);
          margin-top: var(--space-4, 16px);
        }

        .faq-cta-content h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: var(--color-text);
        }

        .faq-cta-content p {
          margin: 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .faq-cta-btn {
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
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .faq-bottom-cta {
            flex-direction: column;
            align-items: flex-start;
          }
          .faq-cta-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
