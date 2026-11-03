import { useState } from 'react';
import Header from './Header';
import { useLanguage } from '../context/LanguageContext';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  HelpCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  PinIcon,
  RefreshIcon,
  ClipboardIcon,
  LinkIcon,
  MailIcon,
  CpuIcon
} from './Icons';
import '../styles/result.css';

export default function SmsResultScreen({ result, onReset, activeTab, setActiveTab, isGuest = true, onNavigateAuth }) {
  const { t, dir, lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  const classification = result?.classification || 'UNKNOWN';

  const CONFIG = {
    SAFE: {
      icon: HelpCircleIcon,
      labelAr: 'لم تظهر مؤشرات خطر كافية',
      labelEn: 'No sufficient risk indicators',
      title: lang === 'ar' ? 'لم تظهر مؤشرات خطر كافية' : 'No sufficient risk indicators found',
      description: lang === 'ar'
        ? 'هذه النتيجة لا تثبت أن الرسالة آمنة أو أن مرسلها رسمي؛ تحقّق من الجهة عبر قناة تصل إليها بنفسك.'
        : 'This does not prove the message is safe or the sender is official; verify through a channel you access independently.',
      className: 'unknown',
    },
    SUSPICIOUS: {
      icon: AlertTriangleIcon,
      labelAr: 'رسالة مشبوهة بحاجة للحذر',
      labelEn: 'Suspicious Text Message',
      title: lang === 'ar' ? 'تنبيه: رسالة نصية مشبوهة (تحتاج تحقق)' : 'Warning: Suspicious Text Message',
      description: lang === 'ar'
        ? 'رصد التحليل صياغة أو مؤشرات تستدعي الحذر؛ لا تثبت وحدها أن الرسالة احتيالية. تحقق عبر قناة رسمية تصل إليها بنفسك.'
        : 'The analysis found wording or signals that warrant caution; this alone does not prove fraud. Verify through an official channel you access independently.',
      className: 'suspicious',
    },
    DANGEROUS: {
      icon: XCircleIcon,
      labelAr: 'رسالة عالية الخطورة',
      labelEn: 'High-risk SMS',
      title: lang === 'ar' ? 'تحذير: أظهر الفحص مؤشرات خطر قوية' : 'Warning: The scan found strong risk signals',
      description: lang === 'ar'
        ? 'أظهر الرابط المضمّن أو التحليل المتاح مؤشرات خطر قوية؛ هذا لا يثبت هوية المرسل أو نيته. لا تفتح الرابط ولا تشارك كلمات المرور أو رموز التحقق.'
        : 'The embedded link or available analysis showed strong risk signals; this does not verify the sender or intent. Do not open the link or share credentials or verification codes.',
      className: 'dangerous',
    },
    UNKNOWN: {
      icon: HelpCircleIcon,
      labelAr: 'نتيجة غير محددة',
      labelEn: 'Inconclusive Result',
      title: lang === 'ar' ? 'تعذر الجزم في نص الرسالة' : 'Inconclusive SMS Analysis',
      description: lang === 'ar'
        ? 'لم تتوفر معلومات كافية لتقييم مصداقية النص عبر الإنترنت. توخَّ الحذر ولا تشارك بياناتك الحساسة.'
        : 'Insufficient evidence to provide a conclusive verdict. Exercise caution with sensitive data.',
      className: 'unknown',
    },
  };

  const config = CONFIG[classification] || CONFIG.UNKNOWN;
  const StatusIcon = config.icon;
  // SMS risk scores are withheld until an independently calibrated SMS model exists.
  const fraudProb = null;
  const vt = result?.virustotal || {};
  const ml = result?.ml_model || {};
  const exp = result?.explanation || {};
  const messageText = result?.input_value || '';
  const extractedUrl = result?.extracted_url || null;
  const extractedUrls = Array.isArray(result?.extracted_urls) && result.extracted_urls.length
    ? result.extracted_urls
    : (extractedUrl ? [extractedUrl] : []);
  const linkAnalyses = Array.isArray(result?.embedded_url_analyses) && result.embedded_url_analyses.length
    ? result.embedded_url_analyses
    : (extractedUrl ? [{ url: extractedUrl, classification: 'UNKNOWN', ml_classification: 'UNKNOWN', ml_source: 'UNAVAILABLE', virustotal: { status: 'UNKNOWN', total_engines: 0 } }] : []);
  const linksScannedCount = Number(result?.links_scanned_count ?? linkAnalyses.length);
  const linksNotScannedCount = Number(result?.links_not_scanned_count || 0);
  const scannedUrlSet = new Set(linkAnalyses.map((item) => item?.url).filter(Boolean));
  const unscannedUrls = Array.isArray(result?.unscanned_urls)
    ? result.unscanned_urls
    : extractedUrls.filter((url) => !scannedUrlSet.has(url));
  const unscannedUrlCandidates = Array.isArray(result?.unscanned_url_candidates)
    ? result.unscanned_url_candidates
    : [];
  const provider = String(exp?.provider || result?.source || '').toUpperCase();
  const usesGemini = provider.includes('GEMINI');
  const geminiClassification = exp?.classification || result?.stages?.stage3_gemini_sms?.classification || '';
  const providerName = (() => {
    if (provider.includes('LOCAL') || provider.includes('FALLBACK') || provider.includes('RULES')) {
      return lang === 'ar' ? 'تحليل محلي احتياطي' : 'Local fallback analysis';
    }
    if (provider.includes('GEMINI')) return lang === 'ar' ? 'تحليل الذكاء الاصطناعي' : 'AI security analysis';
    return lang === 'ar' ? 'تحليل أمني' : 'Security analysis';
  })();
  const isInvalidOrGenericPortal = (url) => {
    if (!url) return true;
    const lower = String(url).toLowerCase().trim();
    return (
      lower === 'غير متاح' ||
      lower === 'n/a' ||
      lower === 'not applicable' ||
      lower === 'none' ||
      lower === 'null' ||
      lower === 'undefined' ||
      lower === 'غير انطباقي' ||
      lower === 'لا يوجد'
    );
  };
  const rawPortal = exp?.official_portal_url;
  const officialPortal = rawPortal && !isInvalidOrGenericPortal(rawPortal) ? rawPortal : null;
  const hasCuratedPortal = exp?.portal_source === 'CURATED_ALLOWLIST';
  const portalHref = hasCuratedPortal && officialPortal
    ? (String(officialPortal).startsWith('http') ? officialPortal : `https://${officialPortal}`)
    : null;
  const actionSteps = Array.isArray(exp?.action_plan_steps) && exp.action_plan_steps.length > 0 ? exp.action_plan_steps : [];

  const handleCopyReport = () => {
    if (isGuest || !navigator.clipboard?.writeText) return;
    const reportText = `Nabeh SafeLink SMS Security Analysis Report:\nMessage: ${messageText}\nClassification: ${config.title}\nFraud Risk: Not reported (no calibrated SMS score)\nClaimed Sender: ${exp.claimed_sender || 'N/A'}\nReference Domain (does not verify sender): ${exp.official_domain || 'N/A'}\nPortal (not independently verified): ${officialPortal || 'N/A'}\nRecommendation: ${exp.recommendation || 'تحقق من المصدر الرسمي للرسالة.'}`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="result-page sms-result-theme" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container">
        <div className="result-desktop-grid">
          {/* Main SMS Smishing Analysis Panel */}
          <section className="card result-main-card" aria-label="شاشة نتيجة فحص الرسائل النصية">
            {/* Status Badge */}
            <div className={`result-badge result-badge-${config.className}`} role="status">
              <StatusIcon size={32} color="currentColor" />
              <div className="result-badge-labels">
                <span className="result-badge-ar">{config.labelAr}</span>
                <span className="result-badge-en">{config.labelEn} • {lang === 'ar' ? 'مؤشرات متاحة، وليس تحققًا رسميًا' : 'Available signals, not official verification'}</span>
              </div>
            </div>

            <div className="result-trust-strip">
              <span className="result-trust-title">
                {lang === 'ar' ? 'تحليل أمان الرسائل النصية والهندسة الاجتماعية' : 'SMS TEXT & SOCIAL ENGINEERING AUDIT'}
              </span>
              <span><MailIcon size={14} />{lang === 'ar' ? 'تحليل الرسالة ومخاطر الروابط' : 'SMS and Link Risk Analysis'}</span>
              <span><SparklesIcon size={14} />{lang === 'ar' ? 'مصادر خارجية عند توفرها' : 'External sources when available'}</span>
              {usesGemini && <span><SparklesIcon size={14} />Google Gemini</span>}
            </div>

            {/* Inspected SMS Content Card */}
            <div className="inspected-url-box" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', borderRadius: '12px', padding: '16px' }}>
              <span className="url-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-secondary)', fontWeight: 'bold' }}>
                <MailIcon size={18} color="var(--color-secondary)" />
                {lang === 'ar' ? 'نص الرسالة المفحوصة (SMS Text Content):' : 'Inspected SMS Text:'}
              </span>
              <div className="url-text" dir="auto" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '10px', fontSize: '1rem', lineHeight: '1.6', color: 'var(--color-text-primary)' }}>
                {messageText}
              </div>

              {(extractedUrls.length > 0 || unscannedUrlCandidates.length > 0) && (
                <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed var(--color-border-subtle)', fontSize: '0.9rem', color: 'var(--color-warning)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <LinkIcon size={16} color="currentColor" />
                    <strong>{extractedUrls.length > 0
                      ? (lang === 'ar' ? `الروابط المستخرجة (${extractedUrls.length}):` : `Links extracted (${extractedUrls.length}):`)
                      : (lang === 'ar' ? 'عُثر على صيغ روابط مموّهة:' : 'Defanged link patterns found:')}</strong>
                  </div>
                  {extractedUrls.length > 0 && (
                    <>
                      <ul style={{ margin: 0, paddingInlineStart: '22px', display: 'grid', gap: '6px' }}>
                        {extractedUrls.map((url, index) => (
                          <li key={`${url}-${index}`} dir="ltr" style={{ wordBreak: 'break-all', fontWeight: 'bold' }}>{url}</li>
                        ))}
                      </ul>
                      <div style={{ marginTop: '8px' }}>
                        {lang === 'ar'
                          ? `أُحيل ${linksScannedCount} رابط إلى التحليل؛ عدد محركات الفحص يختلف حسب توفر المزود.`
                          : `${linksScannedCount} link(s) were sent for analysis; engine availability varies.`}
                        {linksNotScannedCount > 0 && (
                          <strong style={{ display: 'block', color: 'var(--color-danger)', marginTop: '4px' }}>
                            {lang === 'ar' ? `تنبيه: ${linksNotScannedCount} رابط لم يُفحص بسبب حد المعالجة؛ لا تفتحه.` : `Warning: ${linksNotScannedCount} link(s) were not scanned due to the processing limit; do not open them.`}
                          </strong>
                        )}
                      </div>
                    </>
                  )}
                  {unscannedUrlCandidates.length > 0 && (
                    <div role="alert" style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--color-danger-border)', borderRadius: '8px', color: 'var(--color-danger)' }}>
                      <strong>{lang === 'ar' ? 'لم تُفحص هذه الصيغ المموّهة ولم يتم تحويلها إلى روابط فعلية:' : 'These defanged patterns were not scanned or converted to live URLs:'}</strong>
                      <ul style={{ margin: '6px 0', paddingInlineStart: '22px' }}>
                        {unscannedUrlCandidates.map((candidate, index) => (
                          <li key={`${candidate}-${index}`} dir="ltr" style={{ wordBreak: 'break-all' }}>{candidate}</li>
                        ))}
                      </ul>
                      <span>{lang === 'ar' ? 'لا تُفكّها أو تفتحها إلا بعد التأكد من المصدر.' : 'Do not decode or open them unless you have verified the source.'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <h2 className="result-title">{config.title}</h2>
            <p className="result-desc">{config.description}</p>

            {/* Fraud Risk Gauge Bar */}
            {fraudProb !== null && (
              <div className="confidence-block" style={{ marginTop: '18px', padding: '16px', background: 'var(--color-bg-subtle)', borderRadius: '12px', border: '1px solid var(--color-border-subtle)' }}>
                <div className="confidence-header" style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{lang === 'ar' ? 'مقياس نسبة احتمالية الاحتيال (Fraud Risk Probability Gauge):' : 'Fraud Risk Probability Gauge:'}</span>
                  <span className={`confidence-value confidence-value-${config.className}`} style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                    {fraudProb}%
                  </span>
                </div>
                <div className="confidence-bar" style={{ height: '10px', borderRadius: '5px' }}>
                  <div className={`confidence-fill confidence-fill-${config.className}`} style={{ width: `${Math.max(4, Number(fraudProb))}%`, borderRadius: '5px' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-subtle)', marginTop: '6px' }}>
                  <span>{lang === 'ar' ? 'آمن (0%)' : 'Safe (0%)'}</span>
                  <span>{lang === 'ar' ? 'مشبوه (50%)' : 'Suspicious (50%)'}</span>
                  <span>{lang === 'ar' ? 'خطير جداً (100%)' : 'Dangerous (100%)'}</span>
                </div>
              </div>
            )}

            {/* AI Agent Internet Research & Verification Card */}
            <div className="explanation-block" style={{ marginTop: '24px' }}>
              <div className="explanation-header">
                <h3 className="details-title">
                  <SparklesIcon size={18} color="var(--color-secondary)" />
                  <span>{lang === 'ar' ? 'تفسير النتيجة والأدلة المتاحة:' : 'Result interpretation and available evidence:'}</span>
                </h3>
                <span className="gemini-tag">{providerName}</span>
              </div>

              {exp.summary && <p className="explanation-text" style={{ fontSize: '0.95rem', lineHeight: '1.7' }}>{exp.summary}</p>}
              {geminiClassification && (
                <div className="explanation-text" style={{ marginTop: '10px', fontWeight: 600 }}>
                  {usesGemini
                    ? (lang === 'ar' ? 'تصنيف Gemini المساعد: ' : 'Gemini supporting classification: ')
                    : (lang === 'ar' ? 'تصنيف التحليل الاحتياطي: ' : 'Fallback analysis classification: ')}
                  {geminiClassification}
                </div>
              )}

              {/* Hoax Claim Verdict Notice */}
              {exp.claim_verdict_explanation && (
                <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', background: classification === 'DANGEROUS' ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)', border: `1px solid ${classification === 'DANGEROUS' ? 'var(--color-danger-border)' : 'var(--color-warning-border)'}`, color: classification === 'DANGEROUS' ? 'var(--color-danger)' : 'var(--color-warning)', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangleIcon size={18} color="currentColor" />
                  <span><strong>{lang === 'ar' ? 'تقييم الادعاء وفق الأدلة المتاحة:' : 'Claim assessment from available evidence:'}</strong> {exp.claim_verdict_explanation}</span>
                </div>
              )}

              {/* Message Breakdown Grid */}
              <div style={{ marginTop: '16px', padding: '18px', borderRadius: '12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', fontWeight: '600' }}>{lang === 'ar' ? 'الجهة التي تذكرها الرسالة (غير متحقق منها):' : 'Entity claimed by message (unverified):'}</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-primary)' }}>{exp.claimed_sender || (lang === 'ar' ? 'جهة غير محددة' : 'Unverified Sender')}</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', fontWeight: '600' }}>{lang === 'ar' ? 'نطاق مرجعي محتمل (لا يثبت هوية المرسل):' : 'Reference domain (does not verify sender):'}</span>
                    <strong dir="ltr" style={{ fontSize: '0.95rem', color: 'var(--color-success)' }}>{exp.official_domain || (lang === 'ar' ? 'غير متاح' : 'N/A')}</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', fontWeight: '600' }}>{lang === 'ar' ? 'نمط محتمل للرسالة:' : 'Possible message pattern:'}</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-warning)' }}>{exp.lure_type || (lang === 'ar' ? 'غير محدد' : 'Undetermined')}</strong>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', fontWeight: '600' }}>{lang === 'ar' ? 'حالة الأصالة والمصداقية:' : 'Authenticity Status:'}</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-subtle)' }}>
                      {exp.authenticity_status || (lang === 'ar' ? 'لم يتم التحقق من هوية المرسل' : 'Sender identity not verified')}
                    </strong>
                  </div>
                </div>
              </div>

              <div role="note" style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '12px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-subtle)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                {lang === 'ar'
                  ? 'لا نعرض درجات رقمية للضغط أو سرقة البيانات أو الانتحال قبل معايرتها والتحقق منها على مجموعة مستقلة.'
                  : 'Numeric urgency, credential-theft, and impersonation scores are withheld until independently validated and calibrated.'}
              </div>

              {Array.isArray(exp.reasons) && exp.reasons.length > 0 && (
                <ul className="reasons-list" style={{ marginTop: '18px' }}>
                  {exp.reasons.map((reason, i) => (
                    <li key={i}>
                      <PinIcon size={14} color="var(--color-secondary)" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* OFFICIAL PORTAL & STEP-BY-STEP ACTION PLAN */}
              <div style={{ marginTop: '24px', padding: '20px', borderRadius: '14px', background: 'var(--color-secondary-subtle)', border: '1px solid var(--color-secondary)', boxShadow: '0 4px 12px rgba(30,94,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheckIcon size={24} color="var(--color-secondary)" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                      {lang === 'ar' ? 'خطوات أمان مقترحة:' : 'Suggested safety steps:'}
                    </h3>
                  </div>

                  {portalHref && (
                    <a
                      href={portalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <LinkIcon size={14} color="#FFFFFF" />
                      <span>{lang === 'ar' ? 'فتح النطاق المرجعي' : 'Open reference domain'}</span>
                    </a>
                  )}
                </div>

                {/* Step-by-step guidance list */}
                {actionSteps.length > 0 ? (
                  <ol style={{ paddingRight: '20px', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: '1.6' }}>
                    {actionSteps.map((step, idx) => (
                      <li key={idx} style={{ fontWeight: '600' }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                ) : exp.recommendation ? (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: '1.6' }}>
                    {exp.recommendation}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Embedded Link & Engine Side Panel */}
          <aside className="result-side-panel">
            {/* Direct Link to Verified Portal Box */}
            {officialPortal && (
              <div className="card details-block" style={{ borderInlineStart: '4px solid var(--color-success)', background: 'var(--color-success-bg)' }}>
                <h3 className="details-title" style={{ color: 'var(--color-success)', fontSize: '0.95rem' }}>
                  <ShieldCheckIcon size={18} color="currentColor" />
                  <span>{lang === 'ar' ? 'نطاق مرجعي محتمل:' : 'Potential reference domain:'}</span>
                </h3>
                <div style={{ marginTop: '8px', wordBreak: 'break-all', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
                  {portalHref ? <a href={portalHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{officialPortal}</a> : officialPortal}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', marginTop: '6px', margin: 0 }}>
                  {lang === 'ar' ? (portalHref ? 'هذا نطاق مرجعي محفوظ في قائمة موثوقة؛ لا يثبت هوية الرسالة.' : 'هذا اقتراح مرجعي غير موثق؛ لا نفتحه تلقائياً ولا يثبت هوية الرسالة.') : (portalHref ? 'This is a curated reference domain; it does not verify the message identity.' : 'This is an unverified reference suggestion; it is not clickable and does not verify the message identity.')}
                </p>
              </div>
            )}

            {linkAnalyses.map((item, index) => {
              const linkVt = item?.virustotal || {};
              const linkMl = String(item?.ml_classification || 'UNKNOWN').toUpperCase();
              const linkMlSource = String(item?.ml_source || 'N/A').toUpperCase();
              const hasUsableLinkMl = linkMlSource === 'ML_MODEL'
                && ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(linkMl);
              const linkMlStatus = linkMlSource === 'INVALID_URL'
                ? (lang === 'ar' ? 'الرابط غير صالح نحوياً؛ لم يُشغّل النموذج' : 'Invalid URL syntax; model was not run')
                : linkMlSource === 'MODEL_ERROR'
                  ? (lang === 'ar' ? 'حدث خطأ أثناء تشغيل النموذج' : 'Model execution error')
                  : linkMlSource === 'MODEL_UNAVAILABLE'
                    ? (lang === 'ar' ? 'النموذج غير متاح' : 'Model unavailable')
                    : (lang === 'ar' ? 'النتيجة غير محسومة' : 'Inconclusive model result');
              const linkClassification = item?.classification || 'UNKNOWN';
              const engines = Number(linkVt.total_engines || 0);
              const label = linkClassification === 'DANGEROUS'
                ? (lang === 'ar' ? 'خطر قوي' : 'Strong risk signal')
                : linkClassification === 'SUSPICIOUS'
                  ? (lang === 'ar' ? 'مريب' : 'Suspicious')
                  : linkClassification === 'SAFE'
                    ? (lang === 'ar' ? 'لم ترصد إشارات ضمن الفحص المتاح' : 'No signals in available checks')
                    : (lang === 'ar' ? 'غير محسوم' : 'Inconclusive');
              const vtMalicious = Number(linkVt.malicious || 0);
              const vtSuspicious = Number(linkVt.suspicious || 0);
              const vtHarmless = Number(linkVt.harmless || 0);
              return (
                <div className="card details-block" key={`${item?.url || index}-${index}`} style={{ borderInlineStart: '4px solid var(--color-warning)' }}>
                  <h3 className="details-title" style={{ color: 'var(--color-warning)' }}>
                    <LinkIcon size={18} color="currentColor" />
                    <span>{lang === 'ar' ? `تحليل الرابط ${index + 1}:` : `Link analysis ${index + 1}:`}</span>
                  </h3>
                  <div dir="ltr" style={{ wordBreak: 'break-all', fontSize: '0.82rem', marginBottom: '10px' }}>{item?.url || extractedUrls[index]}</div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--color-text-primary)', margin: '0 0 10px 0' }}>
                    {lang === 'ar' ? 'نتيجة تحليل الرابط:' : 'URL analysis result:'} <strong>{label}</strong>
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-subtle)', margin: '0 0 10px 0' }}>
                    {lang === 'ar' ? 'حالة نموذج LightGBM:' : 'LightGBM model status:'} {hasUsableLinkMl
                      ? linkMl
                      : linkMlStatus}
                  </p>
                  {(engines > 0 || linkVt.status || linkVt.error) && (
                    <div className="details-grid">
                      <div className="detail-item"><span className="detail-label">{t('result.vtDangerous')}</span><span className="detail-value" style={{ color: 'var(--color-danger)' }}>{vtMalicious}</span></div>
                      <div className="detail-item"><span className="detail-label">{t('result.vtSuspicious')}</span><span className="detail-value" style={{ color: 'var(--color-warning)' }}>{vtSuspicious}</span></div>
                      <div className="detail-item"><span className="detail-label">{t('result.vtSafe')}</span><span className="detail-value" style={{ color: 'var(--color-success)' }}>{vtHarmless}</span></div>
                      <div className="detail-item"><span className="detail-label">{t('result.vtTotal')}</span><span className="detail-value">{engines}</span></div>
                      {engines === 0 && <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="detail-label">VirusTotal status</span><span className="detail-value">{linkVt.error || linkVt.status || 'UNKNOWN'}</span></div>}
                    </div>
                  )}
                  {engines > 0 && vtMalicious === 0 && vtSuspicious === 0 && (linkMl === 'DANGEROUS' || linkMl === 'SUSPICIOUS') && (
                    <p role="note" style={{ fontSize: '0.78rem', color: 'var(--color-warning)', marginTop: '8px', marginBottom: 0, padding: '6px 10px', background: 'var(--color-warning-bg)', borderRadius: '6px', border: '1px solid var(--color-warning-border)' }}>
                      {lang === 'ar'
                        ? 'لم تسجّل المحركات المتاحة رصدًا ضارًا أو مريبًا لهذا الرابط في هذا الفحص؛ غياب الرصد لا يثبت حداثة النطاق أو سلامته.'
                        : 'Available engines did not report this link as malicious or suspicious in this scan; absence of a report does not prove the domain is new or safe.'}
                    </p>
                  )}
                </div>
              );
            })}

            {unscannedUrls.map((unscannedUrl, index) => (
              <div className="card details-block" key={`unscanned-${unscannedUrl}-${index}`} role="status" style={{ borderInlineStart: '4px solid var(--color-danger)' }}>
                <h3 className="details-title" style={{ color: 'var(--color-danger)' }}>
                  <LinkIcon size={18} color="currentColor" />
                  <span>{lang === 'ar' ? `رابط غير مفحوص (${index + 1}):` : `Unscanned link (${index + 1}):`}</span>
                </h3>
                <div dir="ltr" style={{ wordBreak: 'break-all', fontSize: '0.82rem' }}>{unscannedUrl}</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginBottom: 0 }}>
                  {lang === 'ar' ? 'تجاوز الرابط حد المعالجة ولم يُرسل للفحص؛ لا تفتحه اعتمادًا على نتيجة هذه الرسالة.' : 'This link exceeded the processing limit and was not scanned; do not treat the message result as clearance for it.'}
                </p>
              </div>
            ))}

            {linksNotScannedCount > 0 && (
              <div className="card details-block" role="alert" style={{ borderInlineStart: '4px solid var(--color-danger)', color: 'var(--color-danger)' }}>
                {lang === 'ar' ? `لم يُفحص ${linksNotScannedCount} رابط؛ لا تفتح هذه الروابط.` : `${linksNotScannedCount} link(s) were not scanned; do not open them.`}
              </div>
            )}

            {/* Summary Security Guidance Card for SMS */}
            <div className="card details-block" style={{ background: 'var(--color-secondary-subtle)', borderColor: 'var(--color-secondary)' }}>
              <h3 className="details-title" style={{ color: 'var(--color-secondary)' }}>
                <ShieldCheckIcon size={18} color="currentColor" />
                <span>{lang === 'ar' ? 'إرشادات أمان الرسائل النصية' : 'SMS Safety Guidelines'}</span>
              </h3>
              <ul style={{ paddingRight: '18px', paddingLeft: '18px', margin: 0, fontSize: '0.85rem', lineHeight: '1.7', color: 'var(--color-text-secondary)' }}>
                <li>{lang === 'ar' ? 'البنوك والجهات الرسمية لا تطلب تحديث بياناتك أو كلمة المرور عبر رسالة نصية.' : 'Banks never request password updates or personal info via SMS.'}</li>
                <li>{lang === 'ar' ? 'احذر من مشاركة رمز التفعيل الفوري (OTP) مع أي طرف إطلاقاً.' : 'Never share One-Time Passwords (OTP) with anyone under any circumstances.'}</li>
                <li>{lang === 'ar' ? 'تحقق دائماً من النطاق المباشر والرسمي قبل إدخال بياناتك.' : 'Always verify the exact official domain before entering data.'}</li>
                <li>{lang === 'ar' ? 'للإبلاغ عن الرسائل الاحتيالية في السعودية: أعد إرسال الرسالة إلى 330330.' : 'To report scam messages in KSA: forward the SMS to 330330.'}</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="card result-actions">
              <button className="btn btn-primary" onClick={onReset} type="button">
                <RefreshIcon size={18} color="#FFFFFF" />
                <span>{lang === 'ar' ? 'فحص رسالة أخرى' : 'Scan Another SMS'}</span>
              </button>
              {!isGuest && (
                <button
                  className={`btn ${copied ? 'btn-navy' : 'btn-outline'}`}
                  onClick={handleCopyReport}
                  type="button"
                >
                  <ClipboardIcon size={18} color="currentColor" />
                  <span>{copied ? t('result.copiedReportBtn') : t('result.copyReportBtn')}</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
