import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useRef, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './store/auth';
import { ConfigProvider, useConfig } from './store/config';
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

// 清理过期缓存：推迟到首屏空闲后再做，避免启动时和首屏渲染抢主线程。
//
// 说明（2026-11 核实）：`storage` chunk（Dexie）**不是**这里拖进首屏的，而是
// Home → api/douban|bangumi → apiCache 的静态引用链。所以本处改成动态 import
// 并不能减少首屏字节，只减少启动期的同步工作；要让 Dexie 真正退出首屏需要
// 让 Home 懒加载（对 /login 有意义、对落地页无意义）或用原生 IndexedDB 替掉
// Dexie（改动远超收益）。当前选择：保留 Dexie，只把清理延后。
function scheduleCacheCleanup() {
  const run = () => {
    void import('./store/detailCache')
      .then((m) => m.detailCacheStore.cleanExpired())
      .catch(() => {});
    apiCacheStore.cleanExpired();
  };

  // `requestIdleCallback` is still missing in Safari; fall back to a short
  // timer there so the cleanup is never skipped entirely.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    window.setTimeout(run, 1500);
  }
}

scheduleCacheCleanup();

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
  const { refresh: refreshSiteConfig } = useConfig();
  const configRefreshed = useRef(false);

  // 登录后重新获取完整配置（带 api_site）
  useEffect(() => {
    if (isAuthenticated && !isLoading && !configRefreshed.current) {
      configRefreshed.current = true;
      void refreshSiteConfig();
      refresh();
    }
  }, [isAuthenticated, isLoading, refresh, refreshSiteConfig]);

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
