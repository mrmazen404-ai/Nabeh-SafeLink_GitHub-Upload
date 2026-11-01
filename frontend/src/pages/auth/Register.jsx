import { useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, UserIcon, MailIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import './login.css';
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

function CheckIcon({ size = 16, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;
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
  const [successMsg, setSuccessMsg] = useState('');
  const timerRef = useRef(null);

  // Password criteria checklist states
  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password || !displayName.trim() || !confirmPassword) {
      setError(t('auth.requiredFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!hasLength || !hasUpper || !hasLower || !hasNumber) {
      setError(t('auth.passwordLength'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const response = await register(email.trim(), password, displayName.trim());
      setSuccessMsg(response.message || t('auth.registerSuccessDefault'));
      timerRef.current = setTimeout(() => onNavigate('verify-otp', { email: email.trim() }), 1800);
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(
        status === 503
          ? t('auth.emailDeliveryError')
          : status === 429
            ? (dir === 'rtl' ? 'تم تجاوز حد محاولات التسجيل مؤقتًا. حاول لاحقًا.' : 'Registration attempts are temporarily limited. Please try again later.')
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

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span className="login-field-icon"><UserIcon size={19} color="currentColor" /></span>
            <input type="text" dir={dir} autoComplete="name" placeholder={t('auth.fullName')} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setError(''); }} aria-label={t('auth.fullName')} required />
          </label>

          <label className="login-field">
            <span className="login-field-icon"><MailIcon size={19} color="currentColor" /></span>
            <input type="email" dir={dir} autoComplete="email" placeholder={t('auth.emailAddress')} value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} aria-label={t('auth.emailAddress')} required />
          </label>

          <label className="login-field">
            <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
            <input type={showPassword ? 'text' : 'password'} dir={dir} autoComplete="new-password" maxLength={128} placeholder={t('auth.password')} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} aria-label={t('auth.password')} required />
            <button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}>{showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}</button>
          </label>

          {/* Password criteria checklist */}
          {password.length > 0 && (
            <div className="password-criteria-box" aria-label="Password requirements checklist">
              <p className="criteria-title">{t('auth.passwordCriteriaTitle')}</p>
              <ul className="criteria-list">
                <li className={hasLength ? 'met' : 'unmet'}><span className="criteria-icon"><CheckIcon size={13} /></span><span>{t('auth.criteriaLength')}</span></li>
                <li className={hasUpper ? 'met' : 'unmet'}><span className="criteria-icon"><CheckIcon size={13} /></span><span>{t('auth.criteriaUppercase')}</span></li>
                <li className={hasLower ? 'met' : 'unmet'}><span className="criteria-icon"><CheckIcon size={13} /></span><span>{t('auth.criteriaLowercase')}</span></li>
                <li className={hasNumber ? 'met' : 'unmet'}><span className="criteria-icon"><CheckIcon size={13} /></span><span>{t('auth.criteriaNumber')}</span></li>
                <li className={hasSymbol ? 'met' : 'unmet'}><span className="criteria-icon"><CheckIcon size={13} /></span><span>{t('auth.criteriaSymbol')}</span></li>
              </ul>
            </div>
          )}

          <label className="login-field">
            <span className="login-field-icon"><LockIcon size={19} color="currentColor" /></span>
            <input type={showConfirmPassword ? 'text' : 'password'} dir={dir} autoComplete="new-password" maxLength={128} placeholder={t('auth.confirmPassword')} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }} aria-label={t('auth.confirmPassword')} required />
            <button type="button" className="login-password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}>{showConfirmPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}</button>
          </label>

          {confirmPassword.length > 0 && password !== confirmPassword && (
            <div className="password-mismatch-hint" role="alert">{t('auth.passwordMismatch')}</div>
          )}

          {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
          {successMsg && <div className="register-success" role="status" aria-live="polite">{successMsg}</div>}

          <button className="login-submit" type="submit" disabled={loading}><span>{loading ? '…' : t('auth.registerAction')}</span><SubmitArrow size={17} /></button>
        </form>

        <p className="register-footer">{t('auth.alreadyAccount')} <button type="button" onClick={() => onNavigate('login')}>{t('auth.login')}</button></p>
      </div>
    </main>
  );
}
