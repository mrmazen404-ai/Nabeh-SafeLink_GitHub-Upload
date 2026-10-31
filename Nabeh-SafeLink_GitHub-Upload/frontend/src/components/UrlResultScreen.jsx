import { useState } from 'react';
import Header from './Header';
import { useLanguage } from '../context/LanguageContext';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  HelpCircleIcon,
  ShieldCheckIcon,
  CpuIcon,
  SparklesIcon,
  PinIcon,
  TargetIcon,
  RefreshIcon,
  ClipboardIcon,
  LinkIcon
} from './Icons';
import '../styles/result.css';

export default function UrlResultScreen({ result, onReset, activeTab, setActiveTab, isGuest = true, onNavigateAuth }) {
  const { t, dir, lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  const classification = result?.classification || 'UNKNOWN';

  const CONFIG = {
    SAFE: {
      icon: CheckCircleIcon,
      labelAr: 'لم تُرصد مؤشرات تهديد',
      labelEn: 'No threat indicators detected',
      title: lang === 'ar' ? 'لم تُرصد مؤشرات تهديد في الفحوصات المتاحة' : 'No threat indicators detected in available checks',
      description: lang === 'ar'
        ? 'هذه النتيجة لا تثبت أن الرابط آمن. لم تُرصد مؤشرات تهديد في المصادر التي استجابت لهذا الفحص؛ تحقّق من الجهة قبل المتابعة.'
        : 'This result does not prove the URL is safe. No threat indicators were detected by the sources that responded; verify the destination before proceeding.',
      className: 'safe',
    },
    SUSPICIOUS: {
      icon: AlertTriangleIcon,
      labelAr: 'رابط مشبوه بحاجة للحذر',
      labelEn: 'Suspicious URL',
      title: lang === 'ar' ? 'تنبيه: رابط مشبوه يسترعي الحذر' : 'Warning: Suspicious Link',
      description: lang === 'ar'
        ? 'يحتوي الرابط على مؤشرات تستدعي الحذر مثل عمر النطاق أو التركيب الهيكلي. يُفضل التأكد من المصدر قبل المتابعة.'
        : 'This link exhibits structural or domain anomalies. Caution and verification are recommended.',
      className: 'suspicious',
    },
    DANGEROUS: {
      icon: XCircleIcon,
      labelAr: 'رابط احتيالي خطير (Phishing)',
      labelEn: 'High Risk Dangerous URL',
      title: lang === 'ar' ? 'خطر! رابط احتيالي غير آمن' : 'Danger! Malicious Phishing Link',
      description: lang === 'ar'
        ? 'تم رصد مؤشرات خطورة أمنية وانتحال لعلامة تجارية أو توزيع برمجيات ضارة. لا تفتح الرابط ولا تدخل بياناتك الحساسة!'
        : 'High-risk security threats, brand impersonation, or malware distribution detected. Do not proceed or enter credentials!',
      className: 'dangerous',
    },
    UNKNOWN: {
      icon: HelpCircleIcon,
      labelAr: 'نتيجة غير محددة',
      labelEn: 'Inconclusive Result',
      title: lang === 'ar' ? 'تعذر التحقق الكامل من الرابط' : 'Inconclusive Link Audit',
      description: lang === 'ar'
        ? 'لم تتوفر معلومات كافية لإصدار حكم جازم حول هذا الرابط. توخَّ الحذر وتجنب مشاركة بياناتك.'
        : 'Insufficient evidence to provide a decisive verdict. Exercise caution when visiting this link.',
      className: 'unknown',
    },
  };

  const config = CONFIG[classification] || CONFIG.UNKNOWN;
  const StatusIcon = config.icon;
  const confidence = result?.confidence_calibrated === true && Number.isFinite(result?.confidence)
    ? (result.confidence * 100).toFixed(1)
    : null;
  const vt = result?.virustotal || {};
  const ml = result?.ml_model || {};
  const exp = result?.explanation || {};
  const targetUrl = result?.extracted_url || result?.input_value || '';
  const mlSource = String(ml.source || '').toUpperCase();
  const mlClassification = String(ml.classification || '').toUpperCase();
  const hasUsableMlResult = mlSource === 'ML_MODEL'
    && ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(mlClassification);
  const mlStatusLabel = mlSource === 'INVALID_URL'
    ? (lang === 'ar' ? 'الرابط غير صالح نحوياً؛ لم يُشغّل النموذج' : 'Invalid URL syntax; model was not run')
    : mlSource === 'MODEL_ERROR'
      ? (lang === 'ar' ? 'حدث خطأ أثناء تشغيل النموذج' : 'Model execution error')
      : mlSource === 'MODEL_UNAVAILABLE'
        ? (lang === 'ar' ? 'النموذج غير متاح' : 'Model unavailable')
        : (lang === 'ar' ? 'النتيجة غير محسومة' : 'Inconclusive model result');
  const vtStatus = String(vt.status || '').toUpperCase();
  const hasVtStatus = Boolean(vtStatus || vt.error);

  const totalEngines = vt.total_engines || 0;
  const geminiProvider = String(exp.provider || result?.stages?.stage3_gemini?.provider || '').toUpperCase();
  const usesGemini = geminiProvider.includes('GEMINI');
  const assistantClassification = String(exp.classification || result?.stages?.stage3_gemini?.classification || '').toUpperCase();
  const maliciousPct = totalEngines > 0 ? ((vt.malicious || 0) / totalEngines) * 100 : 0;
  const suspiciousPct = totalEngines > 0 ? ((vt.suspicious || 0) / totalEngines) * 100 : 0;
  const harmlessPct = totalEngines > 0 ? ((vt.harmless || 0) / totalEngines) * 100 : 0;

  const handleCopyReport = () => {
    if (isGuest || !navigator.clipboard?.writeText) return;
    const reportText = `Nabeh SafeLink URL Audit Report:\nURL: ${targetUrl}\nClassification: ${config.title}\nRecommendation: ${exp.recommendation || t('result.defaultRec')}`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sourceLabel = (() => {
    const source = String(result?.source || '').toUpperCase();
    if (source === 'INSUFFICIENT_EVIDENCE') return lang === 'ar' ? 'أدلة غير حاسمة' : 'Inconclusive evidence';
    if (source.startsWith('ML_')) return lang === 'ar' ? 'تحليل أمني متاح' : 'Available security analysis';
    if (source.includes('VIRUSTOTAL') || source.includes('HYBRID')) return lang === 'ar' ? 'تحليل متعدد المصادر' : 'Multi-source analysis';
    return lang === 'ar' ? 'نتيجة الفحص' : 'Scan result';
  })();

  const providerLabel = (() => {
    const provider = String(exp.provider || '').toUpperCase();
    if (provider.includes('LOCAL') || provider.includes('FALLBACK') || provider.includes('RULES')) {
      return lang === 'ar' ? 'تحليل محلي احتياطي' : 'Local fallback analysis';
    }
    if (provider.includes('GEMINI')) return t('result.aiModelTag');
    return lang === 'ar' ? 'تحليل أمني' : 'Security analysis';
  })();

  return (
    <div className="result-page url-result-theme" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container">
        <div className="result-desktop-grid">
          {/* Main URL Analysis Section */}
          <section className="card result-main-card" aria-label="شاشة نتيجة فحص الرابط">
            {/* Status Badge */}
            <div className={`result-badge result-badge-${config.className}`} role="status">
              <StatusIcon size={32} color="currentColor" />
              <div className="result-badge-labels">
                <span className="result-badge-ar">{config.labelAr}</span>
                <span className="result-badge-en">{config.labelEn} • {sourceLabel}</span>
              </div>
            </div>

            <div className="result-trust-strip">
              <span className="result-trust-title">
                {lang === 'ar' ? 'فحص ودراسة أمان الرابط (URL Link Audit)' : 'URL LINK SECURITY AUDIT'}
              </span>
              {hasUsableMlResult && <span><CpuIcon size={14} />LightGBM</span>}
              {totalEngines > 0 && <span><ShieldCheckIcon size={14} />VirusTotal</span>}
              {usesGemini && <span><SparklesIcon size={14} />Google Gemini</span>}
              {!hasUsableMlResult && totalEngines <= 0 && !usesGemini && (
                <span>{lang === 'ar' ? 'لم تتوفر مصادر فحص كافية' : 'No analysis source returned a result'}</span>
              )}
            </div>

            {/* Inspected URL Box */}
            <div className="inspected-url-box">
              <span className="url-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LinkIcon size={16} color="var(--color-secondary)" />
                {lang === 'ar' ? 'الرابط المباشر المفحوص (Inspected URL):' : 'Inspected URL:'}
              </span>
              <div className="url-text" dir="ltr" style={{ wordBreak: 'break-all', marginTop: '6px', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                {targetUrl}
              </div>
            </div>

            <h2 className="result-title">{config.title}</h2>
            <p className="result-desc">{config.description}</p>

            {/* Confidence Bar */}
            {confidence !== null && (
              <div className="confidence-block" aria-label={`${t('result.confidenceLabel')}: ${confidence}%`}>
                <div className="confidence-header">
                  <span>{t('result.confidenceLabel')}</span>
                  <span className={`confidence-value confidence-value-${config.className}`}>{confidence}%</span>
                </div>
                <div className="confidence-bar">
                  <div className={`confidence-fill confidence-fill-${config.className}`} style={{ width: `${confidence}%` }}></div>
                </div>
              </div>
            )}

            {/* Gemini AI Research Explanation */}
            {exp.summary && (
              <div className="explanation-block">
                <div className="explanation-header">
                  <h3 className="details-title">
                    <SparklesIcon size={18} color="var(--color-secondary)" />
                    <span>{lang === 'ar' ? 'شرح مساعد للنتيجة (ليس تحققاً مستقلاً):' : 'AI-assisted explanation (not independent verification):'}</span>
                  </h3>
                  <span className="gemini-tag">{providerLabel}</span>
                </div>

                <p className="explanation-text">{exp.summary}</p>
                {assistantClassification && (
                  <div className="explanation-text" style={{ marginTop: '10px', fontWeight: 600 }}>
                    {usesGemini
                      ? (lang === 'ar' ? 'تصنيف Gemini المساعد: ' : 'Gemini supporting classification: ')
                      : (lang === 'ar' ? 'تصنيف التحليل الاحتياطي: ' : 'Fallback analysis classification: ')}
                    {assistantClassification}
                  </div>
                )}

                {Array.isArray(exp.reasons) && exp.reasons.length > 0 && (
                  <ul className="reasons-list" style={{ marginTop: '16px' }}>
                    {exp.reasons.map((reason, i) => (
                      <li key={i}>
                        <PinIcon size={14} color="var(--color-secondary)" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {exp.recommendation && (
                  <div className="recommendation-block">
                    <TargetIcon size={18} color="var(--color-secondary)" />
                    <div className="rec-content">
                      <span className="rec-title">{lang === 'ar' ? 'توصية نابه لأمان الروابط:' : 'Nabeh Link Safety Recommendation:'}</span>
                      <span className="rec-text">{exp.recommendation}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Engine Side Panel */}
          <aside className="result-side-panel">
            {/* VirusTotal 92+ Engines Visual Proportional Distribution Chart */}
            {(totalEngines > 0 || hasVtStatus) && (
              <div className="card details-block">
                <h3 className="details-title">
                  <ShieldCheckIcon size={18} color="var(--color-secondary)" />
                  <span>{lang === 'ar' ? 'توزيع فحوصات المحركات العالمية (VirusTotal):' : 'VirusTotal Engine Distribution:'}</span>
                </h3>

                {/* Proportional Stacked Progress Bar */}
                {totalEngines > 0 && <div style={{ height: '10px', display: 'flex', borderRadius: '5px', overflow: 'hidden', margin: '12px 0 16px 0', background: 'var(--color-bg-subtle)' }}>
                  {vt.malicious > 0 && <div style={{ width: `${maliciousPct}%`, background: 'var(--color-danger)' }} title={`Malicious: ${vt.malicious}`} />}
                  {vt.suspicious > 0 && <div style={{ width: `${suspiciousPct}%`, background: 'var(--color-warning)' }} title={`Suspicious: ${vt.suspicious}`} />}
                  {vt.harmless > 0 && <div style={{ width: `${harmlessPct}%`, background: 'var(--color-success)' }} title={`Harmless: ${vt.harmless}`} />}
                </div>}

                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">{t('result.vtDangerous')}</span>
                    <span className="detail-value" style={{ color: 'var(--color-danger)' }}>{vt.malicious || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('result.vtSuspicious')}</span>
                    <span className="detail-value" style={{ color: 'var(--color-warning)' }}>{vt.suspicious || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('result.vtSafe')}</span>
                    <span className="detail-value" style={{ color: 'var(--color-success)' }}>{vt.harmless || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('result.vtTotal')}</span>
                    <span className="detail-value">{totalEngines}</span>
                  </div>
                </div>
                {totalEngines === 0 && (
                  <p className="muted" role="status" style={{ marginTop: '12px' }}>
                    {vt.error || (vtStatus === 'NOT_APPLICABLE'
                      ? (lang === 'ar' ? 'لم يُطبّق VirusTotal على هذا الإدخال.' : 'VirusTotal was not applicable to this input.')
                      : (lang === 'ar' ? `حالة VirusTotal: ${vtStatus || 'UNKNOWN'}؛ لا تُعد هذه النتيجة دليلاً على السلامة.` : `VirusTotal status: ${vtStatus || 'UNKNOWN'}; this is not evidence of safety.`))}
                  </p>
                )}
              </div>
            )}

            {/* LightGBM Model Prediction Details */}
            {ml.classification && hasUsableMlResult && (
              <div className="card ml-details-block">
                <div className="ml-header">
                  <CpuIcon size={18} color="var(--color-secondary)" />
                  <h3 className="details-title" style={{ margin: 0 }}>{t('result.mlModelTitle')}</h3>
                </div>
                <div className="ml-body">
                  <div className="ml-stat">
                    <span className="ml-stat-label">{t('result.mlLocalPrediction')}</span>
                    <span className={`ml-stat-badge ml-${(ml.classification || '').toLowerCase()}`}>
                      {ml.classification === 'SAFE' ? (lang === 'ar' ? 'لم يرصد النموذج مؤشرات' : 'Model detected no indicators') : ml.classification === 'DANGEROUS' ? t('result.mlDangerousBadge') : t('result.mlSuspiciousBadge')}
                    </span>
                  </div>
                  <p className="muted" style={{ margin: '8px 0 0' }}>
                    {lang === 'ar' ? 'توقع النموذج إشارة واحدة وليس إثباتاً نهائياً؛ لا تُعرض نسبة غير معايرة.' : 'The model output is one signal, not proof; uncalibrated percentages are withheld.'}
                  </p>
                </div>
              </div>
            )}
            {!hasUsableMlResult && mlSource && (
              <div className="card ml-details-block" role="status">
                <div className="ml-header"><CpuIcon size={18} color="var(--color-secondary)" /><h3 className="details-title" style={{ margin: 0 }}>{t('result.mlModelTitle')}</h3></div>
                <p className="muted" style={{ margin: '10px 0 0' }}>{mlStatusLabel}</p>
              </div>
            )}

            {/* Actions */}
            <div className="card result-actions">
              <button className="btn btn-primary" onClick={onReset} type="button">
                <RefreshIcon size={18} color="#FFFFFF" />
                <span>{t('result.scanNewBtn')}</span>
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
