import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import { scanURL, getScans, SCAN_IDEMPOTENCY_ENABLED } from '../services/api';
import LoadingScreen from '../components/LoadingScreen';
import ResultScreen from '../components/ResultScreen';
import {
  LinkIcon,
  SearchIcon,
  ClipboardIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  HelpCircleIcon,
  InfoIcon
} from '../components/Icons';
import '../styles/scanner.css';
import { useLanguage } from '../context/LanguageContext';

const STATUS_CFG = {
  SAFE: { icon: CheckCircleIcon, className: 'recent-safe' },
  SUSPICIOUS: { icon: AlertTriangleIcon, className: 'recent-suspicious' },
  DANGEROUS: { icon: XCircleIcon, className: 'recent-dangerous' },
  UNKNOWN: { icon: HelpCircleIcon, className: 'recent-unknown' },
};

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const API_ERROR_CODE_MAP = {
  INVALID_INPUT: 'SCAN_E_INPUT',
  SCAN_INVALID_INPUT: 'SCAN_E_INPUT',
  AUTH_REQUIRED: 'SCAN_E_AUTH',
  UNAUTHENTICATED: 'SCAN_E_AUTH',
  GUEST_SCAN_DISABLED: 'SCAN_E_GUEST_DISABLED',
  ACCESS_DENIED: 'SCAN_E_ACCESS',
  RATE_LIMITED: 'SCAN_E_RATE_LIMIT',
  SCAN_RATE_LIMITED: 'SCAN_E_RATE_LIMIT',
  SCAN_TIMEOUT: 'SCAN_E_TIMEOUT',
  SCAN_DEADLINE_EXCEEDED: 'SCAN_E_TIMEOUT',
  SCAN_PROVIDER_UNAVAILABLE: 'SCAN_E_PROVIDER',
  UPSTREAM_UNAVAILABLE: 'SCAN_E_PROVIDER',
  SCAN_SETTINGS_UNAVAILABLE: 'SCAN_E_CONFIGURATION',
  SCAN_UNAVAILABLE: 'SCAN_E_UNAVAILABLE',
  INTERNAL_ERROR: 'SCAN_E_INTERNAL',
};

const SCAN_ERROR_COPY = {
  SCAN_E_INPUT: {
    ar: 'تعذر قبول المدخل. تحقق من صيغة الرابط أو من أن نص الرسالة غير فارغ، ثم حاول مجددًا.',
    en: 'The input could not be accepted. Check the URL format or make sure the message is not empty, then try again.',
    retryable: false,
  },
  SCAN_E_AUTH: {
    ar: 'انتهت جلسة الدخول أو لم تعد صالحة. سجّل الدخول ثم أعد الفحص.',
    en: 'Your sign-in session has expired or is no longer valid. Sign in and scan again.',
    retryable: false,
  },
  SCAN_E_GUEST_DISABLED: {
    ar: 'فحص الضيف متوقف حاليًا. سجّل الدخول لاستخدام الفحص أو حاول لاحقًا.',
    en: 'Guest scanning is currently disabled. Sign in to scan or try again later.',
    retryable: false,
  },
  SCAN_E_ACCESS: {
    ar: 'لا تملك الصلاحية اللازمة لإجراء هذا الفحص. تحقق من حالة الدخول أو استخدم حسابًا مخولًا.',
    en: 'You do not have permission to run this scan. Check your sign-in status or use an authorized account.',
    retryable: false,
  },
  SCAN_E_RATE_LIMIT: {
    ar: 'وصلت إلى حد الفحوصات المسموح به مؤقتًا.',
    en: 'The temporary scan request limit has been reached.',
    retryable: true,
  },
  SCAN_E_TIMEOUT: {
    ar: 'انتهت مهلة الفحص قبل اكتماله. لم نحصل على نتيجة نهائية؛ أعد المحاولة بعد قليل.',
    en: 'The scan timed out before it completed. No final result was received; try again shortly.',
    retryable: true,
  },
  SCAN_E_PROVIDER: {
    ar: 'تعذر الحصول على استجابة من إحدى خدمات التحقق. الفحص غير مكتمل؛ لا تعتبر الرابط آمنًا بناءً على هذه المحاولة.',
    en: 'One of the verification services did not respond. The scan is incomplete; do not treat the link as safe based on this attempt.',
    retryable: true,
  },
  SCAN_E_CONFIGURATION: {
    ar: 'خدمة الفحص غير مهيأة حاليًا. لم يكتمل التحقق؛ حاول لاحقًا أو تواصل مع الدعم.',
    en: 'The scanning service is not fully configured. Verification did not complete; try later or contact support.',
    retryable: false,
  },
  SCAN_E_UNAVAILABLE: {
    ar: 'تعذر إكمال الفحص الآن. لم تصدر نتيجة؛ حاول لاحقًا، ولا تتفاعل مع الرابط حتى تتحقق منه.',
    en: 'The scan could not be completed right now. No result was produced; try later and avoid interacting with the link until verified.',
    retryable: true,
  },
  SCAN_E_NETWORK: {
    ar: 'تعذر الاتصال بخدمة الفحص. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
    en: 'Could not connect to the scanning service. Check your internet connection and try again.',
    retryable: true,
  },
  SCAN_E_INTERNAL: {
    ar: 'حدث خطأ داخلي ولم يكتمل الفحص. حاول لاحقًا، وإذا تكرر أرسل رمز الخطأ للدعم.',
    en: 'An internal error prevented the scan from completing. Try later; if it repeats, share the error code with support.',
    retryable: true,
  },
  SCAN_E_GENERIC: {
    ar: 'لم نتمكن من إكمال الفحص. لم تصدر نتيجة نهائية؛ حاول مرة أخرى لاحقًا.',
    en: 'We could not complete the scan. No final result was produced; please try again later.',
    retryable: true,
  },
};

function getSafeScanError(error, language) {
  const isArabic = language === 'ar';
  const status = error?.response?.status;
  const responseBody = error?.response?.data;
  const rawCode = responseBody?.error?.code || responseBody?.code || responseBody?.error_code;
  const normalizedCode = typeof rawCode === 'string' ? API_ERROR_CODE_MAP[rawCode] : null;
  const retryHeader = error?.response?.headers?.['retry-after'] || error?.response?.headers?.get?.('retry-after');
  const retryHeaderText = String(retryHeader || '');
  const parsedRetryDate = Date.parse(retryHeaderText);
  const retrySeconds = /^\d+$/.test(retryHeaderText)
    ? Math.min(3600, Number(retryHeaderText))
    : Number.isFinite(parsedRetryDate)
      ? Math.min(3600, Math.max(0, Math.ceil((parsedRetryDate - Date.now()) / 1000)))
      : null;

  let code = normalizedCode;
  if (!error) code = 'SCAN_E_GENERIC';
  if (error && !code) {
    if (error?.code === 'ECONNABORTED' || status === 408 || status === 504) code = 'SCAN_E_TIMEOUT';
    else if (status === 400 || status === 422) code = 'SCAN_E_INPUT';
    else if (status === 401) code = 'SCAN_E_AUTH';
    else if (status === 403) code = 'SCAN_E_ACCESS';
    else if (status === 429) code = 'SCAN_E_RATE_LIMIT';
    else if (status === 502) code = 'SCAN_E_PROVIDER';
    else if (status === 503) code = 'SCAN_E_UNAVAILABLE';
    else if (typeof status === 'number' && status >= 500) code = 'SCAN_E_INTERNAL';
    else if (!error?.response) code = 'SCAN_E_NETWORK';
    else code = 'SCAN_E_GENERIC';
  }

  const copy = SCAN_ERROR_COPY[code] || SCAN_ERROR_COPY.SCAN_E_GENERIC;
  const message = code === 'SCAN_E_RATE_LIMIT' && retrySeconds !== null
    ? (isArabic
      ? `${copy.ar} أعد المحاولة بعد ${retrySeconds} ثانية.`
      : `${copy.en} Retry in ${retrySeconds} seconds.`)
    : copy[isArabic ? 'ar' : 'en'];
  const requestId = responseBody?.error?.request_id || responseBody?.request_id || error?.response?.headers?.['x-request-id'];
  const safeRequestId = typeof requestId === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(requestId)
    ? requestId
    : null;

  return {
    code,
    message,
    retryable: copy.retryable && (code !== 'SCAN_E_RATE_LIMIT' || retrySeconds === null || retrySeconds === 0),
    requestId: safeRequestId,
  };
}

export default function Scanner({ initialUrl = '', onClearInitial, activeTab, setActiveTab, isGuest = true, onNavigateAuth }) {
  const { t, lang, dir } = useLanguage();
  const [url, setUrl] = useState(initialUrl);
  const [scanType, setScanType] = useState('URL');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [recentScans, setRecentScans] = useState([]);
  const inputRef = useRef(null);
  const idempotencyRef = useRef(null);

  useEffect(() => {
    if (isGuest) {
      idempotencyRef.current = null;
      setRecentScans([]);
      setResult(null);
      setUrl('');
      setError('');
    } else {
      fetchScans();
    }
    if (initialUrl) {
      setUrl(initialUrl);
      handleScan(initialUrl);
      if (onClearInitial) onClearInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, isGuest]);

  const fetchScans = async () => {
    try {
      const res = await getScans();
      setRecentScans(res && res.success && Array.isArray(res.data) ? res.data.slice(0, 5) : []);
    } catch (e) {
      setRecentScans([]);
    }
  };

  const handleScan = async (targetUrl = url) => {
    const textToScan = targetUrl || url;
    if (!textToScan || !textToScan.trim()) {
      setError(t('scanner.errEmptyInput'));
      return;
    }
    if (scanType === 'URL' && /\s/u.test(textToScan.trim())) {
      setError(t('scanner.errUrlOnly'));
      return;
    }

    if (loading) return;

    setError('');
    setLoading(true);
    setResult(null);

    const requestIdentity = `${scanType}\u0000${lang}\u0000${textToScan.trim()}`;
    let idempotencyKey = null;
    if (!isGuest && SCAN_IDEMPOTENCY_ENABLED) {
      if (idempotencyRef.current?.identity !== requestIdentity) {
        idempotencyRef.current = { identity: requestIdentity, key: createIdempotencyKey() };
      }
      idempotencyKey = idempotencyRef.current.key;
    }

    try {
      const response = await scanURL(textToScan.trim(), lang, isGuest, scanType, idempotencyKey);
      if (response && response.success) {
        setResult(response.data);
        if (idempotencyRef.current?.identity === requestIdentity) idempotencyRef.current = null;
        if (!isGuest) fetchScans();
      } else {
        setError(getSafeScanError(null, lang));
      }
    } catch (err) {
      setError(getSafeScanError(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setError('');
        if (inputRef.current) inputRef.current.focus();
      }
    } catch (e) {
      setError(t('scanner.errPaste'));
    }
  };

  const handleClear = () => {
    setUrl('');
    setError('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleReset = () => {
    setUrl('');
    setResult(null);
    setError('');
  };

  if (loading) {
    return <LoadingScreen url={url} scanType={scanType} />;
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        onReset={handleReset}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isGuest={isGuest}
        onNavigateAuth={onNavigateAuth}
      />
    );
  }

  return (
    <div className="scanner-page" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container">
        {/* Guest Mode Privacy Notice (Strict PRD Compliance) */}
        {isGuest && (
          <div className="scanner-guest-notice">
            <InfoIcon size={18} color="#16A34A" />
            <span>
              <strong>{t('scanner.guestTitle')}</strong> {t('scanner.guestDesc')}
              <br />
              <small>{t('scanner.guestPrivacy')}</small>
            </span>
          </div>
        )}

        {/* Desktop 2-Column Grid */}
        <div className={`scanner-desktop-grid ${isGuest ? 'is-single' : 'is-split'}`}>
          {/* Main Input Panel */}
          <div>
            {/* Toggle Mode URL vs TEXT */}
            <div className="scanner-toggle-bar">
              <button
                type="button"
                className={`scanner-toggle-btn ${scanType === 'URL' ? 'active' : ''}`}
                aria-pressed={scanType === 'URL'}
                onClick={() => setScanType('URL')}
              >
                <LinkIcon size={16} color="currentColor" />
                <span>{t('scanner.tabUrl')}</span>
              </button>
              <button
                type="button"
                className={`scanner-toggle-btn ${scanType === 'TEXT' ? 'active' : ''}`}
                aria-pressed={scanType === 'TEXT'}
                onClick={() => setScanType('TEXT')}
              >
                <span>{t('scanner.tabText')}</span>
              </button>
            </div>
            <div className="scanner-input-card">
              <div className="scanner-hero-row">
                <div className="scanner-hero-mark" aria-hidden="true">
                  <span className="scanner-hero-shield"><CheckCircleIcon size={22} color="#FFFFFF" /></span>
                </div>
                <div className="scanner-hero-copy">
                  <span className="scanner-kicker">{t('scanner.workspace')}</span>
                  <span className="scanner-live-status"><i />{t('scanner.liveProtection')}</span>
                </div>
              </div>
              <h1 className="scanner-title">{t('scanner.pageTitle')}</h1>
              <p className="scanner-subtitle">
                {scanType === 'URL'
                  ? t('scanner.subUrl')
                  : t('scanner.subText')}
              </p>
              <div className="scanner-trust-row" aria-label={t('scanner.capabilities')}>
                <span><CheckCircleIcon size={14} />{t('scanner.aiAnalysis')}</span>
                <span><CheckCircleIcon size={14} />{t('scanner.multiSource')}</span>
                <span><CheckCircleIcon size={14} />{t('scanner.privacyFirst')}</span>
              </div>

              <div className="scanner-input-wrapper">
                <span className="scanner-input-icon">
                  <LinkIcon size={18} color="var(--color-primary)" />
                </span>
                {scanType === 'TEXT' ? (
                  <textarea
                    ref={inputRef}
                    className="scanner-input scanner-textarea"
                    placeholder={t('scanner.placeholderText')}
                    aria-label={t('scanner.inputLabelText')}
                    rows={5}
                    maxLength={4096}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && handleScan()}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  />
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    className="scanner-input"
                    placeholder={t('scanner.placeholderUrl')}
                    aria-label={t('scanner.inputLabelUrl')}
                    maxLength={4096}
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                    dir="ltr"
                  />
                )}
                {url ? (
                  <button
                    className="input-action-btn clear-btn"
                    onClick={handleClear}
                    title={t('scanner.clear')}
                    type="button"
                  >
                    <span>{t('scanner.clear')}</span>
                  </button>
                ) : (
                  <button
                    className="input-action-btn paste-btn"
                    onClick={handlePaste}
                    title={t('scanner.paste')}
                    type="button"
                  >
                    <ClipboardIcon size={14} color="currentColor" />
                    <span>{t('scanner.paste')}</span>
                  </button>
                )}
              </div>

              {error && (
                <div className="scanner-error" role="alert" aria-live="polite">
                  <AlertTriangleIcon size={16} color="var(--color-danger)" />
                  <span>
                    {typeof error === 'string' ? error : (
                      <>
                        {error.message}
                        {error.requestId && <small> {lang === 'ar' ? 'مرجع الدعم:' : 'Support reference:'} {error.requestId}</small>}
                        <small> {lang === 'ar' ? 'رمز الخطأ:' : 'Error code:'} {error.code}</small>
                        {error.retryable && (
                          <button
                            type="button"
                            onClick={() => handleScan()}
                            style={{ marginInlineStart: 10, border: 0, padding: 0, background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                          >
                            {lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              )}

              <button
                className="btn btn-primary scanner-button"
                onClick={() => handleScan()}
                disabled={!url.trim() || loading}
                type="button"
              >
                <SearchIcon size={18} color="#FFFFFF" />
                <span>{loading ? t('scanner.scanningBtn') : t('scanner.startBtn')}</span>
              </button>
            </div>
          </div>

          {/* Registered-account history only; guest scans are never listed here. */}
          {!isGuest && (
          <section className="recent-section" aria-label={t('scanner.recentScansTitle')}>
            <div className="recent-header">
              <h2 className="recent-title">{t('scanner.recentScansTitle')}</h2>
              <span className="recent-count">{t('scanner.recentCount', { count: recentScans.length })}</span>
            </div>

            <div className="recent-list">
              {recentScans.length === 0 ? <p role="status">{t('scanner.noRecentScans')}</p> : recentScans.map((scan, idx) => {
                const statusKey = ['SAFE', 'SUSPICIOUS', 'DANGEROUS', 'UNKNOWN'].includes(scan.classification)
                  ? scan.classification
                  : 'UNKNOWN';
                const cfg = STATUS_CFG[statusKey] || STATUS_CFG.UNKNOWN;
                const statusLabel = statusKey === 'SAFE' ? t('result.safeLabelAr') : statusKey === 'SUSPICIOUS' ? t('result.suspiciousLabelAr') : statusKey === 'DANGEROUS' ? t('result.dangerousLabelAr') : t('result.unknownLabelAr');
                const StatusSvg = cfg.icon;
                const displayUrl = scan.input_value_masked || scan.url || t('home.scannedUrl');

                return (
                  <div
                    className="recent-item"
                    key={scan.id || idx}
                  >
                    <span className={`recent-icon ${cfg.className}`}>
                      <StatusSvg size={18} color="currentColor" />
                    </span>
                    <div className="recent-info">
                      <span className="recent-url" dir="ltr">
                        {displayUrl}
                      </span>
                      <span className="recent-meta">
                        {statusLabel} • {t('scanner.savedScan')}
                      </span>
                    </div>
                    <span className="recent-arrow">←</span>
                  </div>
                );
              })}
            </div>
          </section>
          )}
        </div>
      </main>

    </div>
  );
}
