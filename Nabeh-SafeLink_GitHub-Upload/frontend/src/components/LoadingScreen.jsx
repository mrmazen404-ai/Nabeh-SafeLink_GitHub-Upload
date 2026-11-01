import { useEffect, useState, useMemo, useRef } from 'react';
import { ShieldCheckIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';
import '../styles/loading.css';

export default function LoadingScreen({ url, scanType = 'URL', onCancel }) {
  const { t, dir, lang } = useLanguage();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(5);
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);
  const startTimeRef = useRef(Date.now());

  const isText = scanType === 'TEXT';

  const messages = useMemo(() => {
    if (isText) {
      return lang === 'ar'
        ? [
            'جاري فحص الرسالة النصية ورصد أساليب الاستدراج...',
            'وكيل الذكاء الاصطناعي يحلل النص ويبحث في المصادر الرسمية عبر الويب...',
            'فحص الرابط المدمج ورصد مخاطر سرقة الحسابات ورموز OTP...',
            'تقسيم الرسالة وتحديد مدى المصداقية والأصالة المعتمدة...',
            'توليد تقرير الفحص التفسيري وخطة التصرف الآمن...',
          ]
        : [
            'Analyzing text message for smishing & fraud tactics...',
            'AI Agent searching web & verifying official sources...',
            'Auditing embedded links & detecting OTP theft risk...',
            'Segmenting message & evaluating authenticity...',
            'Generating comprehensive security & action plan report...',
          ];
    }

    const defaultMessages = [
      'جاري تحليل الرابط والتحقق الهيكلي والبروتوكولات...',
      'فحص قواعد البيانات العالمية ومحركات الفيروسات الـ 92+...',
      'تحليل الأنماط الأمنية والبنية التقنية للرابط...',
      'بحث وتدقيق الذكاء الاصطناعي للانتحال والنطاقات الرسمية...',
      'توليد تقرير الفحص التفسيري الشامل...',
    ];

    return t('loading.messages') || defaultMessages;
  }, [isText, lang, t]);

  // Deterministic, fixed-rate progress increment based on elapsed clock time (independent of CPU speed)
  useEffect(() => {
    startTimeRef.current = Date.now();
    const TARGET_DURATION_MS = 8000; // 8 seconds to reach 92% linearly

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const calculated = Math.min(92, Math.floor(5 + (elapsed / TARGET_DURATION_MS) * 87));
      setProgress(calculated);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Cycle messages on fixed clock interval
  useEffect(() => {
    if (messages.length <= 1) return undefined;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [messages.length]);

  // Timeout guard after 22s
  useEffect(() => {
    const timeoutTimer = setTimeout(() => {
      setShowTimeoutNotice(true);
    }, 22000);

    return () => clearTimeout(timeoutTimer);
  }, []);

  return (
    <div className="loading-page" role="status" aria-busy="true" dir={dir}>
      <div className="loading-bg" aria-hidden="true">
        <div className="loading-bg-shape loading-bg-shape-1" />
        <div className="loading-bg-shape loading-bg-shape-2" />
      </div>

      <div className="loading-content fade-in">
        {/* Constant-Speed Linear Animated SVG Spinner Wrapper */}
        <div className="loading-spinner-wrapper">
          <svg className="loading-svg-spinner" viewBox="0 0 120 120" width="120" height="120">
            {/* Background static circle */}
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="4" opacity="0.3" />

            {/* Outer spinning gradient ring (Strict linear constant speed) */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="5"
              strokeDasharray="180 140"
              strokeLinecap="round"
              className="svg-spin-fast"
            />

            {/* Inner counter-spinning dashed ring */}
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke="var(--color-warning)"
              strokeWidth="2"
              strokeDasharray="10 20"
              strokeLinecap="round"
              className="svg-spin-reverse"
              opacity="0.8"
            />
          </svg>

          {/* Central Animated Shield */}
          <div className="loading-icon svg-pulse-shield">
            <ShieldCheckIcon size={46} color="var(--color-secondary, #1E90FF)" />
          </div>
        </div>

        <h2 className="loading-title">
          {isText
            ? lang === 'ar'
              ? 'جاري فحص الرسالة النصية واصطياد الاحتيال'
              : 'Performing SMS Smishing & Fraud Analysis'
            : t('loading.title') || (lang === 'ar' ? 'جاري الفحص الدقيق' : 'Scanning URL')}
        </h2>

        {/* Dynamic Step Message */}
        <p className="loading-message" key={messageIndex} aria-live="polite">
          {messages[messageIndex]}
        </p>

        {/* VISUAL FIXED-RATE PROGRESS BAR */}
        <div className="loading-progress-box">
          <div className="loading-progress-header">
            <span>{lang === 'ar' ? 'نسبة إنجاز الفحص:' : 'Scan Progress:'}</span>
            <strong className="loading-progress-pct">{progress}%</strong>
          </div>
          <div className="loading-progress-track">
            <div
              className="loading-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {url && (
          <div className="loading-url-box">
            <span className="loading-url-label">
              {isText
                ? lang === 'ar'
                  ? 'نص الرسالة:'
                  : 'Message Content:'
                : t('loading.urlLabel') || (lang === 'ar' ? 'الرابط:' : 'URL:')}
            </span>
            <span className="loading-url-value" dir="auto">
              {url}
            </span>
          </div>
        )}

        {/* Timeout Notice if network is slow */}
        {showTimeoutNotice && (
          <div className="loading-timeout-notice" style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning)', fontSize: '0.85rem' }}>
            <span>{lang === 'ar' ? 'يستغرق الفحص وقتا أطول للتحقق الميداني المباشر...' : 'Deep web research is taking a moment...'}</span>
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            className="loading-cancel-btn"
            onClick={onCancel}
            style={{ marginTop: '16px' }}
          >
            {t('loading.cancelBtn') || (lang === 'ar' ? 'إلغاء الفحص' : 'Cancel Scan')}
          </button>
        )}

        <p className="loading-hint" style={{ marginTop: '14px' }}>
          {t('loading.hint') || (lang === 'ar' ? 'فحص محمي بالكامل عبر الذكاء الاصطناعي ومحركات الأمان العالمية' : 'Scanned via AI agents and global security engines')}
        </p>
      </div>
    </div>
  );
}
