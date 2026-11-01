import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRuntimeConfig } from '../context/RuntimeConfigContext';
import api from '../services/api';

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
    setError('');
    try {
      const response = await api.get('/legal/terms-status');
      if (!response.data?.success || !response.data?.data) throw new Error('Invalid terms status');
      setStatus(response.data.data);
    } catch {
      setStatus(null);
      setError(lang === 'ar' ? 'تعذر تحميل حالة الشروط. أعد المحاولة.' : 'Could not load the terms status. Please retry.');
    }
  }, [config.require_latest_terms, isGuest, user, lang]);

  useEffect(() => {
    setStatus(null);
    setChecked(false);
    if (!authLoading) loadStatus();
  }, [authLoading, user?.user_id, user?.id, loadStatus]);

  const acceptTerms = async () => {
    if (!checked || busy || !status?.version || !status?.terms?.content_markdown) return;
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/legal/terms-consent');
      if (!response.data?.success || !response.data?.data?.accepted) throw new Error('Consent was not recorded');
      setStatus((previous) => ({ ...(previous || {}), required: true, accepted: true }));
    } catch {
      setError(lang === 'ar' ? 'تعذر تسجيل الموافقة. أعد المحاولة.' : 'Consent could not be recorded. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  if (!config.require_latest_terms || isGuest) return children ?? <Outlet />;
  if (authLoading || !status && !error) return <main className="terms-gate-loading" aria-live="polite">{lang === 'ar' ? 'جارٍ التحقق من الشروط...' : 'Checking the terms…'}</main>;
  if (status?.accepted || status?.required === false) return children ?? <Outlet />;

  const terms = status?.terms || {};
  const isArabic = lang === 'ar';
  const canAccept = Boolean(checked && status?.version && terms.content_markdown && !busy);
  return (
    <main className="terms-gate" dir={dir}>
      <section className="terms-gate-card" aria-labelledby="terms-gate-title">
        <span className="terms-gate-eyebrow">{isArabic ? 'مطلوب إجراء' : 'Action required'}</span>
        <h1 id="terms-gate-title">{terms.title || (isArabic ? 'شروط الاستخدام المحدّثة' : 'Updated Terms of Use')}</h1>
        <p>{isArabic ? `النسخة ${status?.version || terms.version || '—'} — يرجى مراجعة الشروط قبل المتابعة.` : `Version ${status?.version || terms.version || '—'} — review the terms before continuing.`}</p>
        <div className="terms-gate-content" tabIndex="0" aria-label={isArabic ? 'نص شروط الاستخدام' : 'Terms of Use text'}>
          {terms.content_markdown || (isArabic ? 'تعذر تحميل نص الشروط.' : 'Terms text is unavailable.')}
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
