import { useState, useRef, useEffect } from 'react';
import { HelpCircleIcon, BookOpenIcon, MailIcon, InfoIcon, ChevronDownIcon } from './Icons';
import { useLanguage } from '../context/LanguageContext';

export default function HelpMenu({ activeTab, setActiveTab }) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const isHelpActive = ['faq', 'guide', 'contact', 'about'].includes(activeTab);

  const helpItems = [
    { id: 'faq', label: t('nav.faq'), icon: HelpCircleIcon },
    { id: 'guide', label: t('nav.guide'), icon: BookOpenIcon },
    { id: 'contact', label: t('nav.contact'), icon: MailIcon },
    { id: 'about', label: t('nav.about'), icon: InfoIcon },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (tabId) => {
    setActiveTab(tabId);
    setIsOpen(false);
  };

  return (
    <div className="help-menu-container" ref={menuRef}>
      <button
        type="button"
        className={`help-trigger-btn ${isOpen || isHelpActive ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t('nav.help')}
        title={t('nav.help')}
      >
        <HelpCircleIcon size={18} color={isOpen || isHelpActive ? 'var(--color-secondary)' : 'currentColor'} />
        <span className="help-btn-label">{t('nav.help')}</span>
        <ChevronDownIcon size={14} className={`help-arrow ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="help-dropdown-menu" role="menu">
          <div className="help-dropdown-header">
            <span>{t('nav.help')}</span>
          </div>
          <div className="help-dropdown-items">
            {helpItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`help-dropdown-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(item.id)}
                  role="menuitem"
                >
                  <Icon size={16} color={isActive ? 'var(--color-secondary)' : 'var(--color-text-secondary)'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        .help-menu-container {
          position: relative;
          display: inline-block;
        }

        .help-trigger-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 38px;
          padding: 0 12px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          color: var(--color-text);
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          box-shadow: var(--shadow-xs);
        }

        .help-trigger-btn:hover,
        .help-trigger-btn.active {
          border-color: var(--color-secondary);
          background: var(--color-secondary-subtle);
          color: var(--color-secondary);
        }

        .help-arrow {
          transition: transform var(--transition-fast);
        }

        .help-arrow.open {
          transform: rotate(180deg);
        }

        .help-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          inset-inline-end: 0;
          width: 200px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 1000;
          animation: helpFadeIn 150ms ease-out;
          overflow: hidden;
        }

        @keyframes helpFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .help-dropdown-header {
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--color-text-muted);
          background: var(--color-bg-subtle);
          border-bottom: 1px solid var(--color-border);
        }

        .help-dropdown-items {
          padding: 4px 0;
        }

        .help-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
          cursor: pointer;
          text-align: start;
          transition: background var(--transition-fast), color var(--transition-fast);
        }

        .help-dropdown-item:hover,
        .help-dropdown-item.active {
          background: var(--color-bg-subtle);
          color: var(--color-secondary);
        }

        @media (max-width: 600px) {
          .help-btn-label {
            display: none;
          }
          .help-trigger-btn {
            padding: 0 10px;
          }
        }
      `}</style>
    </div>
  );
}
