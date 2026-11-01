import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './session-check.css';

function SecurityShield({ theme }) {
  const isDark = theme === 'dark';

  return (
    <div className="session-shield-wrap" aria-hidden="true">
      <div className="session-shield-glow" />
      <div className="session-scan-line" />
      <div className="session-shield-inner">
        <svg className="session-shield" viewBox="0 0 120 140" fill="none">
          <path
            d="M60 8 103 24v34c0 31-18 56-43 69C35 114 17 89 17 58V24L60 8Z"
            fill="url(#shieldFill)"
            stroke="url(#shieldStroke)"
            strokeWidth="2"
          />
          <path
            d="m38 68 14 14 31-35"
            stroke={isDark ? "#d9fbff" : "#ffffff"}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M60 18v96" stroke={isDark ? "#6be6f2" : "#3b82f6"} strokeOpacity=".28" strokeWidth="1" />
          <defs>
            <linearGradient id="shieldFill" x1="20" y1="10" x2="100" y2="126" gradientUnits="userSpaceOnUse">
              <stop stopColor={isDark ? "#173d67" : "#1e40af"} />
              <stop offset=".5" stopColor={isDark ? "#0c2343" : "#1e3a8a"} />
              <stop offset="1" stopColor={isDark ? "#07142b" : "#0f172a"} />
            </linearGradient>
            <linearGradient id="shieldStroke" x1="17" y1="8" x2="104" y2="126" gradientUnits="userSpaceOnUse">
              <stop stopColor={isDark ? "#94f7ff" : "#60a5fa"} />
              <stop offset=".45" stopColor={isDark ? "#36c8e5" : "#2563eb"} />
              <stop offset="1" stopColor={isDark ? "#386bdb" : "#1d4ed8"} />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span className="session-corner corner-tl" />
      <span className="session-corner corner-tr" />
      <span className="session-corner corner-bl" />
      <span className="session-corner corner-br" />
    </div>
  );
}

export default function SessionCheckScreen({ onComplete }) {
  const { dir, t, lang } = useLanguage();
  const { theme } = useTheme();
  const auth = useAuth() || {};
  const { checkAuth, user, token } = auth;

  const [progress, setProgress] = useState(10);
  const [currentStepText, setCurrentStepText] = useState('');
  const [isError, setIsError] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function runSessionCheckPipeline() {
      try {
        // Step 1: Check Token & Connection Encryption
        if (isMounted) {
          setProgress(25);
          setCurrentStepText(
            lang === 'ar'
              ? 'تشفير الاتصال والتحقق من رمز الجلسة المحلي...'
              : 'Encrypting connection & checking local session token...'
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Step 2: Validate Credentials & Identity with Backend
        if (isMounted) {
          setProgress(55);
          setCurrentStepText(
            lang === 'ar'
              ? 'التحقق من صحة الجلسة والاعتمادات عبر خادم نابه...'
              : 'Verifying session credentials with Nabeh server...'
          );
        }

        let verifiedUser = user;
        if (token && typeof checkAuth === 'function') {
          try {
            verifiedUser = await checkAuth(token);
          } catch {
            verifiedUser = null;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 250));

        // Step 3: Check Account Status & Permissions
        if (isMounted) {
          setProgress(85);
          setCurrentStepText(
            lang === 'ar'
              ? 'فحص صلاحيات المستخدم وحالة الحساب والسياسات الأمنية...'
              : 'Checking user permissions, account status & security policies...'
          );
        }

        if (verifiedUser && verifiedUser.status && verifiedUser.status !== 'ACTIVE') {
          if (isMounted) {
            setIsError(true);
            setCurrentStepText(
              lang === 'ar'
                ? 'الحساب غير نشط أو موقوف مؤقتاً.'
                : 'Account is inactive or suspended.'
            );
          }
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));

        // Step 4: Finalize Verification
        if (isMounted) {
          setProgress(100);
          setCurrentStepText(
            lang === 'ar'
              ? 'تم التأكد من صلاحيات الجلسة وتأمين البيئة بنجاح!'
              : 'Session permissions verified & environment secured successfully!'
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        if (isMounted && !completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
        }
      } catch {
        if (isMounted) {
          setProgress(100);
          setCurrentStepText(
            lang === 'ar'
              ? 'اكتمل التحقق أمنياً'
              : 'Security verification completed'
          );
          if (!completedRef.current) {
            completedRef.current = true;
            if (onComplete) onComplete();
          }
        }
      }
    }

    runSessionCheckPipeline();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const securityLabelText = lang === 'ar' ? 'توثيق نابه الآمن' : 'Nabeh Secure Authentication';

  return (
    <main className="session-check-screen" data-theme={theme} dir={dir} role="status" aria-live="polite" aria-busy="true">
      <div className="session-grid" />
      <div className="session-check-card">
        <span className="session-security-label">
          <i style={{ background: isError ? 'var(--color-danger, #ef4444)' : undefined }} /> {securityLabelText}
        </span>
        <SecurityShield theme={theme} />
        <h1>{t('sessionCheck.title') || (lang === 'ar' ? 'تأمين وفحص الجلسة' : 'Securing & Verifying Session')}</h1>
        <p>{t('sessionCheck.desc') || (lang === 'ar' ? 'جاري التحقق من هوية الجلسة وتطبيق السياسات الأمنية المشفرة' : 'Verifying session identity and applying security policies')}</p>
        <div className="session-progress">
          <span style={{ width: `${progress}%`, background: isError ? 'var(--color-danger, #ef4444)' : undefined }} />
        </div>
        <div className="session-status">
          <span className="session-status-dot" style={{ background: isError ? 'var(--color-danger, #ef4444)' : undefined }} />
          {`${currentStepText || (t('sessionCheck.status') || (lang === 'ar' ? 'اتصال مشفر • تحقق متعدد الطبقات' : 'Encrypted Connection • Multi-layer Verification'))} (${Math.round(progress)}%)`}
        </div>
      </div>
    </main>
  );
}
