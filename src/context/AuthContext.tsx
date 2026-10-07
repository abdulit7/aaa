import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  token: string | null;
  sessionId: string | null;
  loading: boolean;
  login: (login: string, password: string, device?: string, device_type?: 'tablet' | 'web') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (oldPw: string, newPw: string) => Promise<{ success: boolean; error?: string }>;
  switchActiveLocation: (location: string) => void;
  isAdmin: boolean;
  isSupervisor: boolean;
  isGuard: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('gatemaster_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('gatemaster_refresh_token'));
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem('gatemaster_session_id'));
  const [loading, setLoading] = useState(true);

  const attemptRefresh = useCallback(async (currentRefresh: string, currentSessionId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefresh, sessionId: currentSessionId })
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('gatemaster_token', data.token);
      localStorage.setItem('gatemaster_refresh_token', data.refreshToken);
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async res => {
          if (!res.ok) {
            // Try refreshing if refresh token is present
            if (refreshToken && sessionId) {
              const refreshed = await attemptRefresh(refreshToken, sessionId);
              if (refreshed) return;
            }
            throw new Error('Session invalid');
          }
          return res.json();
        })
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            if (data.sessionId) setSessionId(data.sessionId);
          }
        })
        .catch(() => {
          localStorage.removeItem('gatemaster_token');
          localStorage.removeItem('gatemaster_refresh_token');
          localStorage.removeItem('gatemaster_session_id');
          setToken(null);
          setRefreshToken(null);
          setSessionId(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, refreshToken, sessionId, attemptRefresh]);

  const login = async (loginId: string, password: string, device?: string, device_type?: 'tablet' | 'web') => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginId, password, device, device_type })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }
      localStorage.setItem('gatemaster_token', data.token);
      if (data.refreshToken) {
        localStorage.setItem('gatemaster_refresh_token', data.refreshToken);
        setRefreshToken(data.refreshToken);
      }
      if (data.sessionId) {
        localStorage.setItem('gatemaster_session_id', data.sessionId);
        setSessionId(data.sessionId);
      }
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const logout = () => {
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
    localStorage.removeItem('gatemaster_token');
    localStorage.removeItem('gatemaster_refresh_token');
    localStorage.removeItem('gatemaster_session_id');
    setToken(null);
    setRefreshToken(null);
    setSessionId(null);
    setUser(null);
  };

  const updatePassword = async (oldPassword: string, newPassword: string) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Password update failed' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const switchActiveLocation = (newLoc: string) => {
    if (user) {
      setUser({ ...user, location: newLoc });
    }
  };

  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor' || isAdmin;
  const isGuard = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionId,
        loading,
        login,
        logout,
        updatePassword,
        switchActiveLocation,
        isAdmin,
        isSupervisor,
        isGuard
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
