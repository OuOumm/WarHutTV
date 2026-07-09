import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import { refreshConfig } from './config';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // The session token is an HttpOnly cookie; we infer auth state by asking
      // the backend rather than reading any client-side token.
      const valid = await authApi.verify();
      setIsAuthenticated(valid);
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (password: string) => {
    await authApi.login({ password });
    setIsAuthenticated(true);
    refreshConfig();
  }, [setIsAuthenticated]);

  const logout = useCallback(() => {
    // Fire-and-forget; the backend clears the HttpOnly cookie.
    authApi.logout().catch(() => {});
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);

  // Memoize the context value so consumers (e.g. Layout) don't re-render on
  // every AuthProvider render. Login/logout are stabilized above.
  const value = useMemo(
    () => ({ isAuthenticated, isLoading, login, logout }),
    [isAuthenticated, isLoading, login, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
