import { useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import { isValidEmail, normalizeEmail } from './authValidation';
import './login.css';
import './forgot-password.css';

function MailIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
}

export default function ForgotPassword({ onNavigate }) {
  const { forgotPassword } = useAuth();
  const { t, dir } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setError(t('auth.requiredFields'));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await forgotPassword(normalizedEmail);
      if (response?.success === false) {
        setError(t('auth.recoveryRequestError'));
        return;
      }
      // Keep the response generic so the UI does not disclose whether an account exists.
      setEmail(normalizedEmail);
      setSubmitted(true);
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(
        status === 429
          ? t('auth.recoveryRateLimited')
          : status === 503
            ? t('auth.emailDeliveryError')
            : !requestError?.response
              ? t('auth.networkError')
              : status >= 500
                ? t('auth.serviceUnavailable')
                : t('auth.recoveryRequestError'),
      );
    } finally {
      setLoading(false);
    }
  };

  const SubmitArrow = dir === 'rtl' ? ArrowLeftIcon : ArrowRightIcon;
  const BackIcon = dir === 'rtl' ? ArrowRightIcon : ArrowLeftIcon;

  return (
    <main className="login-page forgot-page" dir={dir}>
      <AuthPageControls />
      <div className="login-shell">
        <div className="login-branding"><Logo size="lg" showTagline={false} /></div>

        <section className="login-welcome" aria-labelledby="forgot-title">
          <h1 id="forgot-title">{t('auth.forgotTitle')}</h1>
          <p>{t('auth.forgotSubtitle')}</p>
        </section>

        {submitted ? (
          <section className="forgot-response" role="status" aria-live="polite" aria-labelledby="forgot-response-title">
            <span className="forgot-response-icon" aria-hidden="true"><MailIcon size={24} color="currentColor" /></span>
            <h2 id="forgot-response-title">{t('auth.recoveryRequestReceived')}</h2>
            <p>{t('auth.recoveryInstructions')}</p>
            <strong className="forgot-email" dir="ltr">{email}</strong>
            <button type="button" className="forgot-code-button" onClick={() => onNavigate('verify-otp', { email, type: 'recovery' })}>{t('auth.continueIfCodeReceived')}</button>
          </section>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="recovery-email">{t('auth.emailAddress')}</label>
              <div className="login-field">
                <span className="login-field-icon"><MailIcon size={19} color="currentColor" /></span>
                <input id="recovery-email" name="email" type="email" dir="ltr" inputMode="email" autoCapitalize="none" spellCheck="false" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} required />
              </div>
            </div>
            {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
            <button className="login-submit" type="submit" disabled={loading} aria-busy={loading}>
              <span aria-live="polite">{loading ? t('auth.sendingCode') : t('auth.sendReset')}</span>
              <SubmitArrow size={17} />
            </button>
          </form>
        )}

        <button type="button" className="forgot-back-button" onClick={() => onNavigate('login')}><BackIcon size={16} /> {t('auth.backToSignIn')}</button>
      </div>
    </main>
  );
}
