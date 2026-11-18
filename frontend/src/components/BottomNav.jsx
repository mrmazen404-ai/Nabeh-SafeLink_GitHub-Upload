import { ShieldIcon, BarChartIcon, InfoIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';

export default function BottomNav({ activeTab, setActiveTab, isGuest = false }) {
  const { t } = useLanguage();
  if (isGuest) return null;
  const tabs = [
    { id: 'home', label: t('nav.home'), icon: ShieldIcon },
    { id: 'scan', label: t('nav.scan'), icon: ShieldIcon },
    { id: 'history', label: t('nav.history'), icon: BarChartIcon },
    { id: 'stats', label: t('nav.stats'), icon: InfoIcon },
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label={t('nav.home')}>
      {tabs.map((item) => {
        const IconComponent = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <IconComponent size={20} color={isActive ? 'var(--color-secondary)' : 'var(--color-text-muted)'} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
