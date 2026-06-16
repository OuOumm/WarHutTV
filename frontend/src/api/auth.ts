import apiClient from './client';
import type { LoginRequest, LoginResponse } from '../types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  verify: async (): Promise<boolean> => {
    try {
      const response = await apiClient.get('/auth/verify');
      return response.data.valid;
    } catch {
      return false;
    }
  },
};
