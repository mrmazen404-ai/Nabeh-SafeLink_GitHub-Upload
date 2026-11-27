import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getScanDetails } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import './advanced-pages.css';

const UNCALIBRATED_SCORE_FIELDS = new Set([
  'confidence', 'confidence_score', 'confidence_level', 'phishing_prob',
  'ml_phishing_prob', 'fraud_probability', 'weighted_score',
  'urgency_pressure_score', 'credential_theft_score', 'identity_spoofing_score',
]);

function redactUncalibratedScores(value) {
  if (Array.isArray(value)) return value.map(redactUncalibratedScores);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    UNCALIBRATED_SCORE_FIELDS.has(key) ? null : redactUncalibratedScores(item),
  ]));
}

export default function ExportReport({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t, lang } = useLanguage();
  const [params] = useSearchParams();
  const scanId = params.get('scanId');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scanId) {
      setError(t('exportReport.noScanError'));
      return;
    }
    getScanDetails(scanId)
      .then((res) => setReport(res.data))
      .catch((err) => {
        const status = err?.response?.status;
        setError(
          status === 401
            ? (lang === 'ar' ? 'انتهت جلستك. سجّل الدخول لتصدير التقرير.' : 'Your session has expired. Please sign in to export the report.')
            : status === 404
              ? (lang === 'ar' ? 'لم يتم العثور على الفحص المطلوب.' : 'The requested scan could not be found.')
              : t('exportReport.loadError'),
        );
      });
  }, [scanId, t]);

  const scan = report?.scan;
  const explanation = report?.explanation;
  const sanitizedScan = scan ? redactUncalibratedScores(scan) : null;
  const payload = report
    ? {
        report_type: 'Nabeh SafeLink Scan Report',
        generated_at: new Date().toISOString(),
        scan: sanitizedScan,
        explanation,
        analysis_stages: sanitizedScan?.analysis_snapshot || {},
      }
    : null;

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = () =>
    download(JSON.stringify(payload, null, 2), `nabeh-report-${scanId}.json`, 'application/json;charset=utf-8');

  const downloadCsv = () => {
    const rows = [
      ['field', 'value'],
      ['scan_id', scan?.id],
      ['input_type', scan?.input_type],
      ['classification', scan?.classification],
      ['confidence_score', null],
      ['status', scan?.status],
      ['created_at', scan?.created_at],
      ['completed_at', scan?.completed_at],
      ['recommendation', explanation?.recommendation || scan?.recommendation],
      ['summary', explanation?.summary],
    ];
    download(
      rows.map((row) => row.map(csvCell).join(',')).join('\n'),
      `nabeh-report-${scanId}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const getClassLabel = (cls) => t(`scanDetails.labels.${cls}`) || cls || t('scanDetails.labels.UNKNOWN');

  return (
    <div className="advanced-page" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />
      <main className="advanced-container">
        <div className="page-title-row print-title">
          <div>
            <span className="advanced-kicker">{t('exportReport.kicker')}</span>
            <h1>{t('exportReport.title')}</h1>
            <p>{t('exportReport.subtitle')}</p>
          </div>
        </div>

        {error && <div className="advanced-alert error">{error}</div>}
        {!report && !error && <div className="advanced-card">{t('exportReport.preparing')}</div>}

        {report && (
          <>
            <section className="advanced-card report-preview">
              <div className="report-brand">
                <strong>{t('exportReport.brandTitle')}</strong>
                <span>{t('exportReport.brandSub')}</span>
              </div>
              <div className="report-summary">
                <div>
                  <span>{t('exportReport.classification')}</span>
                  <strong>{getClassLabel(scan.classification)}</strong>
                </div>
                <div>
                  <span>{t('exportReport.confidence')}</span>
                  <strong>
                    {t('exportReport.notAvailable')}
                  </strong>
                </div>
                <div>
                  <span>{t('exportReport.scanTime')}</span>
                  <strong>{formatDate(scan.created_at, lang)}</strong>
                </div>
              </div>
              <h2>{t('exportReport.recommendationTitle')}</h2>
              <p>{explanation?.recommendation || scan.recommendation || t('exportReport.defaultRec')}</p>
            </section>

            <section className="advanced-card export-actions">
              <h2>{t('exportReport.selectFormat')}</h2>
              <div className="export-grid">
                <button className="export-option" onClick={downloadJson}>
                  <strong>JSON</strong>
                  <span>{t('exportReport.jsonDesc')}</span>
                </button>
                <button className="export-option" onClick={downloadCsv}>
                  <strong>CSV</strong>
                  <span>{t('exportReport.csvDesc')}</span>
                </button>
                <button className="export-option" onClick={() => window.print()}>
                  <strong>PDF</strong>
                  <span>{t('exportReport.pdfDesc')}</span>
                </button>
              </div>
              <p className="muted">{t('exportReport.localNotice')}</p>
            </section>
          </>
        )}
      </main>
      <Footer activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function csvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function formatDate(value, lang = 'ar') {
  return value
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value)
      )
    : '—';
}
