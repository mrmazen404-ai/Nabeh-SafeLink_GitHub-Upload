import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRuntimeConfig } from './RuntimeConfigContext';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { config } = useRuntimeConfig();
  const [theme, setThemeState] = useState(() => {
    if (!config.allow_theme_override) return config.default_theme;
    try {
      const savedTheme = localStorage.getItem('safelink_theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
    } catch (e) {
      console.error('Error reading theme from localStorage', e);
    }
    return config.default_theme;
  });

  const [animatingTheme, setAnimatingTheme] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!config.allow_theme_override) {
      setThemeState(config.default_theme);
      return;
    }
    try {
      const savedTheme = localStorage.getItem('safelink_theme');
      setThemeState(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : config.default_theme);
    } catch {
      setThemeState(config.default_theme);
    }
  }, [config.allow_theme_override, config.default_theme]);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      if (config.allow_theme_override) localStorage.setItem('safelink_theme', theme);
    } catch (e) {
      console.error('Error saving theme to localStorage', e);
    }
  }, [theme, config.allow_theme_override]);

  const toggleTheme = useCallback(() => {
    if (!config.allow_theme_override) return;
    setThemeState((prevTheme) => {
      const nextTheme = prevTheme === 'dark' ? 'light' : 'dark';

      // Trigger cloud animation concurrently for fast responsive feedback
      setAnimatingTheme(nextTheme);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setAnimatingTheme(null);
      }, 650);

      return nextTheme;
    });
  }, [config.allow_theme_override]);

  const setTheme = useCallback((newTheme) => {
    if (!config.allow_theme_override) return;
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
      setAnimatingTheme(newTheme);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setAnimatingTheme(null);
      }, 650);
    }
  }, [config.allow_theme_override]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, canChangeTheme: config.allow_theme_override }}>
      {children}
      {animatingTheme && (
        <div className={`theme-cloud-overlay ${animatingTheme}-cloud-active`} aria-hidden="true">
          <div className="cloud-wave-container">
            <svg className="cloud-wave-svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
              <path
                className="cloud-wave-path"
                d="M0,160L48,176C96,192,192,224,288,218.7C384,213,480,171,576,165.3C672,160,768,192,864,197.3C960,203,1056,181,1152,160C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              />
            </svg>
            <div className="cloud-fill-body" />
            <div className="cloud-icon-badge">
              {animatingTheme === 'dark' ? (
                <span className="cloud-symbol moon">🌙</span>
              ) : (
                <span className="cloud-symbol sun">☀️</span>
              )}
            </div>
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
