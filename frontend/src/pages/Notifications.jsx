import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import { getAccessToken } from '../services/authToken';
import { useLanguage } from '../context/LanguageContext';
import { InfoIcon } from '../components/Icons';
import './advanced-pages.css';

function authConfig() {
  return { headers: { Authorization: `Bearer ${getAccessToken()}` } };
}

function formatDate(value, lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

export default function Notifications({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t, lang } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/notifications', authConfig());
      setNotifications(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setMessage(t('notificationsPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function markAllRead() {
    try {
      await api.post('/dashboard/notifications/read-all', {}, authConfig());
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      setMessage(t('notificationsPage.markAllSuccess'));
    } catch {
      setMessage(t('notificationsPage.markAllError'));
    }
  }

  return (
    <div className="advanced-page" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="advanced-container">
        <div className="page-title-row">
          <div>
            <span className="advanced-kicker">Nabeh SafeLink</span>
            <h1>{t('notificationsPage.title')}</h1>
            <p>{t('notificationsPage.subtitle')}</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={markAllRead}
            disabled={notifications.length === 0}
          >
            {t('notificationsPage.markAllBtn')}
          </button>
        </div>

        {message && (
          <div className="advanced-card" role="alert" style={{ marginBottom: '18px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>{message}</p>
          </div>
        )}

        {loading ? (
          <div className="advanced-card" role="status" style={{ textAlign: 'center', padding: '40px' }}>
            {t('notificationsPage.loading')}
          </div>
        ) : notifications.length === 0 ? (
          <div className="advanced-card" style={{ textAlign: 'center', padding: '50px', color: 'var(--color-text-muted)' }}>
            <InfoIcon style={{ width: '36px', height: '36px', marginBottom: '12px', opacity: 0.6 }} />
            <p>{t('notificationsPage.emptyState')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {notifications.map((item) => (
              <div
                key={item.id}
                className="advanced-card"
                style={{
                  padding: '18px',
                  borderInlineStart: item.is_read ? '4px solid var(--color-border)' : '4px solid var(--color-secondary)',
                  background: item.is_read ? 'var(--color-bg)' : 'var(--color-secondary-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-text)', fontWeight: 700 }}>
                    {item.title}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {formatDate(item.created_at, lang)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
