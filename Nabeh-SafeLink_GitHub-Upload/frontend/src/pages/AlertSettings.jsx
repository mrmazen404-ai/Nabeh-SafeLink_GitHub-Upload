import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import { getAccessToken } from '../services/authToken';
import { useLanguage } from '../context/LanguageContext';
import './advanced-pages.css';

function authConfig() {
  return { headers: { Authorization: `Bearer ${getAccessToken()}` } };
}

export default function AlertSettings({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t } = useLanguage();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/notification-preferences', authConfig());
      setPreferences(res.data?.data || { email_alerts: true, push_alerts: true, security_alerts: true });
    } catch {
      setMessage(t('alertSettingsPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  async function savePreferences(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await api.patch('/dashboard/notification-preferences', preferences, authConfig());
      setPreferences(res.data?.data || preferences);
      setMessage(t('alertSettingsPage.saveSuccess'));
    } catch {
      setMessage(t('alertSettingsPage.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="advanced-page" dir={dir}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <main className="advanced-container" style={{ maxWidth: '850px' }}>
        <div className="page-title-row">
          <div>
            <span className="advanced-kicker">Nabeh SafeLink</span>
            <h1>{t('alertSettingsPage.title')}</h1>
            <p>{t('alertSettingsPage.subtitle')}</p>
          </div>
        </div>

        {message && (
          <div className="advanced-card" role="alert" style={{ marginBottom: '18px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>{message}</p>
          </div>
        )}

        {loading ? (
          <div className="advanced-card" role="status" style={{ textAlign: 'center', padding: '40px' }}>
            {t('alertSettingsPage.savingBtn')}
          </div>
        ) : (
          <form onSubmit={savePreferences} className="advanced-card">
            <div style={{ display: 'grid', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-bg-subtle)' }}>
                <input
                  type="checkbox"
                  checked={!!preferences?.email_alerts}
                  onChange={(e) => setPreferences({ ...preferences, email_alerts: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-secondary)' }}
                />
                <div>
                  <strong style={{ fontSize: '15px', color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                    {t('dashboard.notificationsSection.emailAlerts')}
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {t('alertSettingsPage.emailAlerts')}
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-bg-subtle)' }}>
                <input
                  type="checkbox"
                  checked={!!preferences?.push_alerts}
                  onChange={(e) => setPreferences({ ...preferences, push_alerts: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-secondary)' }}
                />
                <div>
                  <strong style={{ fontSize: '15px', color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                    {t('dashboard.notificationsSection.pushAlerts')}
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {t('alertSettingsPage.pushAlerts')}
                  </span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-bg-subtle)' }}>
                <input
                  type="checkbox"
                  checked={!!preferences?.security_alerts}
                  onChange={(e) => setPreferences({ ...preferences, security_alerts: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--color-secondary)' }}
                />
                <div>
                  <strong style={{ fontSize: '15px', color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>
                    {t('dashboard.notificationsSection.securityAlerts')}
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {t('alertSettingsPage.securityAlerts')}
                  </span>
                </div>
              </label>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? t('alertSettingsPage.savingBtn') : t('alertSettingsPage.saveBtn')}
              </button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
