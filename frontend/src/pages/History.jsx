import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getScans } from '../services/api';
import { CheckCircleIcon, AlertTriangleIcon, SearchIcon } from '../components/Icons';
import { useLanguage } from '../context/LanguageContext';

export default function History({ onQuickScan, activeTab, setActiveTab, isGuest = true, onNavigateAuth }) {
  const { t, dir, lang } = useLanguage();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isGuest) {
      setScans([]);
      setLoading(false);
      return;
    }
    async function loadScans() {
      try {
        const res = await getScans();
        setScans(res && Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (e) {
        setScans([]);
        setError('تعذر تحميل سجل الفحوصات. أعد المحاولة.');
      } finally {
        setLoading(false);
      }
    }
    loadScans();
  }, [isGuest, retryKey]);

  if (isGuest) return null;

  const filteredScans = scans.filter((s) => {
    const matchFilter = filter === 'ALL' || s.classification === filter;
    const matchQuery = (s.input_value_masked || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchQuery;
  });

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg-subtle)' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container" aria-label={t('history.title')}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
            {t('history.title')}
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {t('history.subtitle')}
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
            <span style={{ position: 'absolute', insetInlineEnd: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <SearchIcon size={18} color="var(--color-text-muted)" />
            </span>
            <input
              type="text"
              placeholder={t('history.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('history.searchPlaceholder')}
              style={{
                width: '100%',
                minHeight: '46px',
                padding: '10px 44px 10px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'inherit',
                background: 'var(--color-bg)',
                color: 'var(--color-text)'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="tablist" aria-label={t('history.title')}>
            {[
              { id: 'ALL', label: t('history.filterAll') },
              { id: 'SAFE', label: lang === 'ar' ? 'لم تُرصد مؤشرات' : 'No indicators detected' },
              { id: 'SUSPICIOUS', label: t('history.filterSuspicious') },
              { id: 'DANGEROUS', label: t('history.filterDangerous') }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: filter === f.id ? 'var(--color-secondary)' : 'var(--color-border)',
                  background: filter === f.id ? 'var(--color-secondary-subtle)' : 'var(--color-bg)',
                  color: filter === f.id ? 'var(--color-secondary)' : 'var(--color-text-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List Items */}
        {error && <div className="card" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <div>{error}</div>
          <button type="button" className="btn btn-outline" onClick={() => { setError(''); setLoading(true); setRetryKey((value) => value + 1); }} style={{ marginTop: '12px' }}>
            إعادة المحاولة
          </button>
        </div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {loading && <div className="card" role="status">جارٍ تحميل السجل…</div>}
          {!loading && !error && filteredScans.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>
              {t('history.emptyState')}
            </div>
          ) : !loading && !error ? (
            filteredScans.map((scan, idx) => {
              const isSafe = scan.classification === 'SAFE';
              const isDangerous = scan.classification === 'DANGEROUS';
              const color = isSafe ? 'var(--color-success)' : isDangerous ? 'var(--color-danger)' : 'var(--color-warning)';
              const bg = isSafe ? 'var(--color-success-bg)' : isDangerous ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)';
              const displayVal = scan.input_value_masked || t('home.scannedUrl');
              const statusText = isSafe
                ? (lang === 'ar' ? 'لم تُرصد مؤشرات' : 'No indicators detected')
                : isDangerous
                  ? t('history.filterDangerous')
                  : scan.classification === 'SUSPICIOUS'
                    ? t('history.filterSuspicious')
                    : t('scanDetails.labels.UNKNOWN');

              return (
                <button
                  key={scan.id || idx}
                  type="button"
                  className="card"
                  onClick={() => scan.id ? navigate(`/scan-details/${encodeURIComponent(scan.id)}`) : onQuickScan(displayVal)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    textAlign: dir === 'rtl' ? 'right' : 'left',
                    width: '100%',
                    fontFamily: 'inherit'
                  }}
                  aria-label={t('home.rescanLabel', { url: displayVal })}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      background: bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isSafe ? <CheckCircleIcon size={18} color={color} /> : <AlertTriangleIcon size={18} color={color} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} dir="ltr">
                      {displayVal}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {statusText} • {lang === 'ar' ? 'درجة الثقة غير متاحة' : 'Confidence unavailable'}
                    </span>
                  </div>

                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-secondary)', fontWeight: 700 }}>{t('history.rescanBtn')}</span>
                </button>
              );
            })
          ) : null}
        </div>
      </main>
      <Footer activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
