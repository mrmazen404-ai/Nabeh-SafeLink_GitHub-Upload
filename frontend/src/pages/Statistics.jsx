import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getStatistics } from '../services/api';
import { CheckCircleIcon, AlertTriangleIcon, XCircleIcon, BarChartIcon } from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';

export default function Statistics({ activeTab, setActiveTab, isGuest = true, onNavigateAuth }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (isGuest) {
      setStats(null);
      setLoading(false);
      return;
    }
    async function loadStats() {
      try {
        const res = await getStatistics();
        setStats(res?.data || null);
        setError('');
      } catch (e) {
        setStats(null);
        setError('تعذر تحميل الإحصاءات. أعد المحاولة.');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [isGuest, retryKey]);

  if (isGuest) return null;

  const total = stats?.total || 0;
  const safePct = ((stats?.safe || 0) / Math.max(total, 1) * 100).toFixed(1);
  const suspPct = ((stats?.suspicious || 0) / Math.max(total, 1) * 100).toFixed(1);
  const dangPct = ((stats?.dangerous || 0) / Math.max(total, 1) * 100).toFixed(1);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg-subtle)' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container" aria-label={t('stats.title')}>
        {error && <div className="card" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <div>{error}</div>
          <button type="button" className="btn btn-outline" onClick={() => { setError(''); setLoading(true); setRetryKey((value) => value + 1); }} style={{ marginTop: '12px' }}>
            إعادة المحاولة
          </button>
        </div>}
        {loading && <div role="status" style={{ marginBottom: 'var(--space-4)' }}>جارٍ تحميل الإحصاءات…</div>}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
            {t('stats.title')}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {t('stats.subtitle')}
          </p>
        </div>

        {/* Total Card */}
        <div
          className="stats-total-card"
          style={{
            background: 'linear-gradient(135deg, #0A2540 0%, #16385C 100%)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
            color: '#FFFFFF',
            marginBottom: 'var(--space-6)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', opacity: 0.85, fontWeight: 600 }}>{t('stats.totalLabel')}</span>
              <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, fontFamily: 'var(--font-en)', marginTop: 'var(--space-1)' }}>{loading ? '…' : (stats?.total ?? '—')}</h2>
            </div>
            <BarChartIcon size={44} color="var(--color-secondary)" />
          </div>
        </div>

        {/* Desktop 2-Column Responsive Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
          {/* Breakdown Progress Bars */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-4)' }}>
              {t('stats.distributionTitle')}
            </h3>

            {/* Safe */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)' }}>
                  <CheckCircleIcon size={16} color="var(--color-success)" /> {t('stats.safeLabel')}
                </span>
                  <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-en)' }}>{stats?.safe ?? '—'} ({safePct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${safePct}%`, height: '100%', background: 'var(--color-success)', borderRadius: 'var(--radius-sm)', transition: 'width var(--transition-base)' }}></div>
              </div>
            </div>

            {/* Suspicious */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-warning)' }}>
                  <AlertTriangleIcon size={16} color="var(--color-warning)" /> {t('stats.suspiciousLabel')}
                </span>
                  <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-en)' }}>{stats?.suspicious ?? '—'} ({suspPct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${suspPct}%`, height: '100%', background: 'var(--color-warning)', borderRadius: 'var(--radius-sm)', transition: 'width var(--transition-base)' }}></div>
              </div>
            </div>

            {/* Dangerous */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-danger)' }}>
                  <XCircleIcon size={16} color="var(--color-danger)" /> {t('stats.dangerousLabel')}
                </span>
                  <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-en)' }}>{stats?.dangerous ?? '—'} ({dangPct}%)</span>
              </div>
              <div style={{ height: '10px', background: 'var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${dangPct}%`, height: '100%', background: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', transition: 'width var(--transition-base)' }}></div>
              </div>
            </div>
          </div>

          <div className="card" role="note">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
              {t('stats.fraudTypesTitle')}
            </h3>
            {stats?.fraud_types && stats.fraud_types.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                {stats.fraud_types.map((ft) => (
                  <div key={ft.code} style={{ background: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', display: 'block' }}>{ft.code}</span>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', display: 'block', margin: '4px 0' }}>{ft.name_ar}</strong>
                    <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-danger)' }}>{ft.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                لا توجد أنواع احتيال مرصودة في الفحوصات الحالية.
              </p>
            )}
          </div>
        </div>
      </main>

      <style>{`
        [data-theme="dark"] .stats-total-card {
          background: linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%) !important;
          border: 1px solid var(--color-border);
        }
      `}</style>
      <Footer activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
