import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRuntimeConfig } from '../context/RuntimeConfigContext';
import { UnifiedLoadingGate } from './SessionCheckScreen';
import api from '../services/api';
const DEFAULT_TERMS = {
  ar: {
    title: 'شروط الاستخدام المحدّثة',
    version: '1.0',
    content_markdown: `تقدم Nabeh SafeLink خدمة مساعدة لتحليل الروابط والرسائل والمؤشرات المرتبطة بالاحتيال. النتائج احتمالية وليست ضمانًا أمنيًا أو قرارًا قانونيًا أو ماليًا.

يلتزم المستخدم باستخدام الخدمة لأغراض مشروعة، وعدم إرسال كلمات المرور أو مفاتيح الوصول أو بيانات البطاقات أو أي أسرار. لا يجوز محاولة تعطيل الخدمة أو تجاوز حدود الاستخدام.

يستطيع المستخدم إدارة فحوصاته وطلب إخفائها أو حذف بيانات حسابه وفق سياسة الخصوصية والاحتفاظ.`
  },
  en: {
    title: 'Updated Terms of Use',
    version: '1.0',
    content_markdown: `Nabeh SafeLink provides an assistance service for analyzing links, messages, and fraud-related signals. Results are probabilistic and are not a security guarantee.

Use the service lawfully. Do not submit passwords, access keys, or payment-card data.

You can manage scans and request hiding or deletion of account data under the privacy policy.`
  }
};

export default function TermsConsentGate({ children }) {
  const { config } = useRuntimeConfig();
  const auth = useAuth();
  const { lang, dir } = useLanguage();
  const user = auth?.user;
  const isGuest = auth?.isGuest ?? true;
  const authLoading = auth?.loading ?? false;
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!config.require_latest_terms || isGuest || !user) {
      setStatus({ required: false, accepted: true });
      setError('');
      return;
    }
    const userId = user?.id || user?.user_id || 'user';
    const savedConsent = localStorage.getItem(`nabeh_terms_accepted_${userId}`);
    if (savedConsent) {
      setStatus({ required: true, accepted: true, version: savedConsent });
      setError('');
      return;
    }

    setError('');
    try {
      const response = await api.get('/legal/terms-status');
      if (response.data?.success && response.data?.data) {
        const data = response.data.data;
        if (savedConsent && savedConsent === String(data.version || '1.0')) {
          data.accepted = true;
        }
        if (!data.accepted && data.terms && !data.terms.content_markdown) {
          const fallback = DEFAULT_TERMS[lang === 'ar' ? 'ar' : 'en'];
          data.terms = { ...data.terms, ...fallback };
        }
        setStatus(data);
        return;
      }
      throw new Error('Invalid terms status');
    } catch {
      const fallback = DEFAULT_TERMS[lang === 'ar' ? 'ar' : 'en'];
      const isLocallyAccepted = Boolean(savedConsent);
      setStatus({
        required: true,
        accepted: isLocallyAccepted,
        version: fallback.version,
        terms: fallback,
      });
      setError('');
    }
  }, [config.require_latest_terms, isGuest, user, lang]);

  useEffect(() => {
    setChecked(false);
    if (!authLoading) loadStatus();
  }, [authLoading, user?.user_id, user?.id, loadStatus]);

  const acceptTerms = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError('');
    const version = status?.version || status?.terms?.version || '1.0';
    const userId = user?.id || user?.user_id || 'user';
    try {
      await api.post('/legal/terms-consent');
    } catch {
      // Local storage persistence serves as fallback
    } finally {
      localStorage.setItem(`nabeh_terms_accepted_${userId}`, version);
      setStatus((previous) => ({ ...(previous || {}), required: true, accepted: true }));
      setBusy(false);
    }
  };

  if (!config.require_latest_terms || isGuest) return children ?? <Outlet />;
  if (authLoading || (!status && !error)) {
    const isArabic = lang === 'ar';
    return (
      <UnifiedLoadingGate
        badgeText={isArabic ? 'التحقق من السياسات' : 'Policy Verification'}
        title={isArabic ? 'جارِ التحقق من الشروط والسياسات' : 'Checking Terms & Policies'}
        subtitle={isArabic ? 'مطابقة أحدث إصدار لشروط الاستخدام المعتمدة' : 'Verifying current terms of use policy version'}
        statusText={isArabic ? 'فحص حالة الموافقة الأمنية...' : 'Checking policy consent status...'}
        progress={50}
      />
    );
  }
  if (status?.accepted || status?.required === false) return children ?? <Outlet />;

  const isArabic = lang === 'ar';
  const fallbackTerms = DEFAULT_TERMS[isArabic ? 'ar' : 'en'];
  const terms = status?.terms || fallbackTerms;
  const contentMarkdown = terms.content_markdown || fallbackTerms.content_markdown;
  const canAccept = Boolean(checked && !busy);
  return (
    <main className="terms-gate" dir={dir}>
      <section className="terms-gate-card" aria-labelledby="terms-gate-title">
        <span className="terms-gate-eyebrow">{isArabic ? 'مطلوب إجراء' : 'Action required'}</span>
        <h1 id="terms-gate-title">{terms.title || fallbackTerms.title}</h1>
        <p>{isArabic ? `النسخة ${terms.version || '1.0'} — يرجى مراجعة الشروط قبل المتابعة.` : `Version ${terms.version || '1.0'} — review the terms before continuing.`}</p>
        <div className="terms-gate-content" tabIndex="0" aria-label={isArabic ? 'نص شروط الاستخدام' : 'Terms of Use text'}>
          {contentMarkdown}
        </div>
        <label className="terms-gate-check">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span>{isArabic ? 'قرأت شروط الاستخدام وأوافق على النسخة الحالية.' : 'I have read and agree to the current Terms of Use.'}</span>
        </label>
        {error && <p className="terms-gate-error" role="alert">{error}</p>}
        <div className="terms-gate-actions">
          {error && <button type="button" className="terms-gate-secondary" onClick={loadStatus}>{isArabic ? 'إعادة المحاولة' : 'Retry'}</button>}
          <button type="button" className="terms-gate-primary" disabled={!canAccept} onClick={acceptTerms}>
            {busy ? (isArabic ? 'جارٍ تسجيل الموافقة...' : 'Recording consent…') : (isArabic ? 'موافقة ومتابعة' : 'Agree and continue')}
          </button>
        </div>
      </section>
    </main>
  );
}
