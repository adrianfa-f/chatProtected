import { useEffect, type JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ChatWindowPage from './pages/ChatWindowPage';
import { useChatSocket } from './hooks/useChatSocket';
import CallManager from './components/chat/CallManager';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  return children;
};

const AppContent = () => {
  useChatSocket();
  const { user } = useAuth();
  const socket = useSocket();

  useEffect(() => {
    if (!user || !socket) return
    console.log("Visibilidad del documento: ", document.visibilityState)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log("La pagina no es visible, desconetamos del socket")
        socket.disconnect();
      }
    };

    const handleUnload = () => {
      socket.emit('disconnect', user.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user, socket]);



  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:chatId"
          element={
            <ProtectedRoute>
              <ChatWindowPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {user && <CallManager />}

    </BrowserRouter>
  );
};

const App = () => {

  return (
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <CallProvider>
            <AppContent />
          </CallProvider>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;