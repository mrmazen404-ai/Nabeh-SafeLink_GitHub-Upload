import { useEffect, useState, useMemo, useRef } from 'react';
import { UnifiedLoadingGate } from './SessionCheckScreen';
import { useLanguage } from '../context/LanguageContext';

export default function LoadingScreen({ url, scanType = 'URL', onCancel }) {
  const { t, lang } = useLanguage();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(5);
  const [showTimeoutNotice, setShowTimeoutNotice] = useState(false);
  const startTimeRef = useRef(Date.now());

  const isText = scanType === 'TEXT';
  const isArabic = lang === 'ar';

  const messages = useMemo(() => {
    if (isText) {
      return isArabic
        ? [
            'جاري تحليل نص الرسالة وإشارات الاستدراج المحتملة...',
            'مراجعة المعلومات المتاحة؛ هوية المرسل لا تُوثق بهذا الفحص...',
            'فحص الروابط المضمنة بحثاً عن مؤشرات خطر...',
            'فصل ادعاءات الرسالة عن أدلة فحص الرابط...',
            'إعداد ملخص النتائج وخطوات الحذر المناسبة...',
          ]
        : [
            'Analyzing message wording and possible social-engineering signals...',
            'Reviewing available information; sender identity is not verified by this scan...',
            'Checking embedded links for risk indicators...',
            'Separating message claims from link-analysis evidence...',
            'Preparing findings and cautious next steps...',
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
  }, [isText, isArabic, t]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const TARGET_DURATION_MS = 8000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const calculated = Math.min(92, Math.floor(5 + (elapsed / TARGET_DURATION_MS) * 87));
      setProgress(calculated);
    }, 100);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (messages.length <= 1) return undefined;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1800);

    return () => clearInterval(interval);
  }, [messages.length]);

  useEffect(() => {
    const timeoutTimer = setTimeout(() => {
      setShowTimeoutNotice(true);
    }, 22000);

    return () => clearTimeout(timeoutTimer);
  }, []);

  const badgeText = isText
    ? isArabic ? 'فحص أمني دقيق للرسائل' : 'SMS Security Analysis'
    : isArabic ? 'فحص فوري ودقيق للروابط' : 'URL Security Scan';

  const title = isText
    ? isArabic ? 'جارِ تحليل الرسالة والروابط المضمنة' : 'Analyzing SMS & Embedded Links'
    : t('loading.title') || (isArabic ? 'جارِ فحص وتأمين الرابط' : 'Scanning & Securing URL');

  const subtitle = isArabic
    ? 'فحص محمي بالكامل عبر الذكاء الاصطناعي ومحركات الأمان العالمية'
    : 'Scanned via AI agents & global security engines';

  const currentStatusText = messages[messageIndex] || (isArabic ? 'جارِ معالجة الفحص...' : 'Processing scan...');

  return (
    <UnifiedLoadingGate
      badgeText={badgeText}
      title={title}
      subtitle={subtitle}
      statusText={showTimeoutNotice ? (isArabic ? 'يستغرق الفحص وقتاً أطول للتحقق الميداني المباشر...' : 'Deep web research is taking a moment...') : currentStatusText}
      progress={progress}
      scanUrl={url}
      scanType={scanType}
      onCancel={onCancel}
    />
  );
}
