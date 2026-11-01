import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRuntimeConfig } from '../context/RuntimeConfigContext';
import Header from '../components/Header';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CpuIcon,
  LinkIcon,
  SearchIcon,
  ShieldCheckIcon,
} from '../components/Icons';
import './welcome-page.css';
import api from '../services/api';

const team = [
  ['Aryam Odeh Al-Huwaiti', '451004106'],
  ['Nouf Odeh Al-Huwaiti', '451006979'],
  ['Jawharah Odeh Al-Huwaiti', '451000039'],
  ['Wasaif Mahmoud Al-Balawi', '451003974'],
];

const content = {
  ar: {
    eyebrow: 'مشروع تخرج • أمن سيبراني ذكي',
    heroTitle: 'احمِ عالمك الرقمي بذكاء',
    heroCopy: 'Nabeh SafeLink منصة ويب ذكية تساعدك على تحليل الروابط والرسائل واكتشاف مؤشرات التصيد والتهديدات الإلكترونية قبل التفاعل معها.',
    scan: 'ابدأ الفحص الآن',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    openHome: 'فتح لوحة التحكم',
    welcome: 'مرحبًا بك مجددًا في Nabeh SafeLink',
    newScan: 'بدء فحص جديد',
    theme: 'تبديل الثيم',
    language: 'English',
    features: [
      ['فحص ذكي', 'تحليل الروابط والرسائل للكشف عن مؤشرات التصيد والاحتيال.', SearchIcon],
      ['حماية استباقية', 'اكتشاف التهديد قبل فتح الرابط أو مشاركة بياناتك.', ShieldCheckIcon],
      ['خصوصية موثوقة', 'فحص الضيف يعرض النتيجة الحالية دون حفظها في سجل المستخدم.', ShieldCheckIcon],
    ],
    missionLabel: 'فكرة المشروع',
    missionTitle: 'Scan • Detect • Stay Safe',
    missionCopy: 'نحو تجربة رقمية أكثر وعيًا وأمانًا، بقرارات واضحة قبل الضغط على أي رابط.',
    graduation: 'مشروع تخرج',
    teamTitle: 'فريق Nabeh SafeLink',
    idLabel: 'الرقم الجامعي',
    supervisor: 'المشرفة الأكاديمية',
    year: '1448 هـ – 2026 م',
    priority: '“Your online safety” is our priority',
    footer: 'منصة ويب ذكية للكشف والوقاية من التهديدات الإلكترونية',
    platformStats: 'إحصائيات المنصة الحية', visitors: 'زوار فريدون', users: 'مستخدمون مسجلون', scans: 'إجمالي الفحوصات', safeScans: 'فحوصات آمنة', suspiciousScans: 'فحوصات مشبوهة', dangerousScans: 'فحوصات خطرة', unknownScans: 'فحوصات غير محسومة', statsError: 'الإحصائيات غير متاحة مؤقتًا', statsLoading: 'جارٍ تحميل الإحصائيات…', statsRateLimited: 'الطلبات كثيرة حاليًا. سنعيد المحاولة بعد {seconds} ثانية؛ إذا استمرت المشكلة، حدّث الصفحة لاحقًا.', statsRateLimitedFinal: 'ما زال حدّ الطلبات يمنع تحميل الإحصائيات. حاول تحديث الصفحة بعد قليل.',
  },
  en: {
    eyebrow: 'Graduation Project • Intelligent Cybersecurity',
    heroTitle: 'Protect Your Digital World with Intelligence',
    heroCopy: 'Nabeh SafeLink is an intelligent web platform that analyzes URLs and messages to detect phishing indicators and online threats before you interact with them.',
    scan: 'Start a Safe Scan',
    login: 'Sign in',
    register: 'Create account',
    openHome: 'Open dashboard',
    welcome: 'Welcome back to Nabeh SafeLink',
    newScan: 'Start a new scan',
    theme: 'Toggle theme',
    language: 'العربية',
    features: [
      ['Smart scanning', 'Analyze links and messages for phishing and fraud indicators.', SearchIcon],
      ['Proactive protection', 'Identify threats before opening a link or sharing your data.', ShieldCheckIcon],
      ['Trusted privacy', 'Guest scans show the current result without saving it to your history.', ShieldCheckIcon],
    ],
    missionLabel: 'Project vision',
    missionTitle: 'Scan • Detect • Stay Safe',
    missionCopy: 'Building a more aware and secure digital experience, one decision before every click.',
    graduation: 'Graduation Project',
    teamTitle: 'The Nabeh SafeLink Team',
    idLabel: 'Academic ID',
    supervisor: 'Academic supervisor',
    year: '1448 H – 2026 G',
    priority: '“Your online safety” is our priority',
    footer: 'An intelligent web platform for cyber threat detection and prevention',
    platformStats: 'Live platform statistics', visitors: 'Unique visitors', users: 'Registered users', scans: 'Total scans', safeScans: 'Safe scans', suspiciousScans: 'Suspicious scans', dangerousScans: 'Dangerous scans', unknownScans: 'Unresolved scans', statsError: 'Statistics are temporarily unavailable', statsLoading: 'Loading statistics…', statsRateLimited: 'There are too many requests right now. We will retry in {seconds} seconds; if this continues, refresh the page later.', statsRateLimitedFinal: 'The request limit is still preventing statistics from loading. Please refresh the page later.',
  },
};

export default function WelcomePage() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { lang, dir } = useLanguage();
  const { config } = useRuntimeConfig();
  const text = content[lang] || content.ar;
  const [platformStats, setPlatformStats] = useState(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsRateLimited, setStatsRateLimited] = useState(false);
  const [statsRetrySeconds, setStatsRetrySeconds] = useState(0);
  useEffect(() => {
    if (!config.public_metrics_enabled) { setStatsLoading(false); return undefined; }
    let cancelled = false;
    let retryTimer;
    const recordVisit = async () => {
      try {
        let visitorId = localStorage.getItem('nabeh_visitor_id');
        if (!visitorId) {
          visitorId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
          localStorage.setItem('nabeh_visitor_id', visitorId);
        }
        await api.post('/public/visit', { visitor_id: visitorId, page: 'welcome' });
      } catch {
        // Visit tracking is best-effort; it must never block the independent stats request.
      }
    };
    const loadStats = async (allowRateLimitRetry = true) => {
      if (!cancelled) setStatsLoading(true);
      try {
        const overview = await api.get('/public/overview');
        if (cancelled) return;
        if (!overview.data?.success || !overview.data?.data) throw new Error('Invalid public stats response');
        if (overview.data?.data?.enabled === false) {
          setStatsFailed(true);
          return;
        }
        setPlatformStats(overview.data?.data || null);
        setStatsFailed(false);
        setStatsRateLimited(false);
      } catch (error) {
        if (cancelled) return;
        if (error?.response?.status === 429) {
          const retryAfterHeader = error.response.headers?.['retry-after'] ?? error.response.headers?.get?.('retry-after');
          const retrySeconds = Math.min(300, Math.max(1, Number.parseInt(retryAfterHeader, 10) || 60));
          setStatsRateLimited(true);
          setStatsRetrySeconds(allowRateLimitRetry ? retrySeconds : 0);
          if (allowRateLimitRetry) {
            retryTimer = window.setTimeout(() => {
              if (cancelled) return;
              setStatsRateLimited(false);
              setStatsRetrySeconds(0);
              loadStats(false);
            }, retrySeconds * 1000);
            return;
          }
        } else {
          setStatsRateLimited(false);
          setStatsRetrySeconds(0);
        }
        setStatsFailed(true);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    void recordVisit();
    void loadStats();
    return () => { cancelled = true; window.clearTimeout(retryTimer); };
  }, [config.public_metrics_enabled]);
  const ForwardIcon = dir === 'rtl' ? ArrowLeftIcon : ArrowRightIcon;
  const setActiveTab = (tab) => {
    const paths = {
      scan: '/scan',
      about: '/about',
      guide: '/guide',
      faq: '/faq',
      home: '/home',
      history: '/history',
      stats: '/stats',
    };
    navigate(paths[tab] || '/welcome');
  };

  return (
    <main className="welcome-page" dir={dir}>
      <div className="welcome-glow welcome-glow-one" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-two" aria-hidden="true" />

      <Header activeTab="scan" setActiveTab={setActiveTab} onNavigateAuth={(page) => navigate(`/${page}`)} />

      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <span className="welcome-eyebrow"><span className="welcome-eyebrow-dot" />{text.eyebrow}</span>
          <h1>{text.heroTitle}</h1>
          <p className="welcome-hero-description">{text.heroCopy}</p>
          <div className="welcome-actions">
            <button type="button" className="welcome-primary-button" onClick={() => navigate('/scan')}>
              <SearchIcon size={19} color="#FFFFFF" /><span>{isGuest ? text.scan : text.newScan}</span><ForwardIcon size={17} color="#FFFFFF" />
            </button>
            {isGuest ? (
              <>
                <button type="button" className="welcome-secondary-button" onClick={() => navigate('/register')}>{text.register}</button>
                <button type="button" className="welcome-text-button" onClick={() => navigate('/login')}>{text.login}</button>
              </>
            ) : (
              <button type="button" className="welcome-secondary-button" onClick={() => navigate('/home')}>{text.openHome}</button>
            )}
          </div>
          <div className="welcome-trust-line"><CheckCircleIcon size={16} color="#16A34A" /> {text.missionCopy}</div>
        </div>

        <div className="welcome-visual" aria-label="Nabeh SafeLink security illustration">
          <div className="welcome-visual-orbit welcome-orbit-one" />
          <div className="welcome-visual-orbit welcome-orbit-two" />
          <div className="welcome-visual-card welcome-card-top"><CpuIcon size={17} color="#1E5EFF" /><span>AI threat analysis</span></div>
          <div className="welcome-shield-wrap">
            <div className="welcome-shield-halo" />
            <div className="welcome-shield"><ShieldCheckIcon size={92} color="#FFFFFF" /><span className="welcome-shield-link"><LinkIcon size={38} color="#FFFFFF" /></span></div>
          </div>
          <div className="welcome-visual-card welcome-card-bottom"><span className="welcome-status-dot" /> <span>Protection active</span></div>
        </div>
      </section>

      <section className="welcome-mission">
        <div><span className="welcome-section-label">{text.missionLabel}</span><h2>{text.missionTitle}</h2></div>
        <p>{text.missionCopy}</p>
      </section>

      {config.public_metrics_enabled && <section className="welcome-platform-stats" aria-label={text.platformStats}>
        <div className="welcome-platform-stats-heading"><span className="welcome-section-label">{text.platformStats}</span><small>{platformStats?.generated_at ? new Date(platformStats.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA') : '—'}</small></div>
        {statsRateLimited ? <p className="welcome-stats-error" role="status">{statsRetrySeconds ? text.statsRateLimited.replace('{seconds}', String(statsRetrySeconds)) : text.statsRateLimitedFinal}</p> : statsFailed ? <p className="welcome-stats-error" role="status">{text.statsError}</p> : statsLoading ? <p className="welcome-stats-loading" role="status">{text.statsLoading}</p> : <div className="welcome-stats-grid">{[[text.visitors, platformStats?.visitors], [text.users, platformStats?.registered_users], [text.scans, platformStats?.scans], [text.safeScans, platformStats?.safe_scans], [text.suspiciousScans, platformStats?.suspicious_scans], [text.dangerousScans, platformStats?.dangerous_scans], [text.unknownScans, platformStats?.unknown_scans]].map(([label, value]) => <article className="welcome-stat-card" key={label}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}</div>}
      </section>}

      <section className="welcome-features" aria-label={text.missionLabel}>
        {text.features.map(([title, description, Icon]) => (
          <article className="welcome-feature-card" key={title}><span className="welcome-feature-icon"><Icon size={21} color="#1E5EFF" /></span><div><h3>{title}</h3><p>{description}</p></div></article>
        ))}
      </section>

      <section className="welcome-graduation" aria-label={text.graduation}>
        <div className="welcome-graduation-heading"><span className="welcome-section-label">{text.graduation}</span><h2>{text.teamTitle}</h2><p>{text.footer}</p></div>
        <div className="welcome-team-grid">
          {team.map(([name, id], index) => <article className="welcome-member" key={id}><span className="welcome-member-number">0{index + 1}</span><div><strong>{name}</strong><small>{text.idLabel}: <bdi>{id}</bdi></small></div></article>)}
        </div>
        <div className="welcome-supervisor"><div><span>{text.supervisor}</span><strong>Dr. Arij Al-Faidi</strong></div><b>{text.year}</b></div>
      </section>

      <footer className="welcome-footer"><span>{text.priority}</span><span>Nabeh SafeLink • {text.graduation} • 2026</span></footer>
    </main>
  );
}
