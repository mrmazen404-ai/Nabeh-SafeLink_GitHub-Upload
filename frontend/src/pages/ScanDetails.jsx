import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getScanDetails } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangleIcon, CheckCircleIcon, ShieldCheckIcon } from '../components/Icons';
import UrlEvidenceCard from '../components/UrlEvidenceCard';
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

export default function ScanDetails({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t, lang } = useLanguage();
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getScanDetails(scanId)
      .then((res) => setData(res.data))
      .catch((err) => {
        const status = err?.response?.status;
        setError(
          status === 401
            ? (lang === 'ar' ? 'انتهت جلستك. سجّل الدخول لعرض تفاصيل الفحص.' : 'Your session has expired. Please sign in to view the scan details.')
            : status === 404
              ? (lang === 'ar' ? 'لم يتم العثور على تفاصيل هذا الفحص.' : 'The details for this scan could not be found.')
              : t('scanDetails.loadError'),
        );
      });
  }, [scanId, t]);

  const scan = data?.scan;
  const explanation = data?.explanation;
  const stages = scan?.analysis_snapshot && Object.keys(scan.analysis_snapshot).length ? scan.analysis_snapshot : {};
  const evidenceCard = stages.evidence_card;
  const stageList = Object.entries(stages)
    .filter(([key]) => key !== 'evidence_card')
    .map(([key, value]) => [key, redactUncalibratedScores(value)]);

  const getLabel = (cls) => cls === 'SAFE'
    ? (lang === 'ar' ? 'لم تُرصد مؤشرات' : 'No indicators detected')
    : t(`scanDetails.labels.${cls}`) || cls || t('scanDetails.labels.UNKNOWN');
  const getStageName = (key) => t(`scanDetails.stages.${key}`) || key;

  return (
    <div className="advanced-page" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />
      <main className="advanced-container">
        <button className="back-link" onClick={() => navigate('/history')}>
          {t('scanDetails.backToHistory')}
        </button>

        {error && <div className="advanced-alert error">{error}</div>}
        {!scan && !error && <div className="advanced-card">{t('scanDetails.loading')}</div>}

        {scan && (
          <>
            <section className={`details-hero ${String(scan.classification || 'UNKNOWN').toLowerCase()}`}>
              <div>
                <span className="advanced-kicker">{t('scanDetails.kicker')}</span>
                <h1>{t('scanDetails.title')}</h1>
                <p dir="ltr">{scan.input_value_masked || '••••'}</p>
              </div>
              <div className="verdict-pill">
                {scan.classification === 'SAFE' ? <CheckCircleIcon size={20} /> : <AlertTriangleIcon size={20} />}
                {getLabel(scan.classification)}
              </div>
            </section>

            <section className="details-meta">
              <Meta label={t('scanDetails.inputType')} value={scan.input_type === 'TEXT' ? t('scanDetails.textType') : t('scanDetails.urlType')} />
              <Meta label={t('scanDetails.confidence')} value={t('scanDetails.notAvailable')} />
              <Meta label={t('scanDetails.completedAt')} value={formatDate(scan.completed_at || scan.created_at, lang)} />
              <Meta label={t('scanDetails.status')} value={scan.status === 'COMPLETED' ? t('scanDetails.statusCompleted') : scan.status} />
            </section>

            <section className="advanced-card">
              <div className="section-heading">
                <div>
                  <span className="advanced-kicker">{t('scanDetails.analysisChain')}</span>
                  <h2>{t('scanDetails.fullStages')}</h2>
                </div>
                <ShieldCheckIcon size={28} />
              </div>

              {stageList.length ? (
                <div className="stage-list">
                  {stageList.map(([key, stage]) => (
                    <Stage key={key} title={getStageName(key)} stage={stage} t={t} />
                  ))}
                </div>
              ) : (
                <div className="stage-list">
                  <Stage
                    title={t('scanDetails.localAnalysis')}
                    stage={{
                      status: 'COMPLETED',
                      classification: scan.classification,
                      confidence: null,
                      note: t('scanDetails.legacyNote'),
                    }}
                    t={t}
                  />
                  <Stage
                    title={t('scanDetails.finalVerdict')}
                    stage={{
                      status: 'COMPLETED',
                      classification: scan.classification,
                      confidence: null,
                    }}
                    t={t}
                  />
                </div>
              )}
            </section>

            <UrlEvidenceCard card={evidenceCard} lang={lang} t={t} />

            <section className="advanced-grid">
              <article className="advanced-card">
                <div className="section-heading">
                  <div>
                    <span className="advanced-kicker">{t('scanDetails.aiSection')}</span>
                    <h2>{t('scanDetails.explanationRecommendation')}</h2>
                  </div>
                </div>
                <p className="explanation-copy">{explanation?.summary || t('scanDetails.noExplanation')}</p>
                <div className="recommendation-box">
                  <strong>{t('scanDetails.securityRecommendation')}</strong>
                  <p>{explanation?.recommendation || scan.recommendation || t('scanDetails.defaultRec')}</p>
                </div>
                {Array.isArray(explanation?.reasons) && explanation.reasons.length > 0 && (
                  <ul className="reason-list">
                    {explanation.reasons.map((reason, index) => (
                      <li key={index}>{typeof reason === 'string' ? reason : JSON.stringify(reason)}</li>
                    ))}
                  </ul>
                )}
                <div role="note" style={{ marginTop: '20px', padding: '14px 16px', borderRadius: '12px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-subtle)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                  {lang === 'ar'
                    ? 'لا نعرض درجات رقمية للضغط أو سرقة البيانات أو الانتحال قبل معايرتها والتحقق منها على مجموعة مستقلة.'
                    : 'Numeric urgency, credential-theft, and impersonation scores are withheld until independently validated and calibrated.'}
                </div>
              </article>


              <article className="advanced-card action-card">
                <h2>{t('scanDetails.actionsTitle')}</h2>
                <button className="primary-button" onClick={() => navigate(`/export-report?scanId=${encodeURIComponent(scan.id)}`)}>
                  {t('scanDetails.exportBtn')}
                </button>
                <button className="secondary-button" onClick={() => navigate(`/compare?ids=${encodeURIComponent(scan.id)}`)}>
                  {t('scanDetails.compareBtn')}
                </button>
              </article>
            </section>
          </>
        )}
      </main>
      <Footer activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function Stage({ title, stage, t }) {
  const values = Object.entries(stage || {}).filter(([key]) => !['evidence'].includes(key));
  return (
    <article className="stage-card">
      <div className="stage-status">
        <CheckCircleIcon size={19} /> {t('scanDetails.stageCompleted')}
      </div>
      <h3>{title}</h3>
      <div className="stage-values">
        {values.map(([key, value]) => (
          <div key={key}>
            <span>{humanize(key)}</span>
            <strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function humanize(value) {
  return String(value).replaceAll('_', ' ');
}

function formatDate(value, lang = 'ar') {
  return value
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
}
