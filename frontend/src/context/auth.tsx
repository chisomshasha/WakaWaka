// Auth Context with JWT token stored in Expo SecureStore
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export type UserRole = 'CLIENT' | 'RIDER';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  rider?: {
    vehicleType: string;
    licensePlate: string;
    isOnline: boolean;
    currentLat?: number | null;
    currentLng?: number | null;
    rating: number;
    totalDeliveries: number;
    earnings: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<User>;
  register: (data: {
    phone: string;
    password: string;
    name: string;
    role: UserRole;
    vehicleType?: string;
    licensePlate?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiFetch: (path: string, opts?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'ww_auth_token';
const USER_KEY = 'ww_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, isLoading: true });

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string>(TOKEN_KEY, '');
      const userStr = await storage.secureGet<string>(USER_KEY, '');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          setState({ user, token, isLoading: false });
          return;
        } catch {}
      }
      setState({ user: null, token: null, isLoading: false });
    })();
  }, []);

  const apiFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string> | undefined),
      };
      if (state.token) headers.Authorization = `Bearer ${state.token}`;
      const res = await fetch(`${API}${path}`, { ...opts, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err: any = new Error(data?.detail || 'Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },
    [state.token]
  );

  const persist = async (user: User, token: string) => {
    await storage.secureSet(TOKEN_KEY, token);
    await storage.secureSet(USER_KEY, JSON.stringify(user));
    setState({ user, token, isLoading: false });
  };

  const login = async (phone: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Login failed');
    await persist(data.user, data.token);
    return data.user;
  };

  const register: AuthContextType['register'] = async (payload) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Registration failed');
    await persist(data.user, data.token);
    return data.user;
  };

  const logout = async () => {
    await storage.secureRemove(TOKEN_KEY);
    await storage.secureRemove(USER_KEY);
    setState({ user: null, token: null, isLoading: false });
  };

  const refreshUser = async () => {
    if (!state.token) return;
    try {
      const data = await apiFetch('/auth/me');
      if (data?.user) {
        await storage.secureSet(USER_KEY, JSON.stringify(data.user));
        setState((s) => ({ ...s, user: data.user }));
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const API_BASE = API;
