import axios from 'axios';
import { getAccessToken } from './authToken';
import { frontendLog, newRequestId, safeRouteName } from './observability';

const configuredApiUrl = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD ? '/api/v1' : 'http://localhost:8000/api/v1'
);

const API_URL = (() => {
  if (!import.meta.env.PROD || typeof window === 'undefined') return configuredApiUrl;
  try {
    const configured = new URL(configuredApiUrl, window.location.origin);
    const pageHost = window.location.hostname.toLowerCase();
    const apiHost = configured.hostname.toLowerCase();
    const wwwMismatch = (pageHost === 'www.intellidefenda.com' && apiHost === 'intellidefenda.com') ||
      (pageHost === 'intellidefenda.com' && apiHost === 'www.intellidefenda.com');
    if (wwwMismatch) return configured.pathname.replace(/\/+$/, '') || '/api/v1';
  } catch {
    // Preserve the configured value so the existing HTTPS validation can fail clearly.
  }
  return configuredApiUrl;
})();
export const SCAN_IDEMPOTENCY_ENABLED = import.meta.env.VITE_SCAN_IDEMPOTENCY_ENABLED === 'true';

if (
  import.meta.env.PROD &&
  /^https?:\/\//i.test(API_URL) &&
  new URL(API_URL).protocol !== 'https:'
) {
  throw new Error('VITE_API_URL must use HTTPS in production.');
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // URL scans may use VirusTotal before the bounded AI fallback; keep this
  // above the backend's provider timeout without allowing an endless request.
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const startedAt = performance.now();
  const requestId = newRequestId();
  config.metadata = { startedAt, requestId };
  config.headers = config.headers || {};
  config.headers['X-Request-ID'] = requestId;
  const token = getAccessToken();
  if (token) {
    if (!config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  }
  frontendLog('frontend_request_started', { method: config.method?.toUpperCase(), route: safeRouteName(config.url), request_id: requestId });
  return config;
});

api.interceptors.response.use(
  (response) => {
    const metadata = response.config?.metadata || {};
    const requestId = response.headers?.['x-request-id'] || metadata.requestId;
    frontendLog('frontend_request_succeeded', { method: response.config?.method?.toUpperCase(), route: safeRouteName(response.config?.url), status: response.status, duration_ms: Math.round(performance.now() - (metadata.startedAt || performance.now())), request_id: requestId });
    return response;
  },
  (error) => {
    const metadata = error.config?.metadata || {};
    const requestId = error.response?.headers?.['x-request-id'] || metadata.requestId;
    frontendLog('frontend_request_failed', { method: error.config?.method?.toUpperCase(), route: safeRouteName(error.config?.url), status: error.response?.status || 0, duration_ms: Math.round(performance.now() - (metadata.startedAt || performance.now())), request_id: requestId, error_code: error.response?.data?.code || 'REQUEST_FAILED' });
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nabeh:auth-expired'));
    }
    return Promise.reject(error);
  },
);

export const scanURL = async (inputValue, language = 'ar', isGuest = true, inputType = 'URL', idempotencyKey = null) => {
  const endpoint = isGuest ? '/scans/guest' : '/scans/';
  const response = await api.post(endpoint, {
    input_type: inputType,
    input_value: inputValue,
    language,
  }, SCAN_IDEMPOTENCY_ENABLED && idempotencyKey && !isGuest ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined);
  return response.data;
};

export const getScans = async () => {
  const response = await api.get('/scans/');
  return response.data;
};

export const getScanDetails = async (scanId) => {
  const response = await api.get(`/scans/${encodeURIComponent(scanId)}`);
  return response.data;
};

export const compareScans = async (scanIds) => {
  const response = await api.get(`/scans/compare?ids=${scanIds.map(encodeURIComponent).join(',')}`);
  return response.data;
};

export const getStatistics = async () => {
  const response = await api.get('/statistics/me');
  return response.data;
};

export const submitSupportRequest = async ({ requestType, email, subject, scanId, details }) => {
  const response = await api.post('/support/contact', {
    request_type: requestType,
    email,
    subject,
    scan_id: scanId || null,
    details,
  });
  return response.data;
};

export const getLegalDocument = async (type, language = 'ar') => {
  const response = await api.get(`/legal/${type}?language=${encodeURIComponent(language)}`);
  return response.data;
};

export const hideScan = async (scanId) => (await api.post(`/scans/${encodeURIComponent(scanId)}/hide`)).data;
export const unhideScan = async (scanId) => (await api.post(`/scans/${encodeURIComponent(scanId)}/unhide`)).data;
export const deleteScan = async (scanId) => (await api.delete(`/scans/${encodeURIComponent(scanId)}`)).data;
export const exportUserData = async () => (await api.get('/dashboard/privacy/export')).data;
export const getDeletionRequest = async () => (await api.get('/dashboard/account/deletion-request')).data;
export const requestAccountDeletion = async (reason) => (await api.post('/dashboard/account/deletion-request', { reason })).data;
export const cancelAccountDeletion = async () => (await api.post('/dashboard/account/deletion-request/cancel')).data;
export const deleteAccount = async (current_password, confirmation) => (await api.delete('/dashboard/account', { data: { current_password, confirmation } })).data;

export default api;
