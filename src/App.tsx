import { type JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import { SocketProvider } from './contexts/SocketContext';
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