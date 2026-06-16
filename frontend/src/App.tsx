import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
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

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="text-white">加载中...</div></div>;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
        <Route path="/search" element={<PrivateRoute><Layout><Search /></Layout></PrivateRoute>} />
        <Route path="/play/:site/:id" element={<PrivateRoute><Layout><Play /></Layout></PrivateRoute>} />
        <Route path="/live" element={<PrivateRoute><Layout><Live /></Layout></PrivateRoute>} />
        <Route path="/favorites" element={<PrivateRoute><Layout><Favorites /></Layout></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><Layout><History /></Layout></PrivateRoute>} />
        <Route path="/speed" element={<PrivateRoute><Layout><SpeedTest /></Layout></PrivateRoute>} />
        <Route path="/douban" element={<PrivateRoute><Layout><Douban /></Layout></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
