import { useState, lazy, Suspense, Component } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { RuntimeConfigProvider, useRuntimeConfig } from './context/RuntimeConfigContext';
import { useLanguage } from './context/LanguageContext';
import TermsConsentGate from './components/TermsConsentGate';
import MaintenancePage from './components/MaintenancePage';
import ServiceUnavailablePage from './components/ServiceUnavailablePage';
import { frontendLog } from './services/observability';

import Splash from './pages/auth/Splash';
import Onboarding from './pages/auth/Onboarding';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyOtp from './pages/auth/VerifyOtp';
import WelcomePage from './pages/WelcomePage';
import SessionCheckScreen from './components/SessionCheckScreen';

function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageAlreadyRefreshed = sessionStorage.getItem('nabeh_chunk_retry') === 'true';
    try {
      const component = await componentImport();
      sessionStorage.setItem('nabeh_chunk_retry', 'false');
      return component;
    } catch (error) {
      if (!pageAlreadyRefreshed) {
        sessionStorage.setItem('nabeh_chunk_retry', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.setItem('nabeh_chunk_retry', 'false');
      throw error;
    }
  });
}

class AppErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { frontendLog('frontend_unhandled_error', { error_type: error?.name || 'Error' }); }
  reset = () => { sessionStorage.removeItem('nabeh_chunk_retry'); window.location.reload(); };
  render() {
    if (!this.state.hasError) return this.props.children;
    const isArabic = document.documentElement.lang !== 'en';
    return <main className="app-fatal-error" dir={isArabic ? 'rtl' : 'ltr'}>
      <section className="app-fatal-card" role="alert">
        <div className="app-fatal-icon">!</div>
        <h1>{isArabic ? 'تعذر تحميل الصفحة' : 'The page could not be loaded'}</h1>
        <p>{isArabic ? 'حدث خطأ مؤقت في الواجهة. أعد المحاولة دون فقدان مسارك الحالي.' : 'A temporary interface error occurred. Retry without losing your current route.'}</p>
        <button type="button" className="btn btn-primary" onClick={this.reset}>{isArabic ? 'إعادة المحاولة' : 'Try again'}</button>
      </section>
    </main>;
  }
}

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Scanner = lazyWithRetry(() => import('./pages/Scanner'));
const History = lazyWithRetry(() => import('./pages/History'));
const Statistics = lazyWithRetry(() => import('./pages/Statistics'));
const ScanDetails = lazyWithRetry(() => import('./pages/ScanDetails'));
const Comparison = lazyWithRetry(() => import('./pages/Comparison'));
const ExportReport = lazyWithRetry(() => import('./pages/ExportReport'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const AlertSettings = lazyWithRetry(() => import('./pages/AlertSettings'));
const About = lazyWithRetry(() => import('./pages/About'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const Faq = lazyWithRetry(() => import('./pages/Faq'));
const UserGuide = lazyWithRetry(() => import('./pages/UserGuide'));
const LegalDocument = lazyWithRetry(() => import('./pages/LegalDocument'));
const DataPrivacy = lazyWithRetry(() => import('./pages/DataPrivacy'));
import ErrorPage from './components/ErrorPage';
import BottomNav from './components/BottomNav';
import './styles/theme.css';
import './components/system-gates.css';
const TAB_PATHS = {
  home: '/dashboard',
  scan: '/scan',
  history: '/history',
  stats: '/stats',
  faq: '/faq',
  guide: '/guide',
  contact: '/contact',
  about: '/about',
};

function getActiveTab(pathname) {
  if (pathname === '/home') return 'home';
  const match = Object.entries(TAB_PATHS)
    .filter(([, path]) => path !== '/')
    .find(([, path]) => pathname === path || pathname.startsWith(`${path}/`));
  return match?.[0] || (pathname === '/' ? 'home' : undefined);
}

function LoadingRoute() {
  return <SessionCheckScreen />;
}

function ProtectedRoute() {
  const { isGuest, loading } = useAuth();
  const { config } = useRuntimeConfig();
  const location = useLocation();
  if (loading) return <LoadingRoute />;
  if (isGuest) {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace state={{ from: location }} />;
  }
  return config.require_latest_terms ? <TermsConsentGate><Outlet /></TermsConsentGate> : <Outlet />;
}

function GuestRoute() {
  const { isGuest, loading } = useAuth();
  if (loading) return null;
  if (!isGuest) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicRoute() {
  return <Outlet />;
}

function RegistrationDisabledPage() {
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();
  const isArabic = lang === 'ar';
  return <main className="feature-disabled-page" dir={dir}>
    <section className="feature-disabled-card" role="status">
      <h1>{isArabic ? 'التسجيل متوقف حالياً' : 'Registration is currently disabled'}</h1>
      <p>{isArabic ? 'أوقف مسؤول النظام إنشاء حسابات جديدة مؤقتاً. يمكنك تسجيل الدخول إلى حسابك الحالي.' : 'The system administrator has temporarily stopped new account creation. Existing users can still sign in.'}</p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>{isArabic ? 'الانتقال لتسجيل الدخول' : 'Go to sign in'}</button>
    </section>
  </main>;
}

function GuestScanRoute() {
  const { isGuest, loading } = useAuth();
  const { config } = useRuntimeConfig();
  const { lang, dir } = useLanguage();
  const navigate = useNavigate();
  if (loading) return <LoadingRoute />;
  if (isGuest && !config.guest_scanning_enabled) {
    const isArabic = lang === 'ar';
    return <main className="feature-disabled-page" dir={dir}>
      <section className="feature-disabled-card" role="status">
        <h1>{isArabic ? 'الفحص كضيف متوقف' : 'Guest scanning is disabled'}</h1>
        <p>{isArabic ? 'أوقف مسؤول النظام الفحص دون حساب. سجّل الدخول لاستخدام الفحص.' : 'The system administrator has disabled unauthenticated scanning. Sign in to continue.'}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>{isArabic ? 'تسجيل الدخول' : 'Sign in'}</button>
      </section>
    </main>;
  }
  return <RoutedPage component={Scanner} />;
}

function NavigationLayout({ initialScanUrl, onQuickScan, onClearInitial, onNavigateAuth }) {
  const { isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);

  const setActiveTab = (tab) => {
    const path = TAB_PATHS[tab];
    if (path) navigate(path);
  };

  const handleQuickScan = (value) => {
    onQuickScan(value || '');
    navigate('/scan');
  };

  return (
    <div className="app-container">
      <Outlet context={{ activeTab, setActiveTab, isGuest, onNavigateAuth, onQuickScan: handleQuickScan, initialScanUrl, onClearInitial }} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} isGuest={isGuest} />
    </div>
  );
}

function RoutedPage({ component: Component, ...props }) {
  const context = useOutletContext();
  return (
    <Suspense fallback={<LoadingRoute />}>
      <Component {...context} {...props} />
    </Suspense>
  );
}

function AuthNavigation() {
  const navigate = useNavigate();

  return (page, data = {}) => {
    const paths = {
      login: '/login',
      register: '/register',
      'forgot-password': '/forgot-password',
      'reset-password': '/reset-password',
      'verify-otp': '/verify-otp',
      home: '/dashboard',
      scan: '/scan',
    };
    const path = paths[page];
    if (!path) return;

    if (page === 'verify-otp') {
      const email = data.email || '';
      const type = data.type || 'signup';
      if (email) {
        sessionStorage.setItem('nabeh_pending_otp', JSON.stringify({ email, type }));
      }
      navigate(path, { state: { email, type } });
      return;
    }

    if (page === 'home') {
      // Authentication always lands in the official workspace, never the public welcome screen.
      navigate('/dashboard', { replace: true });
      return;
    }

    navigate(path);
  };
}

function VerifyOtpRoute({ onNavigateAuth }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const stored = JSON.parse(sessionStorage.getItem('nabeh_pending_otp') || '{}');

  const email = location.state?.email || query.get('email') || stored.email || '';
  const type = location.state?.type || query.get('type') || stored.type || 'signup';

  return <VerifyOtp onNavigate={onNavigateAuth} email={email} type={type} />;
}

function OnboardingRoute() {
  const navigate = useNavigate();
  return <Onboarding onComplete={() => navigate('/login', { replace: true })} />;
}

function SplashRoute() {
  const navigate = useNavigate();
  const { isGuest, user } = useAuth();

  const handleComplete = () => {
    if (!isGuest && user) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/welcome', { replace: true });
    }
  };

  return <Splash onComplete={handleComplete} />;
}

function SettingsRedirect() {
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes({ initialScanUrl, onQuickScan, onClearInitial }) {
  const { config } = useRuntimeConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const onNavigateAuth = AuthNavigation();
  const query = new URLSearchParams(location.search);
  const { isSecuringSession, finishSecuringSession } = useAuth();

  const navigateFromPage = (tab) => navigate(TAB_PATHS[tab] || '/');
  const rescan = (value) => {
    onQuickScan(value || '');
    navigate('/scan');
  };

  if (isSecuringSession) {
    return <SessionCheckScreen onComplete={finishSecuringSession} />;
  }

  return (
    <Routes>
      {/* The public entry point initializes through Splash before WelcomePage. */}
      <Route path="/" element={<SplashRoute />} />

      <Route element={<PublicRoute />}>
        <Route element={<NavigationLayout initialScanUrl={initialScanUrl} onQuickScan={onQuickScan} onClearInitial={onClearInitial} onNavigateAuth={onNavigateAuth} />}>
          <Route path="/scan" element={<TermsConsentGate><GuestScanRoute /></TermsConsentGate>} />
          <Route path="/faq" element={<RoutedPage component={Faq} />} />
          <Route path="/support" element={<RoutedPage component={Faq} />} />
          <Route path="/guide" element={<RoutedPage component={UserGuide} />} />
          <Route path="/contact" element={<RoutedPage component={Contact} />} />
          <Route path="/about" element={<RoutedPage component={About} />} />
          <Route path="/terms" element={<RoutedPage component={LegalDocument} type="terms" />} />
          <Route path="/privacy" element={<RoutedPage component={LegalDocument} type="privacy" />} />
          <Route path="/disclaimer" element={<RoutedPage component={LegalDocument} type="disclaimer" />} />
        </Route>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/splash" element={<SplashRoute />} />
      </Route>

      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login onNavigate={onNavigateAuth} />} />
        <Route path="/register" element={config.registration_enabled ? <Register onNavigate={onNavigateAuth} /> : <RegistrationDisabledPage />} />
        <Route path="/forgot-password" element={<ForgotPassword onNavigate={onNavigateAuth} />} />
        <Route path="/reset-password" element={<ResetPassword onNavigate={onNavigateAuth} />} />
        <Route path="/verify-otp" element={<VerifyOtpRoute onNavigateAuth={onNavigateAuth} />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<NavigationLayout initialScanUrl={initialScanUrl} onQuickScan={onQuickScan} onClearInitial={onClearInitial} onNavigateAuth={onNavigateAuth} />}>
          <Route path="/dashboard" element={<RoutedPage component={Dashboard} />} />
          <Route path="/notifications" element={<RoutedPage component={Notifications} />} />
          <Route path="/settings/alerts" element={<RoutedPage component={AlertSettings} />} />
          <Route path="/settings/privacy" element={<RoutedPage component={DataPrivacy} />} />
          <Route path="/settings/account-data" element={<RoutedPage component={DataPrivacy} />} />
          {/* /home remains a backwards-compatible alias; Dashboard is the single workspace. */}
          <Route path="/home" element={<RoutedPage component={Dashboard} />} />
          <Route path="/history" element={<RoutedPage component={History} onQuickScan={rescan} />} />
          <Route path="/stats" element={<RoutedPage component={Statistics} />} />
          <Route path="/scan-details/:scanId" element={<RoutedPage component={ScanDetails} />} />
          <Route path="/compare" element={<RoutedPage component={Comparison} />} />
          <Route path="/export-report" element={<RoutedPage component={ExportReport} />} />
          <Route path="/settings" element={<SettingsRedirect />} />
        </Route>
      </Route>

      <Route path="/404" element={<ErrorPage type="404" onNavigate={navigateFromPage} />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

function RuntimeApplication() {
  const { config, loading, refresh } = useRuntimeConfig();
  const [initialScanUrl, setInitialScanUrl] = useState('');

  if (loading) return <main className="runtime-config-loading" role="status">{config.default_language === 'ar' ? 'جارٍ تحميل إعدادات النظام...' : 'Loading system settings…'}</main>;
  if (config.service_available === false) {
    return <ThemeProvider><LanguageProvider><ServiceUnavailablePage onCheckAgain={refresh} /></LanguageProvider></ThemeProvider>;
  }
  if (config.maintenance_mode) {
    return <ThemeProvider><LanguageProvider><MaintenancePage onCheckAgain={refresh} /></LanguageProvider></ThemeProvider>;
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <AppRoutes
              initialScanUrl={initialScanUrl}
              onQuickScan={(value) => setInitialScanUrl(value || '')}
              onClearInitial={() => setInitialScanUrl('')}
            />
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <RuntimeConfigProvider>
        <RuntimeApplication />
      </RuntimeConfigProvider>
    </AppErrorBoundary>
  );
}
