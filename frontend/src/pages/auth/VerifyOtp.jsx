import { useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
import { normalizeOtpDigits } from './authValidation';
import './login.css';
import './verify-otp.css';

const OTP_LENGTH = 6;

export default function VerifyOtp({ onNavigate, email = '', type = 'signup' }) {
  const { verifyOtp, resendOtp } = useAuth();
  const { t, dir } = useLanguage();
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const updateDigits = (index, value) => {
    const digits = normalizeOtpDigits(value).slice(0, OTP_LENGTH - index);
    const next = [...otp];
    if (!digits) {
      next[index] = '';
      setOtp(next);
      setError('');
      return;
    }
    digits.split('').forEach((digit, offset) => { next[index + offset] = digit; });
    setOtp(next);
    setError('');
    const focusIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = normalizeOtpDigits(event.clipboardData.getData('text')).slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((digit, index) => { next[index] = digit; });
    setOtp(next);
    setError('');
    inputsRef.current[Math.min(pasted.length, OTP_LENGTH) - 1]?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const token = otp.join('');
    if (token.length !== OTP_LENGTH) {
      setError(t('auth.invalidCode'));
      return;
    }
    if (!email.trim()) {
      setError(t('auth.missingEmail'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      await verifyOtp(email.trim(), token, type);
      sessionStorage.removeItem('nabeh_pending_otp');
      onNavigate(type === 'recovery' ? 'reset-password' : 'home');
    } catch (requestError) {
      const status = requestError?.response?.status;
      setError(
        status === 429
          ? t('auth.otpRateLimited')
          : !requestError?.response
            ? t('auth.networkError')
            : status >= 500
              ? t('auth.serviceUnavailable')
              : t('auth.invalidCode'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email.trim()) return;
    setError('');
    setResending(true);
    try {
      await resendOtp(email.trim(), type);
      setOtp(Array(OTP_LENGTH).fill(''));
      setCooldown(60);
      inputsRef.current[0]?.focus();
    } catch (requestError) {
      const status = requestError?.response?.status;
      if (status === 429) setCooldown(60);
      setError(
        status === 429
          ? t('auth.resendRateLimited')
          : status === 503
            ? t('auth.emailDeliveryError')
            : !requestError?.response
              ? t('auth.networkError')
              : status >= 500
                ? t('auth.serviceUnavailable')
                : t('auth.resendError'),
      );
    } finally {
      setResending(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRightIcon : ArrowLeftIcon;
  const isRecovery = type === 'recovery';
  const fallbackEmailLabel = t('auth.registeredEmailFallback');
  const maskedEmail = email ? email.replace(/(^.).*(@.*$)/, '$1•••$2') : fallbackEmailLabel;

  return (
    <main className="login-page verify-page" dir={dir}>
      <AuthPageControls />
      <div className="login-shell">
        <div className="login-branding"><Logo size="lg" showTagline={false} /></div>
        <section className="login-welcome verify-heading" aria-labelledby="verify-title">
          <h1 id="verify-title">{isRecovery ? t('auth.verifyRecovery') : t('auth.verifyEmail')}</h1>
          <p>{t('auth.codeEntryPrompt')} <strong dir="ltr">{maskedEmail}</strong></p>
        </section>

        <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
          <div className="otp-inputs" role="group" aria-labelledby="otp-code-label" onPaste={handlePaste}>
            <span id="otp-code-label" className="auth-field-label otp-code-label">{t('auth.otpGroupLabel')}</span>
            <div className="otp-digit-grid" dir="ltr">
              {otp.map((digit, index) => (
                <div className="otp-input-box" key={index}>
                  <input
                    ref={(element) => { inputsRef.current[index] = element; }}
                    className="otp-input"
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={OTP_LENGTH}
                    value={digit}
                    onChange={(event) => updateDigits(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    aria-label={t('auth.otpDigitLabel', { digit: index + 1 })}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
          <button className="login-submit" type="submit" disabled={loading || otp.join('').length !== OTP_LENGTH} aria-busy={loading}>
            <span aria-live="polite">{loading ? t('auth.verifyingCode') : t('auth.verifyCode')}</span>
            <BackIcon size={17} />
          </button>
        </form>

        <div className="verify-resend" aria-live="polite">
          {cooldown > 0 ? <span>{t('auth.requestCodeIn', { seconds: cooldown })}</span> : <button type="button" onClick={handleResend} disabled={resending} aria-busy={resending}>{resending ? t('auth.resendingCode') : t('auth.requestNewCode')}</button>}
        </div>
        <button type="button" className="forgot-back-button" onClick={() => onNavigate(isRecovery ? 'forgot-password' : 'register')}><BackIcon size={16} /> {isRecovery ? t('auth.backToRecovery') : t('auth.backToRegister')}</button>
      </div>
    </main>
  );
}
