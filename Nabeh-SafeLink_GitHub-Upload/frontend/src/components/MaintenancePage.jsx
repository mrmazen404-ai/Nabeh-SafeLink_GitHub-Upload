import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Logo from './Logo';
import { ShieldCheckIcon, HelpCircleIcon } from './Icons';
import '../styles/theme.css';

export default function MaintenancePage({ onCheckAgain, onNavigate }) {
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    if (onCheckAgain) {
      await onCheckAgain();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setChecking(false);
  };

  return (
    <div
      className="page-container"
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6) var(--space-4)'
      }}
    >
      <div
        className="card maintenance-card"
        role="region"
        aria-label={t('maintenance.title')}
        style={{
          maxWidth: '580px',
          width: '100%',
          textAlign: 'center',
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
          borderTop: '4px solid var(--primary-color)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* Logo */}
        <Logo size="medium" showTagline={false} />

        {/* Maintenance Badge */}
        <div
          style={{
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary-color)',
            fontSize: '12px',
            fontWeight: '600',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            marginTop: 'var(--space-2)'
          }}
        >
          {t('maintenance.statusBadge')}
        </div>

        {/* Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 'var(--space-2) 0'
          }}
        >
          <ShieldCheckIcon size={36} color="var(--primary-color)" />
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'var(--font-heading-1)', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
          {t('maintenance.title')}
        </h1>

        {/* Description */}
        <p style={{ fontSize: 'var(--font-body)', color: 'var(--text-sub)', lineHeight: '1.6', margin: 0, maxWidth: '460px' }}>
          {t('maintenance.desc')}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center', width: '100%', marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCheck}
            disabled={checking}
            style={{ flex: '1 1 160px', minWidth: '160px' }}
          >
            {checking ? t('maintenance.checkingStatus') : t('maintenance.checkAgainBtn')}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('faq')}
            style={{ flex: '1 1 160px', minWidth: '160px' }}
          >
            <HelpCircleIcon size={16} />
            <span>{t('maintenance.helpBtn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
