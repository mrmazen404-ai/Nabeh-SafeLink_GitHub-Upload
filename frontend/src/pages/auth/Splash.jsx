import { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getAccessToken } from '../../services/authToken';
import AuthPageControls from '../../components/AuthPageControls';
import '../../styles/splash.css';
import './login.css';

async function checkBackendHealth() {
  try {
    const res = await api.get('/health', { timeout: 2500 });
    return res.status === 200;
  } catch {
    return false;
  }
}

export default function Splash({ onComplete }) {
  const [stage, setStage] = useState('preparing'); // 'preparing' | 'checking' | 'ready' | 'offline'
  const [isExiting, setIsExiting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const { t, dir, lang } = useLanguage();
  const auth = useAuth();
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Monitor online / offline status in real time
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stage 1: Preparation timer
  useEffect(() => {
    let isMounted = true;

    const prepareTimer = setTimeout(() => {
      if (isMounted) {
        setStage(navigator.onLine ? 'checking' : 'offline');
      }
    }, 500);

    // Fail-safe hard timeout: Ensure splash finishes within 2500ms max
    const failSafeTimer = setTimeout(() => {
      if (isMounted) {
        setStage('ready');
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(prepareTimer);
      clearTimeout(failSafeTimer);
    };
  }, []);

  // Stage 2: Parallel Security Bootstrap & Verification
  useEffect(() => {
    if (stage !== 'checking') return;

    let isMounted = true;

    async function runSecurityBootstrap() {
      const candidateToken = getAccessToken();

      // Parallel Task 1: Backend API Health Check
      const healthPromise = checkBackendHealth();

      // Parallel Task 2: JWT Session Token Verification
      const authPromise = candidateToken && auth?.checkAuth
        ? auth.checkAuth(candidateToken).catch(() => null)
        : Promise.resolve();

      await Promise.allSettled([healthPromise, authPromise]);

      if (isMounted) {
        setStage('ready');
      }
    }

    runSecurityBootstrap();

    return () => {
      isMounted = false;
    };
  }, [stage, auth]);

  // Stage 3: Exit transition and completion callback
  useEffect(() => {
    if (stage !== 'ready') return;

    let timerExit;
    let timerComplete;
    let isMounted = true;

    timerExit = setTimeout(() => {
      if (isMounted) setIsExiting(true);
    }, 250);

    timerComplete = setTimeout(() => {
      if (isMounted && onCompleteRef.current) {
        onCompleteRef.current();
      }
    }, 600);

    return () => {
      isMounted = false;
      clearTimeout(timerExit);
      clearTimeout(timerComplete);
    };
  }, [stage]);

  const getStatusText = () => {
    if (!isOnline || stage === 'offline') {
      return t('splash.statusOffline') || (lang === 'ar' ? 'تعذر الاتصال بالشبكة. تحقق من اتصالك بالإنترنت...' : 'Network connection unavailable. Please check your internet connection...');
    }
    switch (stage) {
      case 'ready':
        return t('splash.statusReady');
      case 'checking':
        return t('splash.statusChecking');
      case 'preparing':
      default:
        return t('splash.statusPreparing');
    }
  };

  return (
    <main
      className={`splash-page${isExiting ? ' is-exiting' : ''}`}
      aria-label="Nabeh SafeLink"
      dir={dir}
    >
      <AuthPageControls />
      <div className="splash-background" aria-hidden="true" />

      <section className="splash-content" role="status" aria-live="polite">
        <div className="splash-brand-mark" aria-hidden="true">
          <svg className="splash-shield" viewBox="0 0 180 204" role="img">
            <defs>
              <linearGradient id="splashShieldGradient" x1="0" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="var(--splash-shield-top, #8CB9FF)" />
                <stop offset="42%" stopColor="var(--splash-shield-mid, #3D82FF)" />
                <stop offset="100%" stopColor="var(--splash-shield-base, #1A2B5E)" />
              </linearGradient>
              <linearGradient id="splashShieldEdge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#B7D4FF" stopOpacity="0.2" />
              </linearGradient>
              <filter id="splashShieldShadow" x="-35%" y="-25%" width="170%" height="170%">
                <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#1A2B5E" floodOpacity="0.25" />
              </filter>
            </defs>

            {/* Outer Glow Halo Ring */}
            <path
              className="splash-shield-halo"
              d="M90 3 169 31v58c0 52-31 91-79 114C42 180 11 141 11 89V31L90 3Z"
              fill="none"
              stroke="var(--splash-halo-stroke, rgba(61, 130, 255, 0.35))"
              strokeWidth="2"
            />

            {/* Main Shield Body */}
            <path
              className="splash-shield-body"
              d="M90 7 165 34v55c0 49-29 86-75 108C44 175 15 138 15 89V34L90 7Z"
              fill="url(#splashShieldGradient)"
              stroke="url(#splashShieldEdge)"
              strokeWidth="4"
              strokeLinejoin="round"
              filter="url(#splashShieldShadow)"
            />

            {/* Inset Accent Border */}
            <path
              d="M90 27 144 47v42c0 35-18 63-54 82-36-19-54-47-54-82V47l54-20Z"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.25"
              strokeWidth="2.5"
            />

            {/* Vector Link Icon */}
            <g
              transform="translate(63, 75) scale(2.25)"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="splash-shield-icon"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </g>
          </svg>
        </div>

        <div className="splash-wordmark">
          <h1>
            <span className="splash-wordmark-main">Nabeh</span>
            <span className="splash-wordmark-sub">SafeLink</span>
          </h1>
          <p className="splash-tagline">{t('splash.tagline')}</p>
        </div>

        <div className="splash-status-block">
          <span className="splash-status-title">{getStatusText()}</span>
          <span className="splash-status-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      </section>

      <p className="splash-footer">{t('splash.footer')}</p>

      <svg className="splash-waves" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden="true">
        <path className="splash-wave-back" d="M0 180c190-98 360-80 535-16 195 71 322 72 494-10 161-76 276-72 411-10v216H0Z" />
        <path className="splash-wave-mid" d="M0 232c168-80 322-75 487-9 190 76 345 79 520-14 158-83 281-65 433 9v142H0Z" />
        <path className="splash-wave-front" d="M0 294c180-67 327-58 498 3 193 69 359 61 525-22 147-73 278-66 417-5v87H0Z" />
      </svg>
    </main>
  );
}
