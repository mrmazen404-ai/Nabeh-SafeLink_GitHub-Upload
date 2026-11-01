import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { getStatistics, getScans } from '../services/api';
import { SearchIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, HelpCircleIcon } from '../components/Icons';

export default function Home({ onNavigate, onQuickScan, activeTab, setActiveTab, onNavigateAuth }) {
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, scansRes] = await Promise.all([getStatistics(), getScans()]);
        setStats(statsRes?.data || null);
        setRecentScans(Array.isArray(scansRes?.data) ? scansRes.data.slice(0, 5) : []);
        setError('');
      } catch (e) {
        setStats(null);
        setRecentScans([]);
        setError('تعذر تحميل بيانات الحساب. أعد المحاولة.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [retryKey]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg-subtle)' }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="page-container">
        {/* Desktop Top Grid Layout (2 Columns on Desktop) */}
        {error && <div className="card" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
          <div>{error}</div>
          <button type="button" className="btn btn-outline" onClick={() => { setError(''); setLoading(true); setRetryKey((value) => value + 1); }} style={{ marginTop: '12px' }}>
            إعادة المحاولة
          </button>
        </div>}
        <div className="home-hero-grid">
          {/* Hero Banner */}
          <div className="home-hero-card">
            <span className="hero-tag">NABEH SECURITY DASHBOARD</span>
            <h1 className="hero-title">نظام الكشف والوقاية الذكي</h1>
            <p className="hero-desc">
              فحص الروابط والرسائل بدقة متناهية عبر الذكاء الاصطناعي ومحركات الأمان العالمية لضمان سلامة جهازك وبياناتك.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('scan')}
              >
                <SearchIcon size={18} color="#FFFFFF" />
                <span>بدء فحص رابط الآن</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="home-stats-grid">
            <div className="card stat-card">
              <div className="stat-header">
                <CheckCircleIcon size={22} color="var(--color-success)" />
                <span className="stat-label">آمن</span>
              </div>
              <span className="stat-value">{loading ? '…' : (stats?.safe ?? '—')}</span>
              <span className="stat-sub">روابط موثوقة</span>
            </div>

            <div className="card stat-card">
              <div className="stat-header">
                <AlertTriangleIcon size={22} color="var(--color-warning)" />
                <span className="stat-label">مشبوه</span>
              </div>
              <span className="stat-value">{loading ? '…' : (stats?.suspicious ?? '—')}</span>
              <span className="stat-sub">بحاجة للحذر</span>
            </div>

            <div className="card stat-card">
              <div className="stat-header">
                <XCircleIcon size={22} color="var(--color-danger)" />
                <span className="stat-label">خطر</span>
              </div>
              <span className="stat-value">{loading ? '…' : (stats?.dangerous ?? '—')}</span>
              <span className="stat-sub">تهديد إلكتروني</span>
            </div>
          </div>
        </div>

        {/* Recent Scans Section (Wide Responsive Layout) */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
                آخر الفحوصات
              </h2>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>سجل العمليات التي تمت معالجتها مؤخراً</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}
            >
              عرض السجل الكامل ←
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {loading && <div role="status">جارٍ تحميل السجل…</div>}
            {!loading && recentScans.length === 0 && !error && <div>لا توجد فحوصات محفوظة بعد.</div>}
            {recentScans.map((scan, idx) => {
              const isSafe = scan.classification === 'SAFE';
              const isSuspicious = scan.classification === 'SUSPICIOUS';
              const isDangerous = scan.classification === 'DANGEROUS';
              const color = isSafe ? 'var(--color-success)' : isDangerous ? 'var(--color-danger)' : isSuspicious ? 'var(--color-warning)' : 'var(--color-text-muted)';
              const bg = isSafe ? 'var(--color-success-bg)' : isDangerous ? 'var(--color-danger-bg)' : isSuspicious ? 'var(--color-warning-bg)' : 'var(--color-bg-subtle)';
              const displayVal = scan.input_value_masked || scan.url || 'رابط مفحوص';

              return (
                <div
                  key={scan.id || idx}
                  onClick={() => onQuickScan(displayVal)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    border: '1px solid var(--color-border)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSafe ? <CheckCircleIcon size={18} color={color} /> : isDangerous || isSuspicious ? <AlertTriangleIcon size={18} color={color} /> : <HelpCircleIcon size={18} color={color} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} dir="ltr">
                      {displayVal}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {isSafe ? 'لم تُرصد مؤشرات' : isDangerous ? 'خطر' : isSuspicious ? 'مشبوه' : 'غير محدد'} • {scan.created_at || 'مؤخراً'}
                    </span>
                  </div>

                  <span style={{ color: 'var(--color-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>إعادة فحص ←</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <style>{`
        .home-hero-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-6);
        }

        .home-hero-card {
          background: linear-gradient(135deg, #0A2540 0%, #1A3A5C 100%);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          color: #FFFFFF;
          box-shadow: var(--shadow-sm);
        }

        .hero-tag {
          font-size: var(--text-xs);
          letter-spacing: 1px;
          opacity: 0.8;
          font-family: var(--font-mono);
          display: block;
          margin-bottom: var(--space-2);
        }

        .hero-title {
          font-size: var(--text-2xl);
          font-weight: 700;
          margin-bottom: var(--space-2);
        }

        .hero-desc {
          font-size: var(--text-sm);
          opacity: 0.9;
          line-height: 1.6;
          margin-bottom: var(--space-6);
        }

        .home-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-3);
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: var(--space-4);
        }

        .stat-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .stat-label {
          font-size: var(--text-xs);
          color: var(--color-text-secondary);
          font-weight: 600;
        }

        .stat-value {
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--color-primary);
          font-family: var(--font-mono);
        }

        .stat-sub {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        @media (min-width: 900px) {
          .home-hero-grid {
            grid-template-columns: 3fr 2fr;
          }
          .home-stats-grid {
            grid-template-columns: 1fr;
          }
          .stat-card {
            flex-direction: row;
            justify-content: space-between;
            text-align: right;
          }
        }
      `}</style>
    </div>
  );
}
