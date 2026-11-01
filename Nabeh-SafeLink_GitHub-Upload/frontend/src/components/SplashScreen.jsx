import { useEffect } from 'react';
import Logo from './Logo';
import { ShieldCheckIcon } from './Icons';
import '../styles/splash.css';

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-page">
      {/* Background Cyber Grid Pattern */}
      <div className="splash-cyber-grid" />

      <div className="splash-content fade-in">
        {/* Prominent Large Logo */}
        <div className="splash-logo-wrapper">
          <Logo size="lg" showTagline={true} />
        </div>

        {/* Powerful Circular Cyber Security Radar Spinner */}
        <div className="splash-radar-wrapper">
          <div className="radar-ring radar-ring-outer" />
          <div className="radar-ring radar-ring-middle" />
          <div className="radar-ring radar-ring-inner" />

          <div className="radar-center-icon">
            <ShieldCheckIcon size={40} color="#1E90FF" />
          </div>
        </div>

        {/* Live Security Initialization Status */}
        <div className="splash-status-block">
          <span className="splash-status-title">
            جاري تهيئة محرك الأمان والتحقق المباشر
          </span>
          <span className="splash-status-subtitle">
            Nabeh Hybrid Security Engine v1.0 • Active Protection
          </span>
        </div>
      </div>

      <div className="splash-footer">
        Nabeh SafeLink Security Infrastructure • All Rights Reserved © 2026
      </div>
    </div>
  );
}
