import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Logo from './Logo';
import '../styles/theme.css';

export default function ServiceUnavailablePage({ onCheckAgain }) {
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await onCheckAgain?.();
    } finally {
      setChecking(false);
    }
  };

  return (
    <main
      className="page-container"
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <section
        className="card service-unavailable-card"
        role="alert"
        aria-live="assertive"
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
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <Logo size="medium" showTagline={false} />
        <h1 style={{ margin: 0 }}>{t('serviceUnavailable.title')}</h1>
        <p style={{ maxWidth: '460px', lineHeight: '1.7', margin: 0 }}>
          {t('serviceUnavailable.desc')}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? t('serviceUnavailable.checking') : t('serviceUnavailable.retryBtn')}
        </button>
      </section>
    </main>
  );
}
