import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import api from '../services/api';
import { getAccessToken } from '../services/authToken';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AlertTriangleIcon, BarChartIcon, CheckCircleIcon, ClipboardIcon, InfoIcon, LockIcon, MailIcon, SearchIcon, ShieldCheckIcon, ShieldIcon, UserIcon } from '../components/Icons';
import { UnifiedLoadingGate } from '../components/SessionCheckScreen';
import './dashboard.css';

const EMPTY_STATS = { total: 0, safe: 0, suspicious: 0, dangerous: 0, unknown: 0 };
const DASHBOARD_SECTIONS = ['overview', 'history', 'profile', 'security', 'notifications', 'privacy'];

function normalizeDashboardSection(section) {
  return DASHBOARD_SECTIONS.includes(section) ? section : 'overview';
}

function authConfig() {
  return { headers: { Authorization: `Bearer ${getAccessToken()}` } };
}

function formatDate(value, lang = 'ar') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function ClassificationBadge({ value, t, className = '' }) {
  const key = (value || 'UNKNOWN').toLowerCase();
  const label = t(`dashboard.labels.${key}`) || t('dashboard.labels.unknown');
  return <span className={`result-tag ${key} ${className}`} style={{ fontSize: '11px', padding: '4px 10px' }}>{label}</span>;
}

export default function Dashboard({ activeTab, setActiveTab, onNavigateAuth }) {
  const { dir, t, lang, canChangeLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [active, setActive] = useState(() => normalizeDashboardSection(searchParams.get('section')));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [pendingConsentTypes, setPendingConsentTypes] = useState(() => new Set());
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const bootstrapRes = await api.get('/dashboard/bootstrap', authConfig());
        const b = bootstrapRes.data?.data;
        if (b) {
          setOverview(b.overview || null);
          setScans(Array.isArray(b.scans) ? b.scans : []);
          setProfile(b.profile || {});
          setNotifications(Array.isArray(b.notifications) ? b.notifications : []);
          setPreferences(b.preferences || null);
          setConsents(Array.isArray(b.consents) ? b.consents : []);
          setSecurityActivity(Array.isArray(b.security_activity) ? b.security_activity : []);
          setLiveStats(b.live_stats || null);
          setActivities(Array.isArray(b.activities) ? b.activities : []);
          return;
        }
      } catch {
        // Fallback to individual calls if bootstrap fails
      }

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
    setActive(normalizeDashboardSection(searchParams.get('section')));
  }, [searchParams]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && realtimeStatus !== 'connected') {
        refreshLive().catch(() => undefined);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshLive, realtimeStatus]);

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
  const emailVerified = profile?.email_verified ?? overview?.user?.email_verified ?? user?.email_verified;
  const passwordMismatch = Boolean(passwordForm.confirm_password) && passwordForm.new_password !== passwordForm.confirm_password;
  const passwordSameAsCurrent = Boolean(passwordForm.current_password && passwordForm.new_password) && passwordForm.current_password === passwordForm.new_password;
  const realtimeStatusText = realtimeStatus === 'connected'
    ? t('dashboard.overview.connected')
    : realtimeStatus === 'disconnected'
      ? t('dashboard.overview.disconnected')
      : t('dashboard.overview.connecting');

  function selectSection(section) {
    if (!DASHBOARD_SECTIONS.includes(section)) return;
    setActive(section);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('section', section);
      return nextParams;
    });
  }

  async function handleRefreshLive() {
    if (refreshingLive) return;
    setRefreshingLive(true);
    try {
      await refreshLive();
      setMessage(t('dashboard.overview.refreshSuccess'));
    } catch {
      setMessage(t('dashboard.overview.refreshError'));
    } finally {
      setRefreshingLive(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const payload = { ...profile };
      if (!canChangeLanguage) delete payload.preferred_language;
      const result = await api.patch('/dashboard/profile', payload, authConfig());
      setProfile(result.data?.data || profile);
      setMessage(lang === 'ar' ? 'تم تحديث الملف الشخصي بنجاح.' : 'Profile updated successfully.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر حفظ الملف الشخصي.' : 'Failed to save profile.');
    } finally { setSaving(false); }
  }

  async function savePreferences() {
    if (!preferences) return;
    setSaving(true); setMessage('');
    try {
      const payload = {
        in_app_enabled: Boolean(preferences.in_app_enabled),
        email_enabled: Boolean(preferences.email_enabled),
        dangerous_scan_enabled: Boolean(preferences.dangerous_scan_enabled),
        weekly_summary_enabled: Boolean(preferences.weekly_summary_enabled),
      };
      const result = await api.patch('/dashboard/notification-preferences', payload, authConfig());
      setPreferences(result.data?.data || preferences);
      setMessage(lang === 'ar' ? 'تم حفظ تفضيلات الإشعارات بنجاح.' : 'Preferences saved successfully.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر حفظ تفضيلات الإشعارات.' : 'Failed to save preferences.');
    } finally { setSaving(false); }
  }

  async function markAllRead() {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    try {
      await api.post('/dashboard/notifications/read-all', {}, authConfig());
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      setMessage(t('notificationsPage.markAllSuccess'));
    } catch {
      setMessage(t('notificationsPage.markAllError'));
    } finally {
      setMarkingAllRead(false);
    }
  }

  async function updateConsent(type, granted) {
    if (pendingConsentTypes.has(type)) return;
    setPendingConsentTypes((current) => new Set(current).add(type));
    try {
      await api.post('/dashboard/privacy/consents', { consent_type: type, version: '1.0', granted }, authConfig());
      const result = await api.get('/dashboard/privacy/consents', authConfig());
      setConsents(result.data?.data || []);
      setMessage(lang === 'ar' ? 'تم تحديث إعداد الخصوصية.' : 'Privacy preference updated.');
    } catch {
      setMessage(lang === 'ar' ? 'تعذر تحديث إعداد الخصوصية.' : 'Failed to update privacy preference.');
    } finally {
      setPendingConsentTypes((current) => {
        const next = new Set(current);
        next.delete(type);
        return next;
      });
    }
  }

  async function changePassword(event) {
    event.preventDefault(); setMessage('');
    if (passwordMismatch) {
      setMessage(t('dashboard.securitySection.passwordMismatch'));
      return;
    }
    if (passwordSameAsCurrent) {
      setMessage(t('dashboard.securitySection.passwordSameAsCurrent'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/dashboard/security/change-password', passwordForm, authConfig());
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage(t('dashboard.changePasswordSuccess'));
    } catch (error) {
      const status = error?.response?.status;
      if (status === 400) setMessage(t('dashboard.securitySection.currentPasswordIncorrect'));
      else if (status === 401 || status === 409) setMessage(t('dashboard.securitySection.sessionExpired'));
      else setMessage(t('dashboard.changePasswordError'));
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <UnifiedLoadingGate
        badgeText={lang === 'ar' ? 'تجهيز مساحة العمل' : 'Workspace Initialization'}
        title={lang === 'ar' ? 'جارِ تحميل لوحة التحكم' : 'Loading Workspace Dashboard'}
        subtitle={lang === 'ar' ? 'مزامنة السجلات والإحصائيات وتأمين الاتصال' : 'Synchronizing audit logs, metrics & security'}
        statusText={lang === 'ar' ? 'تجميع بيانات الحساب والفحوصات...' : 'Aggregating account data & scans...'}
        progress={65}
      />
    );
  }

  const navItems = [
    ['overview', t('dashboard.tabs.overview'), <BarChartIcon size={18} />],
    ['history', t('dashboard.tabs.history'), <ClipboardIcon size={18} />],
    ['profile', t('dashboard.tabs.profile'), <UserIcon size={18} />],
    ['security', t('dashboard.tabs.security'), <LockIcon size={18} />],
    [
      'notifications',
      t('dashboard.tabs.notifications'),
      <MailIcon size={18} />,
      notifications.some((n) => !n.is_read) ? (lang === 'ar' ? 'جديد' : 'New') : null,
    ],
    ['privacy', t('dashboard.tabs.privacy'), <ShieldIcon size={18} />],
  ];

  return (
    <main className="welcome-page dashboard-page" dir={dir}>
      <div className="welcome-glow welcome-glow-one" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-two" aria-hidden="true" />

      <Header activeTab={activeTab} setActiveTab={setActiveTab} onNavigateAuth={onNavigateAuth} />

      <div className="dashboard-layout-wrapper">
        {/* Mobile Navbar Bar */}
        <div className="dashboard-mobile-bar">
          <button
            type="button"
            className="dashboard-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={lang === 'ar' ? 'القائمة الجانبية' : 'Toggle navigation menu'}
          >
            <span style={{ fontSize: '18px' }}>☰</span>
            <span>{navItems.find(([k]) => k === active)?.[1] || (lang === 'ar' ? 'القائمة' : 'Menu')}</span>
          </button>
          <span className={`dashboard-realtime-status status-${realtimeStatus}`}>
            <span className="welcome-status-dot" aria-hidden="true" /> {realtimeStatusText}
          </span>
        </div>

        {/* Sidebar Navigation */}
        <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-user">
              <div className="dashboard-user-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="dashboard-user-info">
                <strong>{displayName}</strong>
                <span className="dashboard-user-role">
                  {overview?.user?.role === 'USER' ? (lang === 'ar' ? 'مستخدم مسجل' : 'Registered User') : overview?.user?.role || (lang === 'ar' ? 'مستخدم' : 'User')}
                </span>
              </div>
            </div>

            <div className="dashboard-sidebar-connection">
              <span className={`welcome-status-dot status-${realtimeStatus}`} aria-hidden="true" />
              <span>{realtimeStatusText}</span>
            </div>
          </div>

          <nav className="dashboard-sidebar-nav" aria-label={lang === 'ar' ? 'أقسام لوحة التحكم' : 'Dashboard sections'}>
            <div className="dashboard-nav-group-label">
              {lang === 'ar' ? 'أقسام اللوحة' : 'DASHBOARD SECTIONS'}
            </div>
            {navItems.map(([key, label, icon, badge]) => (
              <button
                key={key}
                type="button"
                onClick={() => { selectSection(key); setMobileMenuOpen(false); }}
                className={`dashboard-sidebar-item ${active === key ? 'is-active' : ''}`}
              >
                <span className="sidebar-item-icon">{icon}</span>
                <span className="sidebar-item-label">{label}</span>
                {badge && <span className="sidebar-item-badge">{badge}</span>}
              </button>
            ))}
          </nav>

          <div className="dashboard-sidebar-footer">
            <button
              type="button"
              className="dashboard-sidebar-action-btn welcome-primary-button"
              onClick={() => { navigate('/scan'); setMobileMenuOpen(false); }}
            >
              <SearchIcon size={16} />
              <span>{t('home.startScanBtn')}</span>
            </button>
            <button
              type="button"
              className="dashboard-sidebar-logout-btn welcome-secondary-button"
              onClick={logout}
            >
              {t('auth.logout')}
            </button>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="dashboard-mobile-overlay"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content Area */}
        <div className="dashboard-main-area">
          <div className="welcome-graduation" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span className="welcome-eyebrow"><span className="welcome-eyebrow-dot" />Nabeh SafeLink</span>
                <h1 style={{ fontFamily: 'Poppins, Cairo, sans-serif', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: 'var(--color-primary)', margin: '6px 0 4px' }}>
                  {lang === 'ar' ? `مرحباً، ${displayName}` : `Welcome, ${displayName}`}
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
                  {lang === 'ar' ? 'كل ما تحتاجه لمراقبة أمان روابطك وحسابك في مكان واحد.' : 'Everything you need to monitor link & account security in one workspace.'}
                </p>
              </div>
            </div>
          </div>

          {message && (
            <div className="dashboard-feedback" role="status" aria-live="polite" aria-atomic="true">
              <span className="dashboard-feedback-mark" aria-hidden="true" />
              <p>{message}</p>
            </div>
          )}

        {active === 'overview' && (
          <>
            <div className="dashboard-grid stats-grid dashboard-overview-stats" style={{ marginBottom: '32px' }}>
              <StatCard icon={<ClipboardIcon />} label={t('dashboard.overview.totalScans')} value={stats.total} tone="blue" />
              <StatCard icon={<CheckCircleIcon />} label={t('dashboard.overview.safeScans')} value={stats.safe} tone="green" />
              <StatCard icon={<InfoIcon />} label={t('dashboard.overview.suspiciousScans')} value={stats.suspicious} tone="amber" />
              <StatCard icon={<AlertTriangleIcon />} label={t('dashboard.overview.dangerousScans')} value={stats.dangerous} tone="red" />
            </div>

            <ScanDistributionChart stats={stats} lang={lang} t={t} />

            <div className="welcome-graduation" style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <span className="welcome-section-label">{lang === 'ar' ? 'مركز العمليات' : 'Operations Center'}</span>
                  <h2 style={{ margin: 0 }}>{lang === 'ar' ? 'اختصارات آمنة' : 'Quick Actions'}</h2>
                </div>
                <span className={`welcome-trust-line dashboard-realtime-status status-${realtimeStatus}`} data-status={realtimeStatus} role="status" aria-live="polite" style={{ margin: 0 }}>
                  <span className="welcome-status-dot" aria-hidden="true" /> {realtimeStatusText}
                </span>
              </div>
              <div className="quick-actions-grid">
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
                  onClick={() => selectSection('history')}
                  dir={dir}
                />
                <QuickAction
                  icon={<UserIcon />}
                  title={t('dashboard.tabs.profile')}
                  description={lang === 'ar' ? 'حدّث بياناتك' : 'Update your info'}
                  onClick={() => selectSection('profile')}
                  dir={dir}
                />
                <QuickAction
                  icon={<MailIcon />}
                  title={t('dashboard.tabs.notifications')}
                  description={lang === 'ar' ? 'إدارة التنبيهات' : 'Manage alerts'}
                  onClick={() => selectSection('notifications')}
                  dir={dir}
                />
              </div>
            </div>

            <div className="dashboard-grid live-grid dashboard-overview-columns" style={{ marginBottom: '32px' }}>
              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{t('dashboard.overview.liveStream')}</span>
                    <h2 style={{ margin: 0 }}>{lang === 'ar' ? 'الإحصائيات الحية' : 'Live Metrics'}</h2>
                  </div>
                  <span className={`welcome-trust-line dashboard-realtime-status status-${realtimeStatus}`} data-status={realtimeStatus} aria-hidden="true" style={{ margin: 0 }}>
                    <span className="welcome-status-dot" aria-hidden="true" /> {realtimeStatusText}
                  </span>
                </div>
                <div className="live-metrics">
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
                  <button type="button" className="welcome-text-button" onClick={handleRefreshLive} disabled={refreshingLive} aria-busy={refreshingLive}>
                    {refreshingLive ? t('dashboard.overview.refreshing') : t('dashboard.overview.refreshBtn')}
                  </button>
                </div>
                <ActivityFeed activities={activities.slice(0, 5)} lang={lang} t={t} />
              </div>
            </div>

            <div className="dashboard-grid two-columns dashboard-history-grid">
              <div className="welcome-graduation" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <span className="welcome-section-label">{lang === 'ar' ? 'آخر النشاط' : 'Latest Scans'}</span>
                    <h2>{t('home.recentTitle')}</h2>
                  </div>
                  <button type="button" className="welcome-text-button" onClick={() => selectSection('history')}>
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
            <ScanTable scans={scans} onSelect={(scan) => navigate(`/scan-details/${encodeURIComponent(scan.id)}`)} emptyText={t('history.emptyState')} t={t} lang={lang} showFilters={true} />
          </div>
        )}

        {active === 'profile' && (
          <div className="welcome-graduation" style={{ maxWidth: '750px', margin: '0 auto' }}>
            <div className="dashboard-profile-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <span className="welcome-section-label">{lang === 'ar' ? 'الهوية' : 'Identity'}</span>
                <h2 style={{ margin: 0 }}>{t('dashboard.profileSection.title')}</h2>
              </div>
              {typeof emailVerified === 'boolean' && (
                <span className={`dashboard-email-status ${emailVerified ? 'is-verified' : 'is-unverified'}`} role="status">
                  {emailVerified ? t('dashboard.profileSection.emailVerified') : t('dashboard.profileSection.emailNotVerified')}
                </span>
              )}
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
          <div className="dashboard-grid two-columns dashboard-security-grid">
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
              <form onSubmit={changePassword} aria-busy={saving} style={{ display: 'grid', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.currentPassword')}
                  <input id="dashboard-current-password" type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={(e) => { setPasswordForm({ ...passwordForm, current_password: e.target.value }); setMessage(''); }} maxLength={128} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.newPassword')}
                  <input id="dashboard-new-password" type="password" autoComplete="new-password" value={passwordForm.new_password} onChange={(e) => { setPasswordForm({ ...passwordForm, new_password: e.target.value }); setMessage(''); }} minLength={12} maxLength={128} aria-invalid={passwordSameAsCurrent} aria-describedby={passwordSameAsCurrent ? 'dashboard-password-same' : 'dashboard-password-hint'} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                  <small id="dashboard-password-hint" className="dashboard-field-hint">{t('auth.passwordLength')}</small>
                  {passwordSameAsCurrent && <small id="dashboard-password-same" className="dashboard-field-error" role="status">{t('dashboard.securitySection.passwordSameAsCurrent')}</small>}
                </label>
                <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  {t('dashboard.securitySection.confirmPassword')}
                  <input id="dashboard-confirm-password" type="password" autoComplete="new-password" value={passwordForm.confirm_password} onChange={(e) => { setPasswordForm({ ...passwordForm, confirm_password: e.target.value }); setMessage(''); }} minLength={12} maxLength={128} aria-invalid={passwordMismatch} aria-describedby={passwordMismatch ? 'dashboard-password-mismatch' : undefined} required style={{ padding: '14px', background: 'var(--color-bg)', border: '1px solid var(--color-border-strong)', borderRadius: '12px', font: 'inherit', color: 'var(--color-text)' }} />
                  {passwordMismatch && <small id="dashboard-password-mismatch" className="dashboard-field-error" role="status">{t('dashboard.securitySection.passwordMismatch')}</small>}
                </label>
                <div style={{ marginTop: '10px' }}>
                  <button type="submit" className="welcome-primary-button" disabled={saving || passwordMismatch || passwordSameAsCurrent}>
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
                <button type="button" className="welcome-secondary-button" onClick={markAllRead} disabled={markingAllRead} aria-busy={markingAllRead}>
                  {markingAllRead ? t('notificationsPage.markAllLoading') : t('notificationsPage.markAllBtn')}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '24px' }}>
              {preferences &&
                Object.entries({
                  in_app_enabled: t('dashboard.notificationsSection.inAppAlerts'),
                  email_enabled: t('dashboard.notificationsSection.emailAlerts'),
                  dangerous_scan_enabled: t('dashboard.notificationsSection.securityAlerts'),
                  weekly_summary_enabled: t('dashboard.notificationsSection.weeklySummary'),
                }).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', cursor: 'pointer' }}>
                    <span>{label}</span>
                    <input type="checkbox" checked={Boolean(preferences[key])} disabled={saving} onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })} style={{ width: '20px', height: '20px', accentColor: '#1E5EFF', cursor: saving ? 'not-allowed' : 'pointer' }} />
                  </label>
                ))}
            </div>
            <div style={{ marginBottom: '28px' }}>
              <button type="button" className="welcome-primary-button" onClick={savePreferences} disabled={saving} aria-busy={saving}>
                {saving ? t('alertSettingsPage.savingBtn') : t('dashboard.notificationsSection.savePreferences')}
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
                  <div key={type} className="dashboard-consent-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)', border: '1px solid var(--color-border)', borderRadius: '14px' }}>
                    <div className="dashboard-consent-copy">
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
                      disabled={pendingConsentTypes.has(type)}
                      aria-busy={pendingConsentTypes.has(type)}
                      aria-pressed={Boolean(current?.granted)}
                      style={{ borderColor: current?.granted ? '#DC2626' : undefined, color: current?.granted ? '#DC2626' : undefined }}
                    >
                      {pendingConsentTypes.has(type)
                        ? t('dashboard.privacySection.updatingConsent')
                        : current?.granted
                          ? (lang === 'ar' ? 'إيقاف' : 'Disable')
                          : (lang === 'ar' ? 'تفعيل' : 'Enable')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
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
    <div className="welcome-graduation dashboard-stat-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: 0 }}>
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
      className="quick-action"
      style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
    >
      <div className="quick-action-icon">
        {icon}
      </div>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <span className="quick-action-arrow">{dir === 'rtl' ? '←' : '→'}</span>
    </button>
  );
}

function LiveMetric({ label, value }) {
  return (
    <div className="live-metric">
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
        <div key={item.id} className="activity-item">
          <span className={`activity-dot ${item.kind === 'security' ? 'security' : 'scan'}`} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong className="dashboard-activity-title">{item.title}</strong>
            <small style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{item.action}</small>
          </div>
          <time style={{ color: 'var(--color-text-muted)', fontSize: '10px', whiteSpace: 'nowrap' }}>{formatDate(item.created_at, lang)}</time>
        </div>
      ))}
    </div>
  );
}

function ScanDistributionChart({ stats, lang }) {
  const total = stats.total || 0;
  const safe = stats.safe || 0;
  const suspicious = stats.suspicious || 0;
  const dangerous = stats.dangerous || 0;
  const unknown = stats.unknown || 0;

  const safePct = total ? Math.round((safe / total) * 100) : 0;
  const suspiciousPct = total ? Math.round((suspicious / total) * 100) : 0;
  const dangerousPct = total ? Math.round((dangerous / total) * 100) : 0;
  const unknownPct = total ? Math.round((unknown / total) * 100) : 0;

  const items = [
    { label: lang === 'ar' ? 'آمن' : 'Safe', count: safe, pct: safePct, color: '#16A34A', bg: 'var(--color-success-bg)' },
    { label: lang === 'ar' ? 'مشبوه' : 'Suspicious', count: suspicious, pct: suspiciousPct, color: '#D97706', bg: 'var(--color-warning-bg)' },
    { label: lang === 'ar' ? 'خطر' : 'Dangerous', count: dangerous, pct: dangerousPct, color: '#DC2626', bg: 'var(--color-danger-bg)' },
    { label: lang === 'ar' ? 'غير محسوم' : 'Unknown', count: unknown, pct: unknownPct, color: '#6B7280', bg: 'var(--color-bg-subtle)' },
  ];

  return (
    <div className="welcome-graduation" style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span className="welcome-section-label">{lang === 'ar' ? 'تمثيل بصري تفاعلي' : 'Visual Analytics'}</span>
          <h2 style={{ margin: 0 }}>{lang === 'ar' ? 'توزيع نتائج الفحوصات' : 'Scan Risk Breakdown'}</h2>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {lang === 'ar' ? `الإجمالي: ${total} فحص` : `Total: ${total} scans`}
        </span>
      </div>

      {total > 0 ? (
        <>
          <div style={{ display: 'flex', height: '14px', borderRadius: '10px', overflow: 'hidden', background: 'var(--color-bg-subtle)', marginBottom: '20px', gap: '2px' }}>
            {safePct > 0 && <div style={{ width: `${safePct}%`, background: '#16A34A', transition: 'width 0.4s ease' }} title={`Safe: ${safe} (${safePct}%)`} />}
            {suspiciousPct > 0 && <div style={{ width: `${suspiciousPct}%`, background: '#D97706', transition: 'width 0.4s ease' }} title={`Suspicious: ${suspicious} (${suspiciousPct}%)`} />}
            {dangerousPct > 0 && <div style={{ width: `${dangerousPct}%`, background: '#DC2626', transition: 'width 0.4s ease' }} title={`Dangerous: ${dangerous} (${dangerousPct}%)`} />}
            {unknownPct > 0 && <div style={{ width: `${unknownPct}%`, background: '#6B7280', transition: 'width 0.4s ease' }} title={`Unknown: ${unknown} (${unknownPct}%)`} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {items.map((item) => (
              <div key={item.label} style={{ padding: '14px 16px', background: item.bg, borderRadius: '12px', border: `1px solid ${item.color}33`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.label}</span>
                </div>
                <strong style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'Poppins, sans-serif' }}>{item.count}</strong>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{item.pct}% {lang === 'ar' ? 'من الإجمالي' : 'of total'}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          {lang === 'ar' ? 'لا توجد بيانات فحوصات لعرض المخطط البياني حالياً.' : 'No scan data available for visualization yet.'}
        </div>
      )}
    </div>
  );
}

function ScanTable({ scans, onSelect, emptyText, t, lang, showFilters = false }) {
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [search, setSearch] = useState('');

  if (!scans?.length) return <Empty text={emptyText || (lang === 'ar' ? 'لا توجد بيانات فحوصات' : 'No scan data.')} t={t} />;

  const filtered = scans.filter((scan) => {
    if (filterClass !== 'ALL' && (scan.classification || 'UNKNOWN').toUpperCase() !== filterClass) return false;
    if (filterType !== 'ALL' && (scan.input_type || 'URL').toUpperCase() !== filterType) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const val = (scan.input_value_masked || '').toLowerCase();
      if (!val.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {showFilters && (
        <div style={{ marginBottom: '20px', display: 'grid', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'ar' ? 'ابحث عن رابط أو نص مفحوص...' : 'Search by URL or text...'}
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingInlineStart: '40px',
                borderRadius: '12px',
                border: '1px solid var(--color-border-strong)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                font: 'inherit',
                fontSize: '13px',
              }}
            />
            <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [lang === 'ar' ? 'right' : 'left']: '14px', color: 'var(--color-text-muted)', display: 'grid', placeItems: 'center' }}>
              <SearchIcon size={18} />
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginInlineEnd: '4px' }}>
              {lang === 'ar' ? 'التصنيف:' : 'Category:'}
            </span>
            {[
              ['ALL', lang === 'ar' ? 'الكل' : 'All'],
              ['DANGEROUS', lang === 'ar' ? 'خطر' : 'Dangerous'],
              ['SUSPICIOUS', lang === 'ar' ? 'مشبوه' : 'Suspicious'],
              ['SAFE', lang === 'ar' ? 'آمن' : 'Safe'],
              ['UNKNOWN', lang === 'ar' ? 'غير محسوم' : 'Unknown'],
            ].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setFilterClass(code)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: filterClass === code ? 'var(--color-primary)' : 'var(--color-border)',
                  background: filterClass === code ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: filterClass === code ? '#FFFFFF' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            ))}

            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', marginInlineStart: '12px', marginInlineEnd: '4px' }}>
              {lang === 'ar' ? 'النوع:' : 'Type:'}
            </span>
            {[
              ['ALL', lang === 'ar' ? 'الكل' : 'All'],
              ['URL', lang === 'ar' ? 'روابط' : 'URLs'],
              ['MESSAGE', lang === 'ar' ? 'رسائل' : 'SMS'],
            ].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => setFilterType(code)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: filterType === code ? 'var(--color-secondary)' : 'var(--color-border)',
                  background: filterType === code ? 'var(--color-secondary-subtle)' : 'var(--color-bg)',
                  color: filterType === code ? 'var(--color-secondary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length ? (
        <div className="scan-table">
          {filtered.map((scan) => (
            <button
              type="button"
              key={scan.id}
              onClick={() => onSelect?.(scan)}
              className="scan-row"
              style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}
            >
              <span className="result-tag scan-kind" style={{ fontSize: '10px', padding: '4px 10px', background: 'var(--color-secondary-subtle)', color: 'var(--color-secondary)' }}>
                {scan.input_type === 'MESSAGE' ? (lang === 'ar' ? 'رسالة' : 'Text') : (lang === 'ar' ? 'رابط' : 'URL')}
              </span>
              <span className="scan-value">
                {scan.input_value_masked || '••••'}
              </span>
              <ClassificationBadge value={scan.classification} t={t} className="scan-classification" />
              <time>{formatDate(scan.created_at, lang)}</time>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--color-bg-subtle)', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
            {lang === 'ar' ? 'لا توجد نتائج تطابق خيارات الفلترة أو البحث الحالية.' : 'No scans match the selected filter or search options.'}
          </p>
          <button
            type="button"
            className="welcome-secondary-button"
            onClick={() => { setFilterClass('ALL'); setFilterType('ALL'); setSearch(''); }}
          >
            {lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
          </button>
        </div>
      )}
    </div>
  );
}
function Empty({ text, action, t }) {
  return (
    <div className="dashboard-empty" aria-live="polite" aria-atomic="true">
      <span className="dashboard-empty-icon" aria-hidden="true">
        <BarChartIcon size={32} />
      </span>
      <p>{text}</p>
      {action && (
        <button type="button" className="welcome-primary-button" onClick={action}>
          {t ? t('home.startScanBtn') : 'Start Scan'}
        </button>
      )}
    </div>
  );
}