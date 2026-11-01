import React from 'react';
import { frontendLog } from '../services/observability';

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    frontendLog('frontend_render_error', {
      error_type: error?.name || 'Error',
      component_stack_length: errorInfo?.componentStack?.length || 0,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'var(--color-bg-subtle, #f8fafc)',
          color: 'var(--color-text, #0f172a)',
          fontFamily: "'Cairo', 'IBM Plex Sans Arabic', -apple-system, sans-serif",
          direction: isAr ? 'rtl' : 'ltr',
          textAlign: isAr ? 'right' : 'left'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--color-bg, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '20px',
            padding: '32px 24px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-danger-bg, #fef2f2)',
              border: '1px solid var(--color-danger-border, #fecaca)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: 'var(--color-danger, #dc2626)'
            }}>
              ⚠️
            </div>

            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--color-primary, #0a2540)' }}>
              {isAr ? 'حدث خطأ غير متوقع في الواجهة' : 'An unexpected error occurred'}
            </h1>

            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary, #334155)', margin: 0, lineHeight: 1.6 }}>
              {isAr
                ? 'تعذر تحميل الصفحة بشكل صحيح. يمكنك إعادة المحاولة الآن أو العودة للرئيسية.'
                : 'Unable to render the view properly. You can retry now or return to the main workspace.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '8px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '12px 22px',
                  background: 'var(--color-secondary, #1e90ff)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  flex: '1 1 140px',
                  minWidth: '140px'
                }}
              >
                {isAr ? 'إعادة تحميل الصفحة' : 'Reload Page'}
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  padding: '12px 22px',
                  background: 'var(--color-bg-subtle, #f8fafc)',
                  color: 'var(--color-text-secondary, #334155)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  flex: '1 1 140px',
                  minWidth: '140px'
                }}
              >
                {isAr ? 'العودة للرئيسية' : 'Go to Home'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
