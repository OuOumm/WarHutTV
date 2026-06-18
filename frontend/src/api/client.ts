import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/auth/login';
    
    // 非登录请求的 401 才跳转
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('expiresAt');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
