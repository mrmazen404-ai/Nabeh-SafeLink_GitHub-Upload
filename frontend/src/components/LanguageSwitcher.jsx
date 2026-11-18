import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

function GlobeIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function CheckIcon({ size = 16, color = '#1E90FF' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const { lang, setLanguage, canChangeLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  const handleSelect = (selectedLang) => {
    setLanguage(selectedLang);
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentLabel = lang === 'ar' ? 'العربية' : 'English';

  if (!canChangeLanguage) return null;

  return (
    <div className="lang-switcher-container" ref={containerRef}>
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={toggleDropdown}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('nav.changeLanguage')}
        title={t('nav.changeLanguage')}
      >
        <GlobeIcon size={18} color="var(--color-primary)" />
        <span className="lang-current-text">{currentLabel}</span>
        <span className={`lang-arrow ${isOpen ? 'open' : ''}`}>
          <ChevronDownIcon size={14} color="var(--color-text-muted)" />
        </span>
      </button>

      {isOpen && (
        <div
          className="lang-dropdown-menu"
          role="menu"
          aria-label={t('nav.languageSelect')}
        >
          <button
            type="button"
            className={`lang-option ${lang === 'ar' ? 'active' : ''}`}
            onClick={() => handleSelect('ar')}
            role="menuitemradio"
            aria-checked={lang === 'ar'}
          >
            <span className="lang-option-text">العربية</span>
            {lang === 'ar' && <CheckIcon size={16} color="var(--color-secondary)" />}
          </button>

          <button
            type="button"
            className={`lang-option ${lang === 'en' ? 'active' : ''}`}
            onClick={() => handleSelect('en')}
            role="menuitemradio"
            aria-checked={lang === 'en'}
          >
            <span className="lang-option-text">English</span>
            {lang === 'en' && <CheckIcon size={16} color="var(--color-secondary)" />}
          </button>
        </div>
      )}

      <style>{`
        .lang-switcher-container {
          position: relative;
          display: inline-block;
          z-index: 110;
        }

        .lang-switcher-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 8px);
          padding: 6px 14px;
          background: var(--color-bg, #ffffff);
          border: 1px solid var(--color-border, #E2E8F0);
          border-radius: var(--radius-md, 8px);
          color: var(--color-text, #0F172A);
          font-family: inherit;
          font-size: var(--text-sm, 14px);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast, 150ms);
          box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05));
          user-select: none;
        }

        .lang-switcher-btn:hover {
          border-color: var(--color-secondary, #1E90FF);
          background: var(--color-secondary-subtle, #EFF6FF);
          color: var(--color-secondary, #1E90FF);
        }

        .lang-current-text {
          font-weight: 600;
        }

        .lang-arrow {
          display: flex;
          align-items: center;
          transition: transform 180ms ease;
        }

        .lang-arrow.open {
          transform: rotate(180deg);
        }

        .lang-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          inset-inline-end: 0;
          width: 140px;
          background: var(--color-bg, #ffffff);
          border: 1px solid var(--color-border-strong, #CBD5E1);
          border-radius: var(--radius-md, 8px);
          box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1));
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: langMenuFadeIn 150ms ease-out forwards;
        }

        @keyframes langMenuFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lang-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm, 6px);
          color: var(--color-text, #0F172A);
          font-family: inherit;
          font-size: var(--text-sm, 14px);
          font-weight: 500;
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
          text-align: start;
        }

        .lang-option:hover {
          background: var(--color-bg-subtle, #F8FAFC);
          color: var(--color-primary, #0A2540);
        }

        .lang-option.active {
          background: var(--color-secondary-subtle, #EFF6FF);
          color: var(--color-secondary, #1E90FF);
          font-weight: 700;
        }

        .lang-option-text {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
