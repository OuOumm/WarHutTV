import { createContext, useContext, useState, useEffect } from 'react';
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
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      const valid = await authApi.verify();
      setIsAuthenticated(valid);
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (password: string) => {
    const response = await authApi.login({ password });
    localStorage.setItem('token', response.token);
    localStorage.setItem('expiresAt', response.expiresAt.toString());
    setIsAuthenticated(true);
    refreshConfig();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('expiresAt');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
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
