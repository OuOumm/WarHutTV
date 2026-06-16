import { useState, useEffect } from 'react';
import { authApi } from '../api/auth';

export const useAuth = () => {
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
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('expiresAt');
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, login, logout };
};
