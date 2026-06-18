import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/auth';
import { ConfigProvider } from './store/config';
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
import { useAnnouncement } from './hooks/useAnnouncement';

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
  const { config, isVisible, dismiss } = useAnnouncement(isAuthenticated);

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
      <ConfigProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
