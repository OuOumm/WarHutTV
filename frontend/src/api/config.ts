import apiClient from './client';
import type { SiteConfig } from '../types';

// The config endpoint returns exactly the SiteConfig shape; keep one definition.
export type ApiSiteConfigResponse = SiteConfig;

export const configApi = {
  getConfig: async (): Promise<ApiSiteConfigResponse> => {
    const response = await apiClient.get<ApiSiteConfigResponse>('/config');
    return response.data;
  },
};
