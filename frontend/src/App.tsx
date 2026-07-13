import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useRef, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './store/auth';
import { ConfigProvider, refreshConfig } from './store/config';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import { getCurrentTheme, applyTheme } from './store/theme';
import { apiCacheStore } from './store/apiCache';
import { ToastProvider } from './components/ToastProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Announcement from './components/Announcement';
import ScrollToTop from './components/ScrollToTop';
import PageSkeleton from './components/PageSkeleton';
import { useAnnouncement } from './hooks/useAnnouncement';
import { useDocumentTitle, useDynamicManifest } from './hooks/useDocumentTitle';

// Route-level code splitting — only the landing page (Home) and Login ship in
// the initial bundle; the rest are fetched on demand so first-load JS drops
// substantially (search/play/speed-test/douban). The "继续观看" + "收藏"
// personal sections live inline on Home (toggled via HomeTabContext), so no
// dedicated routes are needed.
const Search = lazy(() => import('./pages/Search'));
const Play = lazy(() => import('./pages/Play'));
const Douban = lazy(() => import('./pages/Douban'));
const SpeedTest = lazy(() => import('./pages/SpeedTest'));

// Force dark mode & apply saved theme
document.documentElement.classList.add('dark');
applyTheme(getCurrentTheme());

// 清理过期缓存（模块级执行，无需 React effect）：
// - detailCache 仅被懒加载的 Play 路由静态引用，动态 import 可独立成 chunk，
//   在应用启动时异步拉取并执行，压低首屏 JS 体积；
// - apiCache 已被首页(Home/Douban)经 bangumi 静态引用、随首屏加载，无法拆出
//   独立 chunk（此前动态 import 被 Rollup 判定为 INEFFECTIVE_DYNAMIC_IMPORT），
//   故改为静态调用，行为不变、告警消除。
void import('./store/detailCache')
  .then((m) => m.detailCacheStore.cleanExpired())
  .catch(() => {});
apiCacheStore.cleanExpired();

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

      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Home /></Layout></PrivateRoute>} />
            <Route path="/search" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Search /></Layout></PrivateRoute>} />
            <Route path="/play/:site/:id" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Play /></Layout></PrivateRoute>} />
            <Route path="/speed" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><SpeedTest /></Layout></PrivateRoute>} />
            <Route path="/douban" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Douban /></Layout></PrivateRoute>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
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
