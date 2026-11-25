import { useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, UserIcon, MailIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import PasswordRequirements from './PasswordRequirements';
import { isPasswordCompliant, isValidEmail, normalizeEmail } from './authValidation';
import './login.css';
import './password-requirements.css';
import './register.css';

function LockIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

function EyeIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function EyeOffIcon({ size = 20, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a18.7 18.7 0 0 1-3.1 3.8M6.3 6.3C3.6 8.1 2 12 2 12s3.5 6 10 6c1.2 0 2.3-.2 3.3-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}

export default function Register({ onNavigate }) {
  const { register } = useAuth();
  const { t, dir } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const passwordMatches = confirmPassword.length > 0 && password === confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!displayName.trim() || !normalizedEmail || !password || !confirmPassword) {
      setError(t('auth.requiredFields'));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!isPasswordCompliant(password)) {
      setError(t('auth.passwordRequirementsError'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await register(normalizedEmail, password, displayName.trim());
      if (response?.success !== true) {
        setError(t('auth.registerError'));
        return;
      }
      setRegisteredEmail(normalizedEmail);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(
        status === 503
          ? t('auth.emailDeliveryError')
          : status === 429
            ? t('auth.registrationRateLimited')
            : !requestError?.response
              ? t('auth.networkError')
              : status >= 500
                ? t('auth.serviceUnavailable')
                : t('auth.registerError'),
      );
    } finally {
      setLoading(false);
    }
  };

  const SubmitArrow = dir === 'rtl' ? ArrowLeftIcon : ArrowRightIcon;

  return (
    <main className="login-page register-page" dir={dir}>
      <AuthPageControls />
      <div className="login-shell">
        <div className="login-branding"><Logo size="lg" showTagline={false} /></div>

        <section className="login-welcome" aria-labelledby="register-title">
          <h1 id="register-title">{t('auth.createAccount')}</h1>
          <p>{t('auth.registerSubtitle')}</p>
        </section>

        {registeredEmail ? (
          <section className="register-response" role="status" aria-live="polite" aria-labelledby="register-response-title">
            <h2 id="register-response-title">{t('auth.registrationNextStepsTitle')}</h2>
            <p>{t('auth.registrationNextSteps')}</p>
            <p><strong dir="ltr">{registeredEmail}</strong></p>
            <button type="button" className="login-submit" onClick={() => onNavigate('verify-otp', { email: registeredEmail })}>
              <span>{t('auth.continueIfCodeReceived')}</span>
              <SubmitArrow size={17} />
            </button>
          </section>
        ) : (
          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="register-name">{t('auth.fullName')}</label>
              <div className="login-field">
                <span className="login-field-icon"><UserIcon size={19} color="currentColor" /></span>
                <input id="register-name" name="name" type="text" dir={dir} autoComplete="name" maxLength={100} placeholder={t('auth.fullName')} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setError(''); }} required />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="register-email">{t('auth.emailAddress')}</label>
              <div className="login-field">
                <span className="login-field-icon"><MailIcon size={19} color="currentColor" /></span>
                <input id="register-email" name="email" type="email" dir="ltr" inputMode="email" autoCapitalize="none" spellCheck="false" autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} required />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="register-password">{t('auth.password')}</label>
              <div className="login-field">
                <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
                <input id="register-password" name="new-password" type={showPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password" maxLength={128} placeholder="••••••••••" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} aria-describedby="password-criteria-title" required />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
                </button>
              </div>
            </div>

            <PasswordRequirements password={password} />

            <div className="auth-field-group">
              <label className="auth-field-label" htmlFor="register-confirm-password">{t('auth.confirmPassword')}</label>
              <div className="login-field">
                <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
                <input id="register-confirm-password" name="confirm-password" type={showConfirmPassword ? 'text' : 'password'} dir="ltr" autoComplete="new-password" maxLength={128} placeholder="••••••••••" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} aria-invalid={Boolean(confirmPassword) && !passwordMatches} aria-describedby={confirmPassword && !passwordMatches ? 'password-mismatch' : undefined} required />
                <button type="button" className="login-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}>
                  {showConfirmPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
                </button>
              </div>
            </div>

            {confirmPassword.length > 0 && !passwordMatches && <div id="password-mismatch" className="password-mismatch-hint">{t('auth.passwordMismatch')}</div>}
            {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}

            <button className="login-submit" type="submit" disabled={loading} aria-busy={loading}>
              <span aria-live="polite">{loading ? t('auth.creatingAccount') : t('auth.registerAction')}</span>
              <SubmitArrow size={17} />
            </button>
          </form>
        )}

        <p className="register-footer">{t('auth.alreadyAccount')} <button type="button" onClick={() => onNavigate('login')}>{t('auth.login')}</button></p>
      </div>
    </main>
  );
}
