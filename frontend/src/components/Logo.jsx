import { ShieldIcon, LinkIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';

export default function Logo({ size = 'md', showTagline = false }) {
  const { t } = useLanguage();
  const iconSize = size === 'lg' ? 44 : size === 'sm' ? 28 : 36;
  const titleSize = size === 'lg' ? '22px' : size === 'sm' ? '14px' : '18px';
  const subSize = size === 'lg' ? '16px' : size === 'sm' ? '11px' : '14px';

  return (
    <div className="nabeh-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div
        className="nabeh-logo-icon"
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-primary-light, #0A2540)',
          borderRadius: '8px'
        }}
      >
        <ShieldIcon size={iconSize * 0.65} color="var(--color-secondary, #1E90FF)" />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <LinkIcon size={iconSize * 0.38} color="#FFFFFF" />
        </div>
      </div>

      <div className="nabeh-logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: titleSize, color: 'var(--color-text, #0A2540)', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Nabeh
          </span>
          <span style={{ fontSize: subSize, color: 'var(--color-secondary, #1E90FF)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            SafeLink
          </span>
        </div>
        {showTagline && (
          <span style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '0.2px' }}>
            {t('splash.tagline')}
          </span>
        )}
      </div>
    </div>
  );
}
