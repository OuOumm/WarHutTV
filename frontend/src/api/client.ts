import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  // The session token lives in an HttpOnly cookie set by the backend, so it is
  // never readable from JavaScript. The browser sends it automatically for
  // same-origin requests — we no longer attach a Bearer header from JS.
  withCredentials: true,
});

// Kept for API symmetry; returns no headers because auth is cookie-based.
export function getAuthHeaders(): Record<string, string> {
  return {};
}

export function handleAuthFailure(): void {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

apiClient.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeaders());
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/auth/login';

    // 非登录请求的 401 才跳转
    if (error.response?.status === 401 && !isLoginRequest) {
      handleAuthFailure();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
