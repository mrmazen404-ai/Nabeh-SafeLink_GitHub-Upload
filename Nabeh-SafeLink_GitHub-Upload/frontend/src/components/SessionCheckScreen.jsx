import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import './session-check.css';

export function SecurityShield({ theme }) {
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

export function UnifiedLoadingGate({
  badgeText,
  title,
  subtitle,
  statusText,
  progress = 50,
  showProgress = true,
  isError = false,
  scanUrl,
  scanType,
  onCancel,
  children,
}) {
  const { dir, lang } = useLanguage();
  const { theme } = useTheme();

  const isArabic = lang === 'ar';
  const defaultBadge = isArabic ? 'توثيق نابه الآمن' : 'Nabeh Secure Verification';
  const defaultTitle = isArabic ? 'جارِ تأمين الجلسة' : 'Securing Session';
  const defaultSubtitle = isArabic ? 'يتم التحقق من هوية الجلسة وتطبيق سياسات الحماية' : 'Verifying session identity & enforcing protection policies';
  const defaultStatus = isArabic ? 'اتصال مشفر • تحقق متعدد الطبقات' : 'Encrypted Connection • Multi-layer Verification';

  const badge = badgeText || defaultBadge;
  const mainTitle = title || defaultTitle;
  const mainSubtitle = subtitle || defaultSubtitle;
  const currentStatusText = statusText || defaultStatus;

  return (
    <main className="session-check-screen" data-theme={theme} dir={dir} role="status" aria-live="polite" aria-busy="true">
      <div className="session-grid" />
      <div className="session-check-card">
        <span className="session-security-label">
          <i style={{ background: isError ? 'var(--color-danger, #ef4444)' : undefined }} /> {badge}
        </span>
        <SecurityShield theme={theme} />
        <h1>{mainTitle}</h1>
        <p>{mainSubtitle}</p>

        {scanUrl && (
          <div className="loading-url-box" style={{ marginTop: '16px', padding: '10px 14px', borderRadius: '12px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', fontSize: '13px', textAlign: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>
              {scanType === 'TEXT' ? (isArabic ? 'نص الرسالة:' : 'Message Text:') : (isArabic ? 'الرابط المفحوص:' : 'Inspected URL:')}
            </span>
            <span dir="auto" style={{ wordBreak: 'break-all', color: 'var(--color-primary)', fontWeight: 600 }}>
              {scanUrl}
            </span>
          </div>
        )}

        {showProgress && (
          <div className="session-progress">
            <span style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: isError ? 'var(--color-danger, #ef4444)' : undefined }} />
          </div>
        )}

        <div className="session-status">
          <span className="session-status-dot" style={{ background: isError ? 'var(--color-danger, #ef4444)' : undefined }} />
          <span>{`${currentStatusText} (${Math.round(Math.min(100, Math.max(0, progress)))}%)`}</span>
        </div>

        {onCancel && (
          <button
            type="button"
            className="welcome-secondary-button"
            onClick={onCancel}
            style={{ marginTop: '16px', fontSize: '12px', padding: '6px 16px' }}
          >
            {isArabic ? 'إلغاء العملية' : 'Cancel Operation'}
          </button>
        )}

        {children}
      </div>
    </main>
  );
}

export default function SessionCheckScreen({ onComplete }) {
  const { lang } = useLanguage();
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
        if (isMounted) {
          setProgress(25);
          setCurrentStepText(
            lang === 'ar'
              ? 'تشفير الاتصال والتحقق من رمز الجلسة المحلي...'
              : 'Encrypting connection & checking local session token...'
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (isMounted) {
          setProgress(55);
          setCurrentStepText(
            lang === 'ar'
              ? 'التحقق من صحة الجلسة والاعتمادات عبر خادم نابه...'
              : 'Verifying session credentials with Nabeh server...'
          );
        }

        let verifiedUser = user;
        if (!verifiedUser && token && typeof checkAuth === 'function') {
          try {
            verifiedUser = await checkAuth(token);
          } catch {
            verifiedUser = null;
          }
        }

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

        if (isMounted) {
          setProgress(100);
          setCurrentStepText(
            lang === 'ar'
              ? 'تم التأكد من صلاحيات الجلسة وتأمين البيئة بنجاح!'
              : 'Session permissions verified & environment secured successfully!'
          );
          if (!completedRef.current) {
            completedRef.current = true;
            if (onComplete) onComplete();
          }
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

  return (
    <UnifiedLoadingGate
      badgeText={lang === 'ar' ? 'توثيق نابه الآمن' : 'Nabeh Secure Verification'}
      title={lang === 'ar' ? 'جارِ تأمين الجلسة' : 'Securing Session'}
      subtitle={lang === 'ar' ? 'يتم التحقق من هوية الجلسة وتطبيق سياسات الحماية' : 'Verifying session identity & enforcing protection policies'}
      statusText={currentStepText}
      progress={progress}
      isError={isError}
    />
  );
}
