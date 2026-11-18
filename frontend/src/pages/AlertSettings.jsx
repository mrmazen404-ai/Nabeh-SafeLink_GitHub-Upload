import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import { getAccessToken } from '../services/authToken';
import { useLanguage } from '../context/LanguageContext';
import './advanced-pages.css';

const DEFAULT_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: false,
  dangerous_scan_enabled: true,
  weekly_summary_enabled: false,
};

const PREFERENCE_FIELDS = [
  { key: 'email_enabled', title: 'dashboard.notificationsSection.emailAlerts', description: 'alertSettingsPage.emailAlerts' },
  { key: 'in_app_enabled', title: 'dashboard.notificationsSection.inAppAlerts', description: 'alertSettingsPage.inAppAlertsDesc' },
  { key: 'dangerous_scan_enabled', title: 'dashboard.notificationsSection.securityAlerts', description: 'alertSettingsPage.securityAlerts' },
  { key: 'weekly_summary_enabled', title: 'dashboard.notificationsSection.weeklySummary', description: 'alertSettingsPage.weeklySummaryDesc' },
];

function authConfig() {
  return { headers: { Authorization: `Bearer ${getAccessToken()}` } };
}

function toPreferencePayload(preferences) {
  return Object.fromEntries(PREFERENCE_FIELDS.map(({ key }) => [key, Boolean(preferences[key])]));
}

export default function AlertSettings({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t } = useLanguage();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('status');

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setMessage('');
    try {
      const res = await api.get('/dashboard/notification-preferences', authConfig());
      const data = res.data?.data;
      setPreferences({ ...DEFAULT_PREFERENCES, ...(data && typeof data === 'object' ? data : {}) });
    } catch {
      setPreferences(null);
      setLoadFailed(true);
      setMessage(t('alertSettingsPage.loadError'));
      setMessageType('alert');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  async function savePreferences(event) {
    event.preventDefault();
    if (!preferences || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = toPreferencePayload(preferences);
      const res = await api.patch('/dashboard/notification-preferences', payload, authConfig());
      const saved = res.data?.data;
      setPreferences({ ...DEFAULT_PREFERENCES, ...(saved && typeof saved === 'object' ? saved : payload) });
      setMessage(t('alertSettingsPage.saveSuccess'));
      setMessageType('status');
    } catch {
      setMessage(t('alertSettingsPage.saveError'));
      setMessageType('alert');
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

        {message && !loadFailed && (
          <div className="advanced-card" role={messageType} aria-live={messageType === 'status' ? 'polite' : 'assertive'} style={{ marginBottom: '18px', padding: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>{message}</p>
          </div>
        )}

        {loading ? (
          <div className="advanced-card" role="status" aria-live="polite" aria-busy="true" style={{ textAlign: 'center', padding: '40px' }}>
            {t('alertSettingsPage.loading')}
          </div>
        ) : loadFailed ? (
          <div className="advanced-card" role="alert" style={{ display: 'grid', justifyItems: 'start', gap: '16px', padding: '24px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>{message || t('alertSettingsPage.loadError')}</p>
            <button type="button" className="primary-button" onClick={loadPreferences}>
              {t('alertSettingsPage.retryBtn')}
            </button>
          </div>
        ) : (
          <form onSubmit={savePreferences} className="advanced-card" aria-busy={saving}>
            <div style={{ display: 'grid', gap: '16px' }}>
              {PREFERENCE_FIELDS.map(({ key, title, description }) => {
                const inputId = `alert-preference-${key}`;
                const descriptionId = `${inputId}-description`;
                return (
                  <label
                    key={key}
                    htmlFor={inputId}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: saving ? 'not-allowed' : 'pointer', padding: '14px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'var(--color-bg-subtle)' }}
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={Boolean(preferences?.[key])}
                      onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                      disabled={saving}
                      aria-describedby={descriptionId}
                      style={{ flex: '0 0 auto', width: '20px', height: '20px', accentColor: 'var(--color-secondary)' }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text)', fontSize: '15px' }}>
                        {t(title)}
                      </strong>
                      <span id={descriptionId} style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
                        {t(description)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="submit" className="primary-button" disabled={saving} aria-busy={saving}>
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
