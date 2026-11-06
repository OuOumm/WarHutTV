import apiClient from './client';

export interface ApiSiteEntry {
  api: string;
  name: string;
  detail?: string;
}

export interface ApiSiteConfigResponse {
  site_name: string;
  announcement: string;
  api_site?: Record<string, ApiSiteEntry>;
}

export const configApi = {
  getConfig: async (): Promise<ApiSiteConfigResponse> => {
    const response = await apiClient.get<ApiSiteConfigResponse>('/config');
    return response.data;
  },
};
