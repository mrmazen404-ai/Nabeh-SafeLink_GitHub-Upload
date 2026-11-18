import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangleIcon, CopyIcon, CheckIcon, HelpCircleIcon } from './Icons';
import '../styles/theme.css';

export default function ErrorPage({ type = '404', refId, onRetry, onNavigate }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const is404 = type === '404';

  const handleCopyRef = () => {
    if (refId) {
      navigator.clipboard.writeText(refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="page-container" style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6) var(--space-4)' }}>
      <div
        className="card error-page-card"
        role="alert"
        aria-live="assertive"
        style={{
          maxWidth: '560px',
          width: '100%',
          textAlign: 'center',
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
          borderTop: is404 ? '4px solid var(--primary-color)' : '4px solid var(--color-suspicious-dark)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Visual Badge */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: is404 ? 'var(--primary-light)' : 'var(--color-suspicious-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 'var(--space-2)'
          }}
        >
          {is404 ? (
            <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary-color)', fontFamily: 'Poppins, sans-serif' }}>
              404
            </span>
          ) : (
            <AlertTriangleIcon size={36} color="var(--color-suspicious-dark)" />
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'var(--font-heading-1)', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
          {is404 ? t('error.notFoundTitle') : t('error.internalTitle')}
        </h1>

        {/* Description */}
        <p style={{ fontSize: 'var(--font-body)', color: 'var(--text-sub)', lineHeight: '1.6', margin: 0, maxWidth: '440px' }}>
          {is404 ? t('error.notFoundDesc') : t('error.internalDesc')}
        </p>

        {/* Reference Code Box for 500 */}
        {!is404 && refId && (
          <div
            style={{
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: 'var(--space-2) 0'
            }}
          >
            <div style={{ textAlign: 'start' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-sub)', display: 'block' }}>
                {t('error.refCodeLabel')}
              </span>
              <strong style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-main)' }}>
                {refId}
              </strong>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyRef}
              style={{ padding: '6px 12px', fontSize: '12px' }}
              aria-label={t('error.copyRefBtn')}
            >
              {copied ? <CheckIcon size={14} color="var(--color-safe-dark)" /> : <CopyIcon size={14} />}
              <span>{copied ? t('error.copiedRefBtn') : t('error.copyRefBtn')}</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center', width: '100%', marginTop: 'var(--space-4)' }}>
          {/* Retry Button for 500 if callback provided */}
          {!is404 && onRetry && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRetry}
              style={{ flex: '1 1 140px', minWidth: '140px' }}
            >
              {t('error.retryBtn')}
            </button>
          )}

          {/* Home Button */}
          <button
            type="button"
            className={!is404 && onRetry ? 'btn btn-secondary' : 'btn btn-primary'}
            onClick={() => onNavigate && onNavigate('home')}
            style={{ flex: '1 1 140px', minWidth: '140px' }}
          >
            {t('error.goHomeBtn')}
          </button>

          {/* Help Center Link */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('faq')}
            style={{ flex: '1 1 120px', minWidth: '120px' }}
          >
            <HelpCircleIcon size={16} />
            <span>{t('error.helpBtn')}</span>
          </button>

          {/* Report Issue for 500 */}
          {!is404 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate && onNavigate('contact')}
              style={{ flex: '1 1 120px', minWidth: '120px' }}
            >
              {t('error.reportIssueBtn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
