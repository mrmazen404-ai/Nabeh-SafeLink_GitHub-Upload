import { useState } from 'react';
import Logo from '../../components/Logo';
import { ShieldCheckIcon, SearchIcon, SparklesIcon } from '../../components/Icons';
import { useLanguage } from '../../context/LanguageContext';
import AuthPageControls from '../../components/AuthPageControls';

const STEP_ICONS = [ShieldCheckIcon, SearchIcon, SparklesIcon];

export default function Onboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t, dir } = useLanguage();

  const steps = [
    {
      title: t('onboarding.step1Title'),
      subtitle: t('onboarding.step1Subtitle'),
      icon: STEP_ICONS[0],
    },
    {
      title: t('onboarding.step2Title'),
      subtitle: t('onboarding.step2Subtitle'),
      icon: STEP_ICONS[1],
    },
    {
      title: t('onboarding.step3Title'),
      subtitle: t('onboarding.step3Subtitle'),
      icon: STEP_ICONS[2],
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const StepIcon = steps[currentStep].icon;

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: '24px' }} dir={dir}>
      <AuthPageControls />
      <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
          <Logo size="lg" showTagline={true} />
        </div>

        <div style={{ margin: 'var(--space-6) 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-secondary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <StepIcon size={32} color="var(--color-secondary)" />
          </div>
        </div>

        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
          {steps[currentStep].title}
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          {steps[currentStep].subtitle}
        </p>

        {/* Step Indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: 'var(--space-6)' }} role="tablist" aria-label="Onboarding steps">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === currentStep}
              aria-label={`Step ${i + 1}`}
              onClick={() => setCurrentStep(i)}
              style={{
                width: i === currentStep ? '24px' : '8px',
                height: '8px',
                padding: 0,
                border: 0,
                borderRadius: '4px',
                background: i === currentStep ? 'var(--color-secondary)' : 'var(--color-border)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onComplete}
            style={{ flex: 1 }}
          >
            {t('onboarding.skip')}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNext}
            style={{ flex: 1 }}
          >
            {currentStep === steps.length - 1 ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </main>
  );
}
