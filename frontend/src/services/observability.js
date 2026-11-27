const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export const newRequestId = () => {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return value.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
};

const safeRoute = (url = '') => {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${parsed.origin === origin ? '' : parsed.origin}${parsed.pathname}`.slice(0, 240);
  } catch {
    return String(url).split('?')[0].slice(0, 240);
  }
};

export const frontendLog = (event, fields = {}) => {
  if (!import.meta.env.DEV || typeof console === 'undefined') return;
  const safe = { event, timestamp: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    if (/token|password|authorization|cookie|input|message|body|query|fragment|url|email|phone|response/i.test(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 160);
    else if (typeof value === 'number' || typeof value === 'boolean' || value == null) safe[key] = value;
  }
  console.info('[nabeh-observability]', safe);
};

export const safeRouteName = safeRoute;
