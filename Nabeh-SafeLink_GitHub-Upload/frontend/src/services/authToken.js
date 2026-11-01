const STORAGE_KEY = 'nabeh_access_token';

// Session-scoped persistence keeps the user on the same route after Refresh
// without creating a long-lived localStorage credential.
export const getAccessToken = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = (token) => {
  try {
    if (typeof token === 'string' && token.trim()) sessionStorage.setItem(STORAGE_KEY, token.trim());
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // If storage is unavailable, the API request still remains the source of truth.
  }
};

export const clearAccessToken = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required for local logout.
  }
};
