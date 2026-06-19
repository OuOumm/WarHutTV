import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './store/auth';
import { ConfigProvider, refreshConfig } from './store/config';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import Search from './pages/Search';
import Play from './pages/Play';
import Live from './pages/Live';
import Favorites from './pages/Favorites';
import History from './pages/History';
import SpeedTest from './pages/SpeedTest';
import Douban from './pages/Douban';
import { getCurrentTheme, applyTheme } from './store/theme';
import { detailCacheStore } from './store/detailCache';
import { apiCacheStore } from './store/apiCache';
import Announcement from './components/Announcement';
import ScrollToTop from './components/ScrollToTop';
import { useAnnouncement } from './hooks/useAnnouncement';
import { useDocumentTitle, useDynamicManifest } from './hooks/useDocumentTitle';

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
    return <div className="min-h-screen flex items-center justify-center bg-deep"><div className="text-text">加载中...</div></div>;
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
    <>
      {/* 公告弹窗 */}
      {isVisible && config && (
        <Announcement
          content={config.announcement}
          siteName={config.site_name}
          onDismiss={dismiss}
        />
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Home /></Layout></PrivateRoute>} />
        <Route path="/search" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Search /></Layout></PrivateRoute>} />
        <Route path="/play/:site/:id" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Play /></Layout></PrivateRoute>} />
        <Route path="/live" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Live /></Layout></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Favorites /></Layout></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><History /></Layout></PrivateRoute>} />
        <Route path="/speed" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><SpeedTest /></Layout></PrivateRoute>} />
        <Route path="/douban" element={<PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading}><Layout><Douban /></Layout></PrivateRoute>} />
      </Routes>
    </>
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
