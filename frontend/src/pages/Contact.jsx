import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  MailIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SendIcon,
  HelpCircleIcon,
  UserIcon,
  LockIcon,
} from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { submitSupportRequest } from '../services/api';

export default function Contact({ activeTab, setActiveTab }) {
  const { t } = useLanguage();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const [requestType, setRequestType] = useState('scan_issue');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [scanId, setScanId] = useState('');
  const [details, setDetails] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);

  useEffect(() => {
    if (user && user.email) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage(t('contact.emailLabel') + ' - الرجاء إدخال بريد إلكتروني صحيح');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage(t('contact.subjectLabel') + ' - هذا الحقل مطلوب');
      return;
    }
    if (!details.trim()) {
      setErrorMessage(t('contact.detailsLabel') + ' - هذا الحقل مطلوب');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitSupportRequest({
        requestType,
        email: email.trim(),
        subject: subject.trim(),
        scanId: scanId.trim(),
        details: details.trim(),
      });

      if (response && response.success && response.ticket_id) {
        setSubmittedTicket(response.ticket_id);
      } else {
        setErrorMessage('تعذر حفظ طلب الدعم حاليًا. حاول لاحقًا.');
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        setErrorMessage('جلسة التوثيق منتهية. يرجى تسجيل الدخول مجدداً.');
      } else if (status === 429) {
        setErrorMessage('تم تجاوز حد الطلبات مؤقتًا. حاول مرة أخرى لاحقًا.');
      } else if (status >= 500) {
        setErrorMessage('خدمة الدعم غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.');
      } else {
        setErrorMessage('تعذر حفظ طلب الدعم حاليًا. حاول لاحقًا.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedTicket(null);
    setSubject('');
    setScanId('');
    setDetails('');
    setErrorMessage('');
  };

  return (
    <div className="page-wrapper">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-content" id="main-content">
        <div className="contact-page-container">
          {/* Breadcrumb Navigation */}
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="breadcrumb-link" onClick={() => setActiveTab('home')}>
              {t('nav.breadcrumbHome')}
            </button>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{t('nav.contact')}</span>
          </nav>

          {/* Header Title */}
          <div className="contact-header-card">
            <div className="contact-title-icon">
              <MailIcon size={28} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="contact-h1">{t('contact.title')}</h1>
              <p className="contact-subtitle">{t('contact.subtitle')}</p>
            </div>
          </div>

          {/* Support Channel Summary */}
          <div className="contact-info-card">
            <div className="info-card-header">
              <MailIcon size={18} color="var(--color-secondary)" />
              <h3>{t('contact.supportCardTitle')}</h3>
            </div>
            <div className="info-card-body">
              <p>
                <strong>{t('contact.supportEmailLabel')}</strong>{' '}
                <a href="mailto:support@nabeh-safelink.com" className="support-email-link">
                  support@nabeh-safelink.com
                </a>
              </p>
              <p className="hours-note">{t('contact.supportHoursLabel')}</p>
            </div>
          </div>

          {/* Policy Lock Screen for Guests OR Main Form for Authenticated Users */}
          {isGuest || !user ? (
            /* Guest Policy Card */
            <div className="guest-policy-card">
              <div className="policy-icon-badge">
                <LockIcon size={32} color="var(--color-secondary)" />
              </div>
              <h2>التواصل مع المطور يتطلب إنشاء حساب</h2>
              <p className="policy-desc">
                لحماية أمان المنظومة وضمان متابعة تذاكر الدعم والرد عليها بدقة، يتطلب إرسال الرسائل والاستفسارات أو التواصل المباشر مع مطوري النظام وجود حساب مفعّل وتسجيل الدخول لحسابك المعتمد.
              </p>

              <div className="policy-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate('/login?next=/contact')}
                >
                  <UserIcon size={16} />
                  <span>تسجيل الدخول</span>
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => navigate('/register?next=/contact')}
                >
                  <UserIcon size={16} />
                  <span>إنشاء حساب جديد</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveTab('faq')}
                >
                  <HelpCircleIcon size={16} />
                  <span>الأسئلة الشائعة</span>
                </button>
              </div>
            </div>
          ) : !submittedTicket ? (
            /* Authenticated Contact Form */
            <form className="contact-form-card" onSubmit={handleSubmit} noValidate>
              {errorMessage && (
                <div className="form-error-banner" role="alert">
                  <AlertTriangleIcon size={18} color="var(--color-danger)" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Request Type */}
              <div className="form-group">
                <label htmlFor="requestType">{t('contact.typeLabel')}</label>
                <select
                  id="requestType"
                  className="form-control"
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                >
                  <option value="scan_issue">{t('contact.typeScanIssue')}</option>
                  <option value="inaccurate_result">{t('contact.typeInaccurateResult')}</option>
                  <option value="account_general">{t('contact.typeAccountGeneral')}</option>
                  <option value="suggestion">{t('contact.typeSuggestion')}</option>
                  <option value="other">{t('contact.typeOther')}</option>
                </select>
              </div>

              {/* Verified Email Field (Pre-filled and Locked to User's Account) */}
              <div className="form-group">
                <label htmlFor="contactEmail">
                  {t('contact.emailLabel')}{' '}
                  <span className="verified-badge">✓ البريد المعتمد للحساب</span>
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  className="form-control verified-input"
                  value={email}
                  readOnly
                  required
                />
              </div>

              {/* Subject */}
              <div className="form-group">
                <label htmlFor="contactSubject">{t('contact.subjectLabel')}</label>
                <input
                  id="contactSubject"
                  type="text"
                  className="form-control"
                  placeholder={t('contact.subjectPlaceholder')}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              {/* Optional Scan ID */}
              <div className="form-group">
                <label htmlFor="scanId">{t('contact.scanIdLabel')}</label>
                <input
                  id="scanId"
                  type="text"
                  className="form-control"
                  placeholder={t('contact.scanIdPlaceholder')}
                  value={scanId}
                  onChange={(e) => setScanId(e.target.value)}
                />
                <span className="field-hint">{t('contact.scanIdHint')}</span>
              </div>

              {/* Details */}
              <div className="form-group">
                <label htmlFor="contactDetails">{t('contact.detailsLabel')}</label>
                <textarea
                  id="contactDetails"
                  rows={5}
                  className="form-control textarea"
                  placeholder={t('contact.detailsPlaceholder')}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  required
                />
              </div>

              {/* Privacy Notice Banner */}
              <div className="contact-privacy-alert">
                <AlertTriangleIcon size={18} color="var(--color-warning)" />
                <p>{t('contact.privacyNotice')}</p>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveTab('home')}
                >
                  {t('contact.cancelBtn')}
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span>{t('contact.sendingBtn')}</span>
                  ) : (
                    <>
                      <SendIcon size={16} />
                      <span>{t('contact.sendBtn')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Success Card */
            <div className="contact-success-card">
              <div className="success-icon-badge">
                <CheckCircleIcon size={48} color="var(--color-success)" />
              </div>
              <h2>{t('contact.successTitle')}</h2>
              <p className="success-msg">
                {t('contact.successMsg', { ticketId: submittedTicket })}
              </p>

              <div className="success-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResetForm}
                >
                  {t('contact.newRequestBtn')}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setActiveTab('faq')}
                >
                  <HelpCircleIcon size={16} />
                  <span>{t('contact.backToFaqBtn')}</span>
                </button>
              </div>
            </div>
          )}
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

        .contact-page-container {
          max-width: 720px;
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

        .contact-header-card {
          display: flex;
          align-items: center;
          gap: var(--space-4, 16px);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5, 20px);
          box-shadow: var(--shadow-sm);
        }

        .contact-title-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: var(--color-secondary-subtle);
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .contact-h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          margin: 0 0 4px;
        }

        .contact-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .contact-info-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-4, 16px) var(--space-5, 20px);
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .info-card-header h3 {
          margin: 0;
          font-size: 15px;
          color: var(--color-text);
        }

        .info-card-body p {
          margin: 4px 0;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .support-email-link {
          color: var(--color-secondary);
          text-decoration: none;
          font-weight: 600;
        }

        .support-email-link:hover {
          text-decoration: underline;
        }

        .hours-note {
          font-size: 12px;
          color: var(--color-text-muted);
        }

        /* Guest Policy Card */
        .guest-policy-card {
          background: var(--color-surface);
          border: 1.5px solid color-mix(in srgb, var(--color-secondary) 30%, var(--color-border));
          border-radius: var(--radius-lg);
          padding: 36px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-md);
        }

        .policy-icon-badge {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--color-secondary-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .guest-policy-card h2 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          color: var(--color-primary);
        }

        .policy-desc {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.65;
          color: var(--color-text-secondary);
          max-width: 540px;
        }

        .policy-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .contact-form-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6, 24px);
          display: flex;
          flex-direction: column;
          gap: var(--space-4, 16px);
          box-shadow: var(--shadow-sm);
        }

        .form-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-danger-subtle);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          color: var(--color-danger);
          font-size: 13px;
          font-weight: 500;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .verified-badge {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--color-success);
          background: var(--color-success-bg);
          border: 1px solid var(--color-success-border);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }

        .verified-input {
          background: var(--color-bg-subtle) !important;
          color: var(--color-text-secondary) !important;
          cursor: not-allowed;
        }

        .form-control {
          width: 100%;
          padding: 10px 14px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          color: var(--color-text);
          outline: none;
          transition: border-color var(--transition-fast);
          box-sizing: border-box;
        }

        .form-control:focus {
          border-color: var(--color-secondary);
        }

        .textarea {
          resize: vertical;
          min-height: 100px;
        }

        .field-hint {
          font-size: 12px;
          color: var(--color-text-muted);
        }

        .contact-privacy-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: var(--color-warning-subtle);
          border: 1px solid var(--color-warning);
          border-radius: var(--radius-md);
          padding: 12px 14px;
        }

        .contact-privacy-alert p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--color-text);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-primary {
          background: var(--color-primary);
          color: #ffffff;
          border: none;
          padding: 10px 22px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--color-bg);
          color: var(--color-text);
          border: 1px solid var(--color-border);
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all var(--transition-fast, 0.2s ease);
        }

        .btn-outline {
          background: var(--color-bg);
          color: var(--color-primary);
          border: 1.5px solid var(--color-border-strong, var(--color-border));
          padding: 10px 20px;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all var(--transition-fast, 0.2s ease);
        }

        .btn-outline:hover {
          background: var(--color-secondary-subtle);
          border-color: var(--color-secondary);
          color: var(--color-secondary);
        }

        .contact-success-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-8, 48px) var(--space-6, 24px);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .contact-success-card h2 {
          margin: 0;
          font-size: 20px;
          color: var(--color-text);
        }

        .success-msg {
          margin: 0;
          font-size: 14px;
          color: var(--color-text-secondary);
          max-width: 500px;
          line-height: 1.6;
        }

        .success-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        @media (max-width: 600px) {
          .form-actions {
            flex-direction: column-reverse;
          }
          .btn-primary, .btn-secondary, .btn-outline {
            width: 100%;
            justify-content: center;
          }
          .policy-actions {
            flex-direction: column;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
