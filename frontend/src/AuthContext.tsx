import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { api } from './api';

// Platform-specific storage
let storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

if (Platform.OS === 'web') {
  storage = {
    getItem: async (key) => localStorage.getItem(key),
    setItem: async (key, value) => localStorage.setItem(key, value),
    removeItem: async (key) => localStorage.removeItem(key),
  };
} else {
  const SecureStore = require('expo-secure-store');
  storage = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestOtp: (email: string, name: string, password: string) => Promise<string>;
  verifyOtp: (email: string, otp: string, name: string, password: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(async () => {
    setToken(null);
    setUser(null);
    api.setToken(null);
    try { await storage.removeItem('auth_token'); } catch {}
  }, []);

  useEffect(() => {
    api.setOnUnauthorized(clearAuth);
  }, [clearAuth]);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const stored = await storage.getItem('auth_token');
      if (stored) {
        api.setToken(stored);
        const me = await api.get('/auth/me');
        setToken(stored);
        setUser(me);
      }
    } catch (e) {
      console.log('Token load failed:', e);
      try { await storage.removeItem('auth_token'); } catch {}
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    console.log('Login success, saving token...');
    await storage.setItem('auth_token', res.access_token);
    api.setToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    console.log('Auth state updated');
  };

  const requestOtp = async (email: string, name: string, password: string) => {
    const res = await api.post('/auth/request-otp', { email, name, password });
    return res.message;
  };

  const verifyOtp = async (email: string, otp: string, name: string, password: string) => {
    const res = await api.post('/auth/verify-otp', { email, otp, name, password });
    await storage.setItem('auth_token', res.access_token);
    api.setToken(res.access_token);
    setToken(res.access_token);
    setUser(res.user);
  };

  const resendOtp = async (email: string) => {
    await api.post('/auth/resend-otp', { email });
  };

  const forgotPassword = async (email: string) => {
    await api.post('/auth/forgot-password', { email });
  };

  const logout = async () => {
    await clearAuth();
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, requestOtp, verifyOtp, resendOtp, forgotPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
