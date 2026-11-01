import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { MoonIcon, SunIcon, GlobeIcon, HomeIcon } from './Icons';
import { useNavigate } from 'react-router-dom';

export default function AuthPageControls() {
  const { lang, toggleLanguage, canChangeLanguage, t } = useLanguage();
  const { theme, toggleTheme, canChangeTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="auth-page-controls" aria-label="Page preferences">
      <button type="button" className="auth-control auth-home-control" onClick={() => navigate('/welcome')} aria-label={t('nav.home')} title={t('nav.home')}>
        <HomeIcon size={15} color="currentColor" /><span>{t('nav.home')}</span>
      </button>
      {canChangeLanguage && <button type="button" className="auth-control auth-language-control" onClick={toggleLanguage} aria-label={t('auth.changeLanguage')} title={t('auth.changeLanguage')}>
        <GlobeIcon size={15} color="currentColor" /><span>{lang === 'ar' ? 'English' : 'العربية'}</span>
      </button>}
      {canChangeTheme && <button type="button" className="auth-control auth-theme-control" onClick={toggleTheme} aria-label={t('auth.toggleTheme')} title={t('auth.toggleTheme')}>
        {theme === 'dark' ? <SunIcon size={16} color="currentColor" /> : <MoonIcon size={16} color="currentColor" />}
      </button>}
    </div>
  );
}
