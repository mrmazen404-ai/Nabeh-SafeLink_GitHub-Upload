import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import { getAccessToken } from '../services/authToken';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangleIcon, BarChartIcon, CheckCircleIcon, ClipboardIcon, InfoIcon, MailIcon, SearchIcon, ShieldCheckIcon, UserIcon } from '../components/Icons';
import './dashboard.css';

const EMPTY_STATS = { total: 0, safe: 0, suspicious: 0, dangerous: 0, unknown: 0 };

function authConfig() {
  return { headers: { Authorization: `Bearer ${getAccessToken()}` } };
}

function formatDate(value, lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ClassificationBadge({ value, t }) {
  const key = (value || 'UNKNOWN').toLowerCase();
  const label = t(`dashboard.labels.${key}`) || t('dashboard.labels.unknown');
  return <span className={`result-tag ${key}`} style={{ fontSize: '11px', padding: '4px 10px' }}>{label}</span>;
}

export default function Dashboard({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t, lang, canChangeLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [scans, setScans] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [consents, setConsents] = useState([]);
  const [securityActivity, setSecurityActivity] = useState([]);
  const [liveStats, setLiveStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profile, setProfile] = useState({ display_name: '', preferred_language: 'ar', timezone: '' });
  const [active, setActive] = useState(() => searchParams.get('section') || 'overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, scansRes, profileRes, notificationsRes, preferencesRes, consentRes, activityRes, liveRes, feedRes] = await Promise.all([
        api.get('/dashboard/overview', authConfig()),
        api.get('/scans/', authConfig()),
        api.get('/dashboard/profile', authConfig()),
        api.get('/dashboard/notifications', authConfig()),
        api.get('/dashboard/notification-preferences', authConfig()),
        api.get('/dashboard/privacy/consents', authConfig()),
        api.get('/dashboard/security/activity', authConfig()),
        api.get('/dashboard/live-stats', authConfig()),
        api.get('/dashboard/activity?limit=30', authConfig()),
      ]);
      setOverview(overviewRes.data?.data || null);
      setScans(Array.isArray(scansRes.data?.data) ? scansRes.data.data : []);
      setProfile(profileRes.data?.data || {});
      setNotifications(notificationsRes.data?.data || []);
      setPreferences(preferencesRes.data?.data || null);
      setConsents(consentRes.data?.data || []);
      setSecurityActivity(activityRes.data?.data || []);
      setLiveStats(liveRes.data?.data || null);
      setActivities(feedRes.data?.data || []);
    } catch {
      setMessage(t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const refreshLive = useCallback(async () => {
    const [liveRes, feedRes] = await Promise.all([
      api.get('/dashboard/live-stats', authConfig()),
      api.get('/dashboard/activity?limit=30', authConfig()),
    ]);
    setLiveStats(liveRes.data?.data || null);
    setActivities(feedRes.data?.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const section = searchParams.get('section');
    if (['overview', 'history', 'profile', 'security', 'notifications', 'privacy'].includes(section)) setActive(section);
  }, [searchParams]);
  useEffect(() => {
    const timer = window.setInterval(() => { refreshLive().catch(() => undefined); }, 20000);
    return () => window.clearInterval(timer);
  }, [refreshLive]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return undefined;
    let socket;
    let reconnectTimer;
    let heartbeat;
    let stopped = false;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/dashboard/ws`;
      socket = new WebSocket(wsUrl);
      setRealtimeStatus('connecting');

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', token: token }));
        setRealtimeStatus('connected');
        heartbeat = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'dashboard_event') {
            refreshLive().catch(() => undefined);
            if (payload.event?.kind === 'dangerous_scan') {
              setMessage(t('dashboard.liveAlert'));
            } else if (payload.event?.kind === 'scan') {
              setMessage(t('dashboard.liveUpdate'));
            }
          }
        } catch {
          // ignore bad payload
        }
      };

      socket.onclose = () => {
        setRealtimeStatus('disconnected');
        if (heartbeat) window.clearInterval(heartbeat);
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 5000);
        }
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (heartbeat) window.clearInterval(heartbeat);
      if (socket) socket.close();
    };
  }, [refreshLive, t]);

  // FastAPI returns the overview counters under `statistics`.
  const stats = overview?.statistics || EMPTY_STATS;
  const permissions = overview?.permissions || {};
  const permissionItems = Object.entries(permissions);
  const displayName = profile?.display_name || user?.display_name || user?.email?.split('@')[0] || (lang === 'ar' ? 'المستخدم' : 'User');

  async function saveProfile(event) {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const payload = { ...profile };
      if (!canChangeLanguage) delete payload.preferred_language;
      const result = await api.patch('/dashboard/profile', payload, authConfig());
      setProfile(result.data?.data || profile);
      setMessage(lang === 'ar' ? 'تم تحديث الملف الشخصي بنجاح.' : 'Profile updated successfully.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر حفظ الملف الشخصي.' : 'Failed to save profile.');
    } finally { setLoading(false); }
  }

  async function savePreferences() {
    if (!preferences) return;
    setSaving(true); setMessage('');
    try {
      const result = await api.patch('/dashboard/notification-preferences', preferences, authConfig());
      setPreferences(result.data?.data || preferences);
      setMessage(lang === 'ar' ? 'تم حفظ تفضيلات الإشعارات بنجاح.' : 'Preferences saved successfully.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر حفظ تفضيلات الإشعارات.' : 'Failed to save preferences.');
    } finally { setSaving(false); }
  }

  async function markAllRead() {
    try {
      await api.post('/dashboard/notifications/read-all', {}, authConfig());
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      setMessage(t('notificationsPage.markAllSuccess'));
    } catch {
      setMessage(t('notificationsPage.markAllError'));
    }
  }

  async function updateConsent(type, granted) {
    try {
      await api.post('/dashboard/privacy/consents', { consent_type: type, version: '1.0', granted }, authConfig());
      const result = await api.get('/dashboard/privacy/consents', authConfig());
      setConsents(result.data?.data || []);
      setMessage(lang === 'ar' ? 'تم تحديث إعداد الخصوصية.' : 'Privacy preference updated.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر تحديث إعداد الخصوصية.' : 'Failed to update privacy preference.');
    }
  }

  async function changePassword(event) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const result = await api.post('/dashboard/security/change-password', passwordForm, authConfig());
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage(result.data?.message || t('dashboard.changePasswordSuccess'));
    } catch (error) {
      setMessage(error?.response?.data?.detail || t('dashboard.changePasswordError'));
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <main className="welcome-page" dir={dir}>
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />
        <div style={{ maxWidth: '1180px', margin: '80px auto', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '18px' }}>
          {t('dashboard.loading')}
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="welcome-page" dir={dir}>
      <div className="welcome-glow welcome-glow-one" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-two" aria-hidden="true" />

      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <div style={{ width: 'min(100%, 1180px)', margin: '40px auto 80px' }}>
        <div className="welcome-graduation" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <span className="welcome-eyebrow"><span className="welcome-eyebrow-dot" />Nabeh SafeLink</span>
              <h1 style={{ fontFamily: 'Poppins, Cairo, sans-serif', fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: 'var(--color-primary)', margin: '8px 0 6px' }}>
                {lang === 'ar' ? `مرحباً، ${displayName}` : `Welcome, ${displayName}`}
              </h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', margin: 0 }}>
                {lang === 'ar' ? 'كل ما تحتاجه لمراقبة أمان روابطك وحسابك في مكان واحد.' : 'Everything you need to monitor link & account security in one workspace.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ padding: '8px 16px', background: 'var(--color-secondary-subtle)', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: 'var(--color-secondary)' }}>
                {overview?.user?.role === 'USER' ? (lang === 'ar' ? 'مستخدم مسجل' : 'Registered User') : overview?.user?.role || (lang === 'ar' ? 'مستخدم' : 'User')}
              </span>
              <button type="button" className="welcome-secondary-button" onClick={logout}>
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="welcome-graduation" style={{ marginBottom: '24px', padding: '16px 24px', background: 'var(--color-secondary-subtle)', borderColor: 'var(--color-secondary)' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--color-primary)' }}>{message}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)', padding: '8px', borderRadius: '16px', border: '1px solid var(--color-border)', marginBottom: '32px', overflowX: 'auto', backdropFilter: 'blur(12px)' }}>
          {[
            ['overview', t('dashboard.tabs.overview')],
            ['history', t('dashboard.tabs.history')],
            ['profile', t('dashboard.tabs.profile')],
            ['security', t('dashboard.tabs.security')],
            ['notifications', `${t('dashboard.tabs.notifications')}${notifications.some((n) => !n.is_read) ? ' •' : ''}`],
            ['privacy', t('dashboard.tabs.privacy')]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={active === key ? 'welcome-primary-button' : 'welcome-secondary-button'}
              style={{
                borderRadius: '11px',
                padding: '10px 20px',
                fontSize: '13px',
                boxShadow: active === key ? undefined : 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {active === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', marginBottom: '32px' }}>
              <StatCard icon={<ClipboardIcon />} label={t('dashboard.overview.totalScans')} value={stats.total} tone="blue" />
              <StatCard icon={<CheckCircleIcon />} label={t('dashboard.overview.safeScans')} value={stats.safe} tone="green" />
              <StatCard icon={<InfoIcon />} label={t('dashboard.overview.suspiciousScans')} value={stats.suspicious} tone="amber" />
              <StatCard icon={<AlertTriangleIcon />} label={t('dashboard.overview.dangerousScans')} value={stats.dangerous} tone="red" />
            </div>

            <div className="welcome-graduation" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span className="welcome-section-label">{lang === 'ar' ? 'مركز العمليات' : 'Operations Center'}</span>
                  <h2 style={{ margin: 0 }}>{lang === 'ar' ? 'اختصارات آمنة' : 'Quick Actions'}</h2>
                </div>
                <span className="welcome-trust-line" style={{ margin: 0 }}>
                  <span className="welcome-status-dot" /> {lang === 'ar' ? 'النظام يعمل' : 'System Active'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <QuickAction
                  icon={<SearchIcon />}
                  title={t('home.startScanBtn')}
                  description={lang === 'ar' ? 'حلل رابطاً أو رسالة' : 'Analyze a link or SMS'}
                  onClick={() => navigate('/scan')}
                  dir={dir}
                />
                <QuickAction
                  icon={<ClipboardIcon />}
                  title={t('dashboard.tabs.history')}
                  description={lang === 'ar' ? 'راجع نشاط حسابك' : 'Review your scan activity'}
                  onClick={() => setActive('history')}
                  dir={dir}
                />
                <QuickAction
                  icon={<UserIcon />}
                  title={t('dashboard.tabs.profile')}
                  description={lang === 'ar' ? 'حدّث بياناتك' : 'Update your info'}
                  onClick={() => setActive('profile')}
                  dir={dir}
                />
                <QuickAction
                  icon={<MailIcon />}
                  title={t('dashboard.tabs.notifications')}
                  description={lang === 'ar' ? 'إدارة التنبيهات' : 'Manage alerts'}
                  onClick={() => setActive('notifications')}
                  dir={dir}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{t('dashboard.overview.liveStream')}</span>
                    <h2 style={{ margin: 0 }}>{lang === 'ar' ? 'الإحصائيات الحية' : 'Live Metrics'}</h2>
                  </div>
                  <span className="welcome-trust-line" style={{ margin: 0 }}>
                    {realtimeStatus === 'connected' ? `● ${t('dashboard.overview.connected')}` : `○ ${t('dashboard.overview.reconnecting')}`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <LiveMetric label={lang === 'ar' ? 'آخر 24 ساعة' : 'Last 24 Hours'} value={liveStats?.last_24_hours ?? '—'} />
                  <LiveMetric label={lang === 'ar' ? 'الإجمالي' : 'Total'} value={liveStats?.total ?? '—'} />
                  <LiveMetric label={lang === 'ar' ? 'غير مقروءة' : 'Unread'} value={liveStats?.unread_notifications ?? '—'} />
                </div>
                <small style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                  {lang === 'ar' ? 'آخر تحديث: ' : 'Last update: '}{formatDate(liveStats?.generated_at, lang)}
                </small>
              </div>

              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{lang === 'ar' ? 'تدقيق موحد' : 'Unified Audit'}</span>
                    <h2>{lang === 'ar' ? 'سجل النشاطات' : 'Activity Stream'}</h2>
                  </div>
                  <button type="button" className="welcome-text-button" onClick={refreshLive}>
                    {lang === 'ar' ? 'تحديث' : 'Refresh'}
                  </button>
                </div>
                <ActivityFeed activities={activities.slice(0, 5)} lang={lang} t={t} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{lang === 'ar' ? 'آخر النشاط' : 'Latest Scans'}</span>
                    <h2>{t('home.recentTitle')}</h2>
                  </div>
                  <button type="button" className="welcome-text-button" onClick={() => setActive('history')}>
                    {t('home.viewFullHistory')}
                  </button>
                </div>
                {scans.length ? (
                  <ScanTable scans={scans.slice(0, 5)} onSelect={(scan) => navigate(`/scan-details/${encodeURIComponent(scan.id)}`)} t={t} lang={lang} />
                ) : (
                  <Empty text={lang === 'ar' ? 'لا توجد فحوصات بعد. ابدأ بفحص رابط الآن.' : 'No scans yet. Start scanning now.'} action={() => navigate('/scan')} t={t} />
                )}
              </div>

              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{lang === 'ar' ? 'الوصول' : 'Access'}</span>
                    <h2>{lang === 'ar' ? 'صلاحيات حسابك' : 'Account Role & Permissions'}</h2>
                  </div>
                  <ShieldCheckIcon size={26} color="#1E5EFF" />
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                  {permissionItems.map(([key, allowed]) => (
                    <li key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: allowed ? '#16A34A' : '#DC2626' }} />
                        {key.replaceAll('_', ' ')}
                      </span>
                      <strong style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '6px', background: allowed ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: allowed ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {allowed ? (lang === 'ar' ? 'متاح' : 'Allowed') : (lang === 'ar' ? 'غير متاح' : 'Restricted')}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {active === 'history' && (
          <div className="welcome-graduation" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="welcome-section-label">{lang === 'ar' ? 'تدقيق قابل للتتبع' : 'Trackable Audit'}</span>
                <h2 style={{ margin: 0 }}>{t('history.title')}</h2>
              </div>
              <button type="button" className="welcome-primary-button" onClick={() => navigate('/scan')}>
                {t('home.startScanBtn')}
              </button>
            </div>
            <ScanTable scans={scans} onSelect={(scan) => navigate(`/scan-details/${encodeURIComponent(scan.id)}`)} emptyText={t('history.emptyState')} t={t} lang={lang} />
          </div>
        )}

        {active === 'profile' && (
          <div className="welcome-graduation" style={{ maxWidth: '750px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="welcome-section-label">{lang === 'ar' ? 'الهوية' : 'Identity'}</span>
                <h2 style={{ margin: 0 }}>{t('dashboard.profileSection.title')}</h2>
              </div>
              <span style={{ padding: '6px 14px', background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                {lang === 'ar' ? 'البريد موثق' : 'Email Verified'}
              </span>
            </div>
            <form onSubmit={saveProfile} style={{ display: 'grid', gap: '18px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {t('dashboard.profileSection.displayName')}
                <input value={profile.display_name || ''} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} maxLength={100} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {t('dashboard.profileSection.email')}
                <input value={overview?.user?.email || user?.email || ''} disabled style={{ padding: '14px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)', opacity: 0.7 }} />
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {t('dashboard.profileSection.language')}
                <select disabled={!canChangeLanguage} value={profile.preferred_language || 'ar'} onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })} style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                {t('dashboard.profileSection.timezone')}
                <input value={profile.timezone || ''} placeholder="Asia/Baghdad" onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
              </label>
              <div style={{ marginTop: '10px' }}>
                <button type="submit" className="welcome-primary-button" disabled={saving}>
                  {saving ? t('dashboard.profileSection.savingBtn') : t('dashboard.profileSection.saveBtn')}
                </button>
              </div>
            </form>
          </div>
        )}

        {active === 'security' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            <div className="welcome-graduation" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span className="welcome-section-label">{lang === 'ar' ? 'حماية الحساب' : 'Account Defense'}</span>
                  <h2 style={{ margin: 0 }}>{t('dashboard.securitySection.title')}</h2>
                </div>
                <button type="button" className="welcome-secondary-button" onClick={() => navigate('/settings/alerts')}>
                  {lang === 'ar' ? 'إعدادات التنبيهات' : 'Alert Settings'}
                </button>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.7', marginBottom: '20px' }}>
                {t('auth.resetSubtitle')}
              </p>
              <form onSubmit={changePassword} style={{ display: 'grid', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.currentPassword')}
                  <input type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.newPassword')}
                  <input type="password" autoComplete="new-password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} minLength={12} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.confirmPassword')}
                  <input type="password" autoComplete="new-password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} minLength={12} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                </label>
                <div style={{ marginTop: '10px' }}>
                  <button type="submit" className="welcome-primary-button" disabled={saving}>
                    {saving ? t('dashboard.profileSection.savingBtn') : t('dashboard.securitySection.changePasswordBtn')}
                  </button>
                </div>
              </form>
            </div>

            <div className="welcome-graduation" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span className="welcome-section-label">{lang === 'ar' ? 'التدقيق' : 'Audit Log'}</span>
                  <h2 style={{ margin: 0 }}>{t('dashboard.securitySection.activityLog')}</h2>
                </div>
                <ClipboardIcon size={24} color="#1E5EFF" />
              </div>
              {securityActivity.length ? (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {securityActivity.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}>
                      <strong style={{ color: 'var(--color-primary)' }}>{item.action}</strong>
                      <time style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{formatDate(item.created_at, lang)}</time>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text={lang === 'ar' ? 'سيظهر نشاط الأمان هنا بعد تسجيل العمليات.' : 'Security activity will appear here once recorded.'} t={t} />
              )}
            </div>
          </div>
        )}

        {active === 'notifications' && (
          <div className="welcome-graduation" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="welcome-section-label">{t('dashboard.tabs.notifications')}</span>
                <h2 style={{ margin: 0 }}>{t('dashboard.notificationsSection.title')}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="welcome-secondary-button" onClick={() => navigate('/notifications')}>
                  {lang === 'ar' ? 'الصفحة المستقلة' : 'Full Page'}
                </button>
                <button type="button" className="welcome-secondary-button" onClick={markAllRead}>
                  {t('notificationsPage.markAllBtn')}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
              {preferences &&
                Object.entries({
                  in_app_enabled: t('dashboard.notificationsSection.pushAlerts'),
                  email_enabled: t('dashboard.notificationsSection.emailAlerts'),
                  dangerous_scan_enabled: t('dashboard.notificationsSection.securityAlerts'),
                  weekly_summary_enabled: lang === 'ar' ? 'ملخص أسبوعي' : 'Weekly Summary',
                }).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', cursor: 'pointer' }}>
                    <span>{label}</span>
                    <input type="checkbox" checked={Boolean(preferences[key])} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: '#1E5EFF', cursor: 'pointer' }} />
                  </label>
                ))}
            </div>
            <div style={{ marginBottom: '28px' }}>
              <button type="button" className="welcome-primary-button" onClick={savePreferences} disabled={saving}>
                {t('dashboard.notificationsSection.savePreferences')}
              </button>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {notifications.length ? (
                notifications.map((item) => (
                  <div key={item.id} style={{ padding: '18px', borderInlineStart: item.is_read ? '4px solid var(--color-border)' : '4px solid #1E5EFF', background: item.is_read ? 'var(--color-bg)' : 'var(--color-secondary-subtle)', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
                    <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-primary)', marginBottom: '4px' }}>{item.title}</strong>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>{item.body}</p>
                    <time style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{formatDate(item.created_at, lang)}</time>
                  </div>
                ))
              ) : (
                <Empty text={t('notificationsPage.emptyState')} t={t} />
              )}
            </div>
          </div>
        )}

        {active === 'privacy' && (
          <div className="welcome-graduation" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="welcome-section-label">{t('dashboard.privacySection.title')}</span>
                <h2 style={{ margin: 0 }}>{t('dashboard.privacySection.consentsTitle')}</h2>
              </div>
              <ShieldCheckIcon size={26} color="#1E5EFF" />
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: '1.7', marginBottom: '24px' }}>
              {lang === 'ar' ? 'يمكنك تغيير موافقاتك في أي وقت. تُستخدم بيانات الفحص لتقديم الخدمة وفق إعدادات النظام وسياسة الخصوصية.' : 'You can update your privacy consents at any time according to our policies.'}
            </p>
            <div style={{ display: 'grid', gap: '14px' }}>
              {[
                ['PRIVACY_POLICY', lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'],
                ['DATA_RETENTION', lang === 'ar' ? 'الاحتفاظ بسجل الفحوصات' : 'Scan Data Retention'],
                ['MODEL_IMPROVEMENT', lang === 'ar' ? 'المساهمة الاختيارية في تحسين النموذج' : 'Optional Model Improvement'],
              ].map(([type, label]) => {
                const current = consents.find((item) => item.consent_type === type && item.version === '1.0');
                return (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '14px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>{label}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {lang === 'ar' ? 'الإصدار 1.0 · ' : 'v1.0 · '}
                        {current?.granted ? (lang === 'ar' ? 'مفعّل' : 'Granted') : (lang === 'ar' ? 'غير مفعّل' : 'Disabled')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={current?.granted ? 'welcome-secondary-button' : 'welcome-primary-button'}
                      onClick={() => updateConsent(type, !current?.granted)}
                      style={{ borderColor: current?.granted ? '#DC2626' : undefined, color: current?.granted ? '#DC2626' : undefined }}
                    >
                      {current?.granted ? (lang === 'ar' ? 'إيقاف' : 'Disable') : (lang === 'ar' ? 'تفعيل' : 'Enable')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}

function StatCard({ icon, label, value, tone }) {
  const tones = {
    blue: { bg: 'rgba(30,94,255,0.12)', color: '#1E5EFF' },
    green: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    amber: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
    red: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div className="welcome-graduation" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '22px', margin: 0 }}>
      <div style={{ width: '50px', height: '50px', borderRadius: '14px', background: t.bg, color: t.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>{label}</span>
        <strong style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Poppins, sans-serif' }}>{value}</strong>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, description, onClick, dir }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '16px',
        background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
        border: '1px solid var(--color-border)',
        borderRadius: '14px',
        cursor: 'pointer',
        textAlign: dir === 'rtl' ? 'right' : 'left',
        width: '100%',
        fontFamily: 'inherit',
        transition: '0.2s',
      }}
    >
      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--color-secondary-subtle)', color: 'var(--color-secondary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: '14px', color: 'var(--color-primary)', display: 'block', marginBottom: '2px' }}>{title}</strong>
        <small style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{description}</small>
      </div>
      <span style={{ color: 'var(--color-secondary)', fontWeight: 700 }}>{dir === 'rtl' ? '←' : '→'}</span>
    </button>
  );
}

function LiveMetric({ label, value }) {
  return (
    <div style={{ background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
      <strong style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '4px', fontFamily: 'Poppins, sans-serif' }}>{value}</strong>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>{label}</span>
    </div>
  );
}

function ActivityFeed({ activities, lang, t }) {
  if (!activities?.length) return <Empty text={t ? t('dashboard.overview.noActivity') : 'No activity'} t={t} />;
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {activities.map((item) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '12px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.kind === 'security' ? '#DC2626' : '#1E5EFF', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</strong>
            <small style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{item.action}</small>
          </div>
          <time style={{ color: 'var(--color-text-muted)', fontSize: '10px', whiteSpace: 'nowrap' }}>{formatDate(item.created_at, lang)}</time>
        </div>
      ))}
    </div>
  );
}

function ScanTable({ scans, onSelect, emptyText, t, lang }) {
  if (!scans?.length) return <Empty text={emptyText || 'No data.'} t={t} />;
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      {scans.map((scan) => (
        <button
          type="button"
          key={scan.id}
          onClick={() => onSelect?.(scan)}
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr auto auto',
            gap: '12px',
            alignItems: 'center',
            padding: '14px 18px',
            background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
            width: '100%',
            textAlign: lang === 'ar' ? 'right' : 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span className="result-tag" style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--color-secondary-subtle)', color: 'var(--color-secondary)' }}>
            {scan.input_type === 'MESSAGE' ? (lang === 'ar' ? 'رسالة' : 'Text') : (lang === 'ar' ? 'رابط' : 'URL')}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: 600, direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scan.input_value_masked || '••••'}
          </span>
          <ClassificationBadge value={scan.classification} t={t} />
          <time style={{ color: 'var(--color-text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>{formatDate(scan.created_at, lang)}</time>
        </button>
      ))}
    </div>
  );
}

function Empty({ text, action, t }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
      <BarChartIcon size={32} style={{ marginBottom: '10px', opacity: 0.5, color: 'var(--color-secondary)' }} />
      <p style={{ fontSize: '14px', marginBottom: '16px' }}>{text}</p>
      {action && (
        <button type="button" className="welcome-primary-button" onClick={action}>
          {t ? t('home.startScanBtn') : 'Start Scan'}
        </button>
      )}
    </div>
  );
}
