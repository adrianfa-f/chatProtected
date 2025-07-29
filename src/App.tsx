import { type JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider, useCall } from './contexts/CallContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ChatWindowPage from './pages/ChatWindowPage';
import { useChatSocket } from './hooks/useChatSocket';
import CallScreen from './components/chat/CallScreen';
import ActiveCallScreen from './components/chat/ActiveCallScreen';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />; // Añadir 'replace' evita historial extra

  return children;
};

const AppContent = () => {
  useChatSocket();
  const { user } = useAuth();
  const { status } = useCall();

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

      {user && (status === 'calling' || status === 'ringing') && <CallScreen />}
      {user && status === 'inCall' && <ActiveCallScreen />}

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