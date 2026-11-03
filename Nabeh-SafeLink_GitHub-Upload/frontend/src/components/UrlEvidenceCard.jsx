import '../styles/url-evidence-card.css';

function formatTimestamp(value, lang) {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(date);
}

function displayValue(value, text, lang) {
  if (typeof value === 'boolean') return value ? text('Yes') : text('No');
  if (Array.isArray(value)) return value.length ? value.join(lang === 'ar' ? '، ' : ', ') : text('None');
  if (value === null || value === undefined || value === '') return text('NotAvailable');
  return String(value);
}

export default function UrlEvidenceCard({ card, lang = 'ar', t }) {
  if (!card || typeof card !== 'object' || typeof t !== 'function') return null;
  const text = (key) => t(`result.evidence${key}`);
  const statusKey = {
    SUCCESS: 'ProviderSuccess', NO_VERDICT: 'ProviderNoVerdict', NOT_CONFIGURED: 'ProviderNotConfigured',
    AUTH_ERROR: 'ProviderAuthError', RATE_LIMITED: 'ProviderRateLimited', TIMEOUT: 'ProviderTimeout',
    NETWORK_ERROR: 'ProviderNetworkError', PROVIDER_ERROR: 'ProviderError',
    ANALYSIS_PENDING: 'ProviderPending', PARSE_ERROR: 'ProviderParseError',
    NOT_REPORTED_BY_PROVIDER: 'ProviderNotReported',
  };
  const statusLabel = (value) => {
    if (!value) return 'UNKNOWN';
    const key = statusKey[value];
    return key ? `${text(key)} (${value})` : value;
  };
  const decision = card.decision || {};
  const decisionInputs = decision.inputs || {};
  const decisionCounts = decisionInputs.virustotal_counts || {};
  const thresholds = decision.thresholds || {};
  const sources = card.sources || {};
  const vt = sources.virustotal || {};
  const ml = sources.ml_model || {};
  const counts = vt.counts || {};
  const reasonKey = {
    VT_STRONG_CONSENSUS: 'ReasonVtConsensus',
    VT_ML_CORROBORATION: 'ReasonVtMlCorroboration',
    VT_SIGNAL: 'ReasonVtSignal',
    ML_STRONG_SIGNAL_ONLY: 'ReasonMlOnly',
    ML_SUSPICIOUS_SIGNAL: 'ReasonMlSuspicious',
    SAFE_SOURCE_CONSENSUS: 'ReasonSafeConsensus',
    HYBRID_WEIGHTED_SUSPICIOUS: 'ReasonHybridSuspicious',
    HYBRID_WEIGHTED_INCONCLUSIVE: 'ReasonHybridUnknown',
    INSUFFICIENT_EVIDENCE: 'ReasonInsufficient',
  }[decision.code] || 'ReasonInsufficient';
  const observationKeys = {
    URL_SCHEME: 'UrlScheme', URL_LENGTH: 'UrlLength', SUBDOMAIN_COUNT: 'SubdomainCount',
    IPV4_HOST: 'Ipv4Host', PUNYCODE_HOST: 'PunycodeHost', AT_SYMBOL: 'AtSymbol',
    NONSTANDARD_PORT: 'NonstandardPort', ENCODED_CHARACTERS: 'EncodedCharacters',
    QUERY_PARAMETER_COUNT: 'QueryParameterCount', SUSPICIOUS_TERMS: 'SuspiciousTerms',
    BRAND_TERMS_IN_PATH_QUERY: 'BrandTerms', SUSPICIOUS_FILE_EXTENSION: 'SuspiciousExtension',
  };
  const countRows = [
    ['Malicious', counts.malicious], ['Suspicious', counts.suspicious],
    ['Harmless', counts.harmless], ['Undetected', counts.undetected],
    ['Timeout', counts.timeout], ['Total', counts.total_engines],
  ];
  const scanners = Array.isArray(vt.scanner_results) ? vt.scanner_results : [];
  const observations = card.url_observations?.items || [];
  const unavailableCounts = !Object.keys(counts).length;
  const thresholdRows = [
    ['ThresholdDangerous', thresholds.dangerous_min_malicious_engines],
    ['ThresholdVtMl', thresholds.dangerous_with_ml_max_malicious_engines],
    ['ThresholdSuspicious', thresholds.suspicious_min_vt_suspicious_engines],
  ].filter(([, value]) => value !== undefined && value !== null);

  return (
    <section className="url-evidence-card" aria-labelledby="url-evidence-title">
      <header className="url-evidence-header">
        <div>
          <h2 id="url-evidence-title">{text('Title')}</h2>
          <p>{text('Intro')}</p>
          {card.scan_id && <p className="url-evidence-reference"><strong>{text('ScanReference')}:</strong> <code>{card.scan_id}</code></p>}
        </div>
      </header>

      <section className="url-evidence-decision" aria-labelledby="url-evidence-decision-title">
        <h3 id="url-evidence-decision-title">{text('Decision')}</h3>
        <p>{text(reasonKey)}</p>
        <div className="url-evidence-decision-inputs">
          <h4>{text('DecisionInputs')}</h4>
          <dl>
            <div><dt>{text('VtStatus')}</dt><dd><code>{decisionInputs.virustotal_status || 'UNKNOWN'}</code></dd></div>
            <div><dt>{text('ProviderStatus')}</dt><dd><code>{statusLabel(decisionInputs.virustotal_provider_status || 'NOT_REPORTED_BY_PROVIDER')}</code></dd></div>
            <div><dt>{text('Malicious')}</dt><dd>{decisionCounts.malicious ?? '—'}</dd></div>
            <div><dt>{text('Suspicious')}</dt><dd>{decisionCounts.suspicious ?? '—'}</dd></div>
            <div><dt>{text('ModelClass')}</dt><dd><code>{decisionInputs.ml_classification || 'UNKNOWN'}</code></dd></div>
            <div><dt>{text('ModelSource')}</dt><dd><code>{decisionInputs.ml_source || 'NOT_REPORTED'}</code></dd></div>
          </dl>
        </div>
        <div className="url-evidence-meta">
          <span><strong>{text('RuleLabel')}:</strong> <code>{decision.code || 'INSUFFICIENT_EVIDENCE'}</code></span>
          <span><strong>{text('Policy')}:</strong> <code>{decision.policy_version || '—'}</code></span>
        </div>
        {thresholdRows.length > 0 && (
          <details className="url-evidence-details">
            <summary>{text('PolicyThresholds')}</summary>
            <dl>
              {thresholdRows.map(([key, value]) => <div key={key}><dt>{text(key)}</dt><dd>{Number(value)}</dd></div>)}
            </dl>
          </details>
        )}
      </section>

      <div className="url-evidence-grid">
        <section className="url-evidence-panel" aria-labelledby="url-evidence-model-title">
          <h3 id="url-evidence-model-title">{text('Model')}</h3>
          <dl>
            <div><dt>{text('Status')}</dt><dd><code>{ml.status || 'UNKNOWN'}</code></dd></div>
            <div><dt>{text('Classification')}</dt><dd><code>{ml.classification || 'UNKNOWN'}</code></dd></div>
            <div><dt>{text('Source')}</dt><dd><code>{ml.source || 'NOT_REPORTED'}</code></dd></div>
          </dl>
          <p className="url-evidence-note">{text('ModelAttribution')}</p>
        </section>

        <section className="url-evidence-panel" aria-labelledby="url-evidence-vt-title">
          <h3 id="url-evidence-vt-title">{text('VirusTotal')}</h3>
          <dl>
            <div><dt>{text('Status')}</dt><dd><code>{statusLabel(vt.status)}</code></dd></div>
            <div><dt>{text('Classification')}</dt><dd><code>{vt.classification || 'UNKNOWN'}</code></dd></div>
            {!unavailableCounts && countRows.map(([key, value]) => (
              <div key={key}><dt>{text(key)}</dt><dd>{Number.isFinite(Number(value)) ? Number(value) : '—'}</dd></div>
            ))}
            {unavailableCounts && <div><dt>{text('EngineCounts')}</dt><dd>{text('NotAvailable')}</dd></div>}
            {formatTimestamp(vt.last_analysis_date, lang) && <div><dt>{text('ProviderTime')}</dt><dd>{formatTimestamp(vt.last_analysis_date, lang)} UTC</dd></div>}
            {formatTimestamp(vt.evidence_timestamp, lang) && <div><dt>{text('ReportTime')}</dt><dd>{formatTimestamp(vt.evidence_timestamp, lang)} UTC</dd></div>}
            {vt.error && <div><dt>{text('ErrorCode')}</dt><dd><code>{String(vt.error).slice(0, 100)}</code></dd></div>}
          </dl>
          {scanners.length > 0 ? (
            <details className="url-evidence-details">
              <summary>{text('ScannerDetails')} ({vt.scanner_results_total ?? scanners.length})</summary>
              {vt.scanner_results_truncated && <p className="url-evidence-note">{text('ScannerResultsTruncated')}</p>}
              {!vt.scanner_results_truncated && Number(vt.scanner_results_omitted || 0) > 0 && <p className="url-evidence-note">{text('ScannerResultsOmitted')} ({vt.scanner_results_omitted})</p>}
              <div className="url-evidence-table-wrap">
                <table>
                  <thead><tr><th scope="col">{text('Engine')}</th><th scope="col">{text('Category')}</th><th scope="col">{text('Method')}</th><th scope="col">{text('RawResult')}</th></tr></thead>
                  <tbody>{scanners.map((item, index) => (
                    <tr key={`${item.engine_name || 'engine'}-${index}`}>
                      <td>{item.engine_name || '—'}</td><td><code>{item.category || 'unknown'}</code></td><td>{item.method || '—'}</td><td>{item.result || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          ) : <p className="url-evidence-note">{text('NoScannerDetails')}</p>}
        </section>
      </div>

      <section className="url-evidence-panel" aria-labelledby="url-evidence-observations-title">
        <h3 id="url-evidence-observations-title">{text('Observations')}</h3>
        {observations.length > 0 ? (
          <dl className="url-evidence-observations">
            {observations.map((item, index) => (
              <div key={`${item.code}-${index}`}>
                <dt>{text(observationKeys[item.code] || 'NotAvailable')}</dt>
                <dd>{displayValue(item.value, text, lang)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="url-evidence-note">{text('NotAvailable')}</p>}
        <p className="url-evidence-note">{text('FeatureLimit')}</p>
      </section>

      <section className="url-evidence-limitations" aria-labelledby="url-evidence-limits-title">
        <h3 id="url-evidence-limits-title">{text('Limitations')}</h3>
        <ul>
          {['CountsLimit', 'UndetectedLimit', 'FeatureLimit', 'InternalScoresLimit', 'TimeLimit'].map((key) => <li key={key}>{text(key)}</li>)}
        </ul>
      </section>

      {formatTimestamp(card.generated_at, lang) && <p className="url-evidence-generated">{text('GeneratedAt')}: {formatTimestamp(card.generated_at, lang)} UTC</p>}
    </section>
  );
}
