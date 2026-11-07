import { useEffect, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import PasswordRequirements from './PasswordRequirements';
import { isPasswordCompliant } from './authValidation';
import './login.css';
import './password-requirements.css';
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

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const token = hashParams.get('access_token') || queryParams.get('access_token') || sessionStorage.getItem('nabeh_recovery_token') || '';
    setRecoveryToken(token);
    if (token) {
      // Keep the short-lived recovery token available after removing it from the address bar.
      try { sessionStorage.setItem('nabeh_recovery_token', token); } catch { /* state still holds the token for this view */ }
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
    if (!isPasswordCompliant(newPassword)) {
      setError(t('auth.passwordRequirementsError'));
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
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(
        status === 401
          ? t('auth.resetInvalid')
          : !requestError?.response
            ? t('auth.networkError')
            : status >= 500
              ? t('auth.serviceUnavailable')
              : t('auth.resetError'),
      );
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRightIcon : ArrowLeftIcon;
  const passwordMatches = confirmPassword.length > 0 && newPassword === confirmPassword;

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
          <section className="reset-success" aria-labelledby="reset-success-title">
            <span className="reset-success-icon" aria-hidden="true"><CheckCircleIcon size={24} color="currentColor" /></span>
            <h2 id="reset-success-title">{t('auth.passwordUpdated')}</h2>
            <p>{t('auth.passwordUpdatedDesc')}</p>
            <button type="button" className="login-submit" onClick={() => onNavigate('login')}>{t('auth.backToSignIn')}</button>
          </section>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="reset-new-password">{t('auth.newPassword')}</label>
              <div className="login-field">
                <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
                <input id="reset-new-password" name="new-password" type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password" maxLength={128} placeholder="••••••••••" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(''); }} aria-describedby="password-criteria-title" required />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
                </button>
              </div>
            </div>

            <PasswordRequirements password={newPassword} />

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="reset-confirm-password">{t('auth.confirmNewPassword')}</label>
              <div className="login-field">
                <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
                <input id="reset-confirm-password" name="confirm-new-password" type={showConfirmPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password" maxLength={128} placeholder="••••••••••" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} aria-invalid={Boolean(confirmPassword) && !passwordMatches} aria-describedby={confirmPassword && !passwordMatches ? 'reset-password-mismatch' : undefined} required />
                <button type="button" className="login-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {showConfirmPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
                </button>
              </div>
            </div>
            {confirmPassword.length > 0 && !passwordMatches && <div id="reset-password-mismatch" className="password-mismatch-hint">{t('auth.passwordMismatch')}</div>}
            {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
            <button className="login-submit" type="submit" disabled={loading || !newPassword || !confirmPassword || !recoveryToken} aria-busy={loading}>
              <span aria-live="polite">{loading ? t('auth.updatingPassword') : t('auth.updatePassword')}</span>
              <BackIcon size={17} />
            </button>
          </form>
        )}

        {!success && <button type="button" className="forgot-back-button" onClick={() => onNavigate('forgot-password')}>{BackIcon && <BackIcon size={16} />} {t('auth.requestRecovery')}</button>}
      </div>
    </main>
  );
}
