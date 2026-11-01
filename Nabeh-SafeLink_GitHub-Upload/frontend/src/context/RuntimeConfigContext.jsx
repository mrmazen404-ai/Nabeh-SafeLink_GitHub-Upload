import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const RuntimeConfigContext = createContext(null);

export const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  default_theme: 'light',
  default_language: 'ar',
  allow_theme_override: true,
  allow_language_override: true,
  maintenance_mode: false,
  registration_enabled: true,
  guest_scanning_enabled: true,
  public_metrics_enabled: true,
  ai_explanations_enabled: true,
  require_latest_terms: false,
});

const SAFE_RUNTIME_CONFIG = Object.freeze({
  ...DEFAULT_RUNTIME_CONFIG,
  maintenance_mode: true,
  registration_enabled: false,
  guest_scanning_enabled: false,
  public_metrics_enabled: false,
  ai_explanations_enabled: false,
  require_latest_terms: true,
});

export function RuntimeConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState(false);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await api.get('/public/runtime-config', { timeout: 12000 });
      if (!response.data?.success || !response.data?.data) throw new Error('Invalid runtime config response');
      setConfig({ ...DEFAULT_RUNTIME_CONFIG, ...response.data.data });
      setLastError(false);
    } catch {
      // Fail closed: do not mount authenticated/product routes without server policy.
      setConfig({ ...SAFE_RUNTIME_CONFIG });
      setLastError(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => refresh({ quiet: true }), 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const value = useMemo(() => ({ config: config || SAFE_RUNTIME_CONFIG, loading, lastError, refresh }), [config, loading, lastError, refresh]);
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext);
  if (!context) throw new Error('useRuntimeConfig must be used within RuntimeConfigProvider');
  return context;
}
