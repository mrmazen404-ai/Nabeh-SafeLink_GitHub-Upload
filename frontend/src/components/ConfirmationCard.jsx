import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { CheckIcon, CopyIcon, ShieldCheckIcon, AlertTriangleIcon } from './Icons';
import '../styles/theme.css';

export default function ConfirmationCard({
  title,
  description,
  refId,
  isScanNotice = false,
  onPrimaryAction,
  primaryLabel,
  onSecondaryAction,
  secondaryLabel
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    if (refId) {
      navigator.clipboard.writeText(refId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="card confirmation-card fade-in"
      role="region"
      aria-label={title || t('confirmation.processCompleteTitle')}
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
        borderTop: '4px solid var(--primary-color)',
        boxShadow: 'var(--shadow-md)',
        maxWidth: '520px',
        margin: 'var(--space-4) auto'
      }}
    >
      {/* Icon Badge - Using Tech Blue / Neutral checkmark to indicate Process Success */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-1)'
        }}
      >
        <ShieldCheckIcon size={32} color="var(--primary-color)" />
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 'var(--font-heading-2)', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
        {title || t('confirmation.processCompleteTitle')}
      </h3>

      {/* Description */}
      <p style={{ fontSize: 'var(--font-body)', color: 'var(--text-sub)', lineHeight: '1.5', margin: 0 }}>
        {description || t('confirmation.processCompleteDesc')}
      </p>

      {/* Explicit Security Notice if this is a scan process completion */}
      {isScanNotice && (
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-2)',
            textAlign: 'start',
            fontSize: '12px',
            color: 'var(--text-sub)',
            margin: 'var(--space-2) 0'
          }}
        >
          <AlertTriangleIcon size={18} color="var(--color-suspicious-dark)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{t('confirmation.scanNotice')}</span>
        </div>
      )}

      {/* Reference Ticket ID if applicable */}
      {refId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            backgroundColor: 'var(--bg-subtle)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}
        >
          <span>{refId}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopyRef}
            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
            aria-label={t('confirmation.copyRefId')}
          >
            {copied ? <CheckIcon size={12} color="var(--color-safe-dark)" /> : <CopyIcon size={12} />}
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', width: '100%', marginTop: 'var(--space-3)' }}>
        {onPrimaryAction && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onPrimaryAction}
            style={{ flex: 1 }}
          >
            {primaryLabel || t('confirmation.continueBtn')}
          </button>
        )}

        {onSecondaryAction && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onSecondaryAction}
            style={{ flex: 1 }}
          >
            {secondaryLabel || t('confirmation.backToHomeBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
