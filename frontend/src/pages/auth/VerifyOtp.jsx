import { useEffect, useRef, useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';
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

  const updateDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setError('');
    if (digit && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
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
    } catch {
      setError(t('auth.invalidCode'));
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
    } catch (requestError) {
      setError(requestError?.response?.status === 429 ? t('auth.resendRateLimited') : t('auth.resendError'));
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
          <p>{t('auth.codeSent')} <strong dir="ltr">{maskedEmail}</strong></p>
        </section>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="otp-inputs" role="group" aria-label="6-digit verification code" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <div className="otp-input-box" key={index}>
                <input
                  ref={(element) => { inputsRef.current[index] = element; }}
                  className="otp-input"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={digit}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  aria-label={`Digit ${index + 1}`}
                />
              </div>
            ))}
          </div>

          {error && <div className="login-error" role="alert" aria-live="polite"><AlertTriangleIcon size={17} color="currentColor" /><span>{error}</span></div>}
          <button className="login-submit" type="submit" disabled={loading || otp.join('').length !== OTP_LENGTH}><span>{loading ? '…' : t('auth.verifyCode')}</span><BackIcon size={17} /></button>
        </form>

        <div className="verify-resend">
          {cooldown > 0 ? <span>{t('auth.requestCodeIn', { seconds: cooldown })}</span> : <button type="button" onClick={handleResend} disabled={resending}>{resending ? '…' : t('auth.requestNewCode')}</button>}
        </div>
        <button type="button" className="forgot-back-button" onClick={() => onNavigate(isRecovery ? 'forgot-password' : 'register')}><BackIcon size={16} /> {isRecovery ? t('auth.backToRecovery') : t('auth.backToRegister')}</button>
      </div>
    </main>
  );
}
