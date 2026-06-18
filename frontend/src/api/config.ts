import apiClient from './client';
import type { SiteConfig } from '../types';

export const configApi = {
  getConfig: async (): Promise<SiteConfig> => {
    const response = await apiClient.get('/config');
    return response.data;
  },
};
