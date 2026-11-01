import { useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
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
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const response = await forgotPassword(email.trim());
      setMessage(response.message || t('auth.checkInbox'));
      setSubmitted(true);
      timerRef.current = setTimeout(() => onNavigate('verify-otp', { email: email.trim(), type: 'recovery' }), 1800);
    } catch {
      // Keep the same privacy-preserving response for existing and unknown emails.
      setMessage(t('auth.checkInbox'));
      setSubmitted(true);
      timerRef.current = setTimeout(() => onNavigate('verify-otp', { email: email.trim(), type: 'recovery' }), 1800);
    } finally {
      setLoading(false);
    }
  };

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
          <section className="forgot-success" role="status" aria-live="polite">
            <span className="forgot-success-icon"><CheckCircleIcon size={24} color="currentColor" /></span>
            <h2>{t('auth.checkInbox')}</h2>
            <p>{message}</p>
            <button type="button" className="forgot-code-button" onClick={() => onNavigate('verify-otp', { email: email.trim(), type: 'recovery' })}>{t('auth.enterRecovery')}</button>
          </section>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field">
              <span className="login-field-icon"><MailIcon size={19} color="currentColor" /></span>
              <input type="email" dir={dir} autoComplete="email" placeholder={t('auth.emailAddress')} value={email} onChange={(event) => setEmail(event.target.value)} aria-label={t('auth.emailAddress')} required />
            </label>
            <button className="login-submit" type="submit" disabled={loading || !email.trim()}><span>{loading ? '…' : t('auth.sendReset')}</span><BackIcon size={17} /></button>
          </form>
        )}

        <button type="button" className="forgot-back-button" onClick={() => onNavigate('login')}><BackIcon size={16} /> {t('auth.backToSignIn')}</button>
      </div>
    </main>
  );
}
