import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { clearAccessToken, getAccessToken, setAccessToken } from '../services/authToken';

const AuthContext = createContext(null);

function clearLocalSession(setUser, setToken, setStatus) {
  clearAccessToken();
  setUser(null);
  setToken(null);
  setStatus('guest');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => getAccessToken());
  const [status, setStatus] = useState(() => (getAccessToken() ? 'checking' : 'guest'));
  const [isSecuringSession, setIsSecuringSession] = useState(false);

  const finishSecuringSession = useCallback(() => {
    setIsSecuringSession(false);
  }, []);

  const loading = status === 'checking' || status === 'logging_in' || status === 'logging_out';
  const isGuest = status === 'guest' || status === 'error' || !user || !token;

  const checkAuth = useCallback(async (candidateToken = getAccessToken(), force = false) => {
    if (!candidateToken) {
      clearLocalSession(setUser, setToken, setStatus);
      return null;
    }

    // Deduplicate / Cache: If user is already authenticated with the same token, avoid duplicate network calls.
    if (!force && user && token === candidateToken && status === 'authenticated') {
      return user;
    }

    setStatus((prev) => (prev === 'authenticated' ? prev : 'checking'));
    try {
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      const authenticatedUser = res.data?.success ? res.data?.data : null;
      if (!authenticatedUser?.user_id) {
        clearLocalSession(setUser, setToken, setStatus);
        return null;
      }
      setUser(authenticatedUser);
      setToken(candidateToken);
      setStatus('authenticated');
      return authenticatedUser;
    } catch (error) {
      clearLocalSession(setUser, setToken, setStatus);
      setStatus('guest');
      throw error;
    }
  }, [user, token, status]);

  // Initial check on app startup (runs only once)
  useEffect(() => {
    const currentToken = getAccessToken();
    if (!currentToken) {
      setStatus('guest');
      return undefined;
    }
    checkAuth(currentToken).catch(() => {
      // checkAuth clears local session on failure
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => clearLocalSession(setUser, setToken, setStatus);
    window.addEventListener('nabeh:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('nabeh:auth-expired', handleAuthExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    setStatus('logging_in');
    try {
      const res = await api.post('/auth/login', { email, password });
      const accessToken = res.data?.data?.access_token;
      if (!res.data?.success || !accessToken) throw new Error('فشل تسجيل الدخول');
      setAccessToken(accessToken);
      setToken(accessToken);
      await checkAuth(accessToken, true);
      setIsSecuringSession(true);
      return res.data;
    } catch (error) {
      clearLocalSession(setUser, setToken, setStatus);
      throw error;
    }
  }, [checkAuth]);

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.post('/auth/register', { email, password, display_name: displayName });
    return res.data;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  }, []);

  const resendOtp = useCallback(async (email, type = 'signup') => {
    const res = await api.post('/auth/resend-otp', { email, type });
    return res.data;
  }, []);

  const resetPassword = useCallback(async (newPassword, recoveryToken) => {
    if (!recoveryToken) throw new Error('رمز استعادة كلمة المرور مفقود');
    const res = await api.post(
      '/auth/reset-password',
      { new_password: newPassword },
      { headers: { Authorization: `Bearer ${recoveryToken}` } },
    );
    sessionStorage.removeItem('nabeh_recovery_token');
    return res.data;
  }, []);

  const verifyOtp = useCallback(async (email, otpToken, type = 'signup') => {
    const res = await api.post('/auth/verify-otp', { email, token: otpToken, type });
    const accessToken = res.data?.data?.access_token;
    if (res.data?.success && accessToken && type === 'signup') {
      setAccessToken(accessToken);
      setToken(accessToken);
      await checkAuth(accessToken, true);
      setIsSecuringSession(true);
    } else if (res.data?.success && accessToken && type === 'recovery') {
      sessionStorage.setItem('nabeh_recovery_token', accessToken);
    }
    return res.data;
  }, [checkAuth]);

  const logout = useCallback(async () => {
    setStatus('logging_out');
    try {
      if (getAccessToken()) await api.post('/auth/logout');
    } catch {
      // Always clear local credentials even if the server is temporarily unavailable.
    } finally {
      clearLocalSession(setUser, setToken, setStatus);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    status,
    loading,
    isGuest,
    isSecuringSession,
    login,
    register,
    forgotPassword,
    resendOtp,
    resetPassword,
    verifyOtp,
    logout,
    checkAuth,
    finishSecuringSession,
  }), [user, token, status, loading, isGuest, isSecuringSession, login, register, forgotPassword, resendOtp, resetPassword, verifyOtp, logout, checkAuth, finishSecuringSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
