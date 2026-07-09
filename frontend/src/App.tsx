import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useRef, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './store/auth';
import { ConfigProvider, refreshConfig } from './store/config';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import { getCurrentTheme, applyTheme } from './store/theme';
import { ToastProvider } from './components/ToastProvider';
import { detailCacheStore } from './store/detailCache';
import { apiCacheStore } from './store/apiCache';
import Announcement from './components/Announcement';
import ScrollToTop from './components/ScrollToTop';
import PageSkeleton from './components/PageSkeleton';
import { useAnnouncement } from './hooks/useAnnouncement';
import { useDocumentTitle, useDynamicManifest } from './hooks/useDocumentTitle';

// Route-level code splitting — only the landing page (Home) and Login ship in
// the initial bundle; the rest are fetched on demand so first-load JS drops
// substantially (search/play/speed-test/douban/favorites/history).
const Search = lazy(() => import('./pages/Search'));
const Play = lazy(() => import('./pages/Play'));
const Douban = lazy(() => import('./pages/Douban'));
const SpeedTest = lazy(() => import('./pages/SpeedTest'));
const Favorites = lazy(() => import('./pages/Favorites'));
const History = lazy(() => import('./pages/History'));

// Force dark mode & apply saved theme
document.documentElement.classList.add('dark');
applyTheme(getCurrentTheme());

// 清理过期缓存
detailCacheStore.cleanExpired().catch(() => {});
apiCacheStore.cleanExpired().catch(() => {});

interface PrivateRouteProps {
  isAuthenticated: boolean;
  isLoading: boolean;
  children: React.ReactNode;
}

const PrivateRoute = ({ isAuthenticated, isLoading, children }: PrivateRouteProps) => {
  if (isLoading) {
    // Show the skeleton instead of a bare "loading" flash — the app shell
    // and cached content paint immediately once auth resolves.
    return <PageSkeleton />;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { config, isVisible, dismiss, refresh } = useAnnouncement(isAuthenticated);
  const configRefreshed = useRef(false);

  // 登录后重新获取完整配置（带 api_site）
  useEffect(() => {
    if (isAuthenticated && !isLoading && !configRefreshed.current) {
      configRefreshed.current = true;
      refreshConfig();
      refresh();
    }
  }, [isAuthenticated, isLoading, refresh]);

  // 动态更新文档标题和 manifest
  useDocumentTitle();
  useDynamicManifest();

  return (
    <ToastProvider>
      {/* 公告弹窗 */}
      {isVisible && config && (
        <Announcement
          content={config.announcement}
          siteName={config.site_name}
          onDismiss={dismiss}
        />
      )}

      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Home /></Layout></PrivateRoute>} />
          <Route path="/search" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Search /></Layout></PrivateRoute>} />
          <Route path="/play/:site/:id" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Play /></Layout></PrivateRoute>} />
                <Route path="/favorites" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Favorites /></Layout></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><History /></Layout></PrivateRoute>} />
          <Route path="/speed" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><SpeedTest /></Layout></PrivateRoute>} />
          <Route path="/douban" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Douban /></Layout></PrivateRoute>} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ConfigProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
