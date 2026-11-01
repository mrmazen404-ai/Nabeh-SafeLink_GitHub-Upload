import { useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import './login.css';
import './reset-password.css';

function LockIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

function EyeIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function EyeOffIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a18.7 18.7 0 0 1-3.1 3.8M6.3 6.3C3.6 8.1 2 12 2 12s3.5 6 10 6c1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}

export default function ResetPassword({ onNavigate }) {
  const { resetPassword } = useAuth();
  const { t, dir, lang } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const token = hashParams.get('access_token') || queryParams.get('access_token') || sessionStorage.getItem('nabeh_recovery_token') || '';
    setRecoveryToken(token);
    if (token) {
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      setError(t('auth.resetInvalid'));
    }
  }, [lang, t]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!recoveryToken) {
      setError(t('auth.resetInvalid'));
      return;
    }
    if (newPassword.length < 12) {
      setError(t('auth.passwordLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await resetPassword(newPassword, recoveryToken);
      setRecoveryToken('');
      setSuccess(true);
      window.history.replaceState(null, '', window.location.pathname);
      timerRef.current = setTimeout(() => onNavigate('login'), 2200);
    } catch {
      setError(t('auth.resetError'));
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRightIcon : ArrowLeftIcon;

  return (
    <main className="login-page reset-page" dir={dir}>
      <AuthPageControls />
      <div className="login-shell">
        <div className="login-branding"><Logo size="lg" showTagline={false} /></div>
        <section className="login-welcome" aria-labelledby="reset-title">
          <h1 id="reset-title">{t('auth.resetTitle')}</h1>
          <p>{t('auth.resetSubtitle')}</p>
        </section>

        {success ? (
          <section className="reset-success" role="status" aria-live="polite">
            <span className="reset-success-icon"><CheckCircleIcon size={24} color="currentColor" /></span>
            <h2>{t('auth.passwordUpdated')}</h2>
            <p>{t('auth.passwordUpdatedDesc')}</p>
          </section>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-field"><span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span><input type={showPassword ? 'text' : 'password'} dir={dir} autoComplete="new-password" maxLength={128} placeholder={t('auth.newPassword')} value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(''); }} aria-label={t('auth.newPassword')} required /><button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>{showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}</button></label>
            <label className="login-field"><span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span><input type={showConfirmPassword ? 'text' : 'password'} dir={dir} autoComplete="new-password" maxLength={128} placeholder={t('auth.confirmNewPassword')} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} aria-label={t('auth.confirmNewPassword')} required /><button type="button" className="login-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}>{showConfirmPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}</button></label>
            {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
            <button className="login-submit" type="submit" disabled={loading || !newPassword || !confirmPassword || !recoveryToken}><span>{loading ? '…' : t('auth.updatePassword')}</span><BackIcon size={17} /></button>
          </form>
        )}

        {!success && <button type="button" className="forgot-back-button" onClick={() => onNavigate('forgot-password')}><BackIcon size={16} /> {t('auth.requestRecovery')}</button>}
      </div>
    </main>
  );
}
