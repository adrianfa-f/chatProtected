import { useEffect, type JSX } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import { SocketProvider } from './contexts/SocketContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import ChatWindowPage from './pages/ChatWindowPage';
import { cleanupOldChats } from './utils/storageUtils';
import { useChatSocket } from './hooks/useChatSocket';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();

  // Si no hay usuario, redirigir a la página de autenticación
  if (!user) return <Navigate to="/" />;

  return children;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registrado en scope:', reg.scope))
      .catch(err => console.error('Error al registrar SW:', err));
  });
}

const AppContent = () => {
  // Inicializar el hook de WebSocket para el chat
  useChatSocket();

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
        <Route path="/chat/:chatId" element={<ChatWindowPage />} />
        {/* Redirigir cualquier ruta no reconocida a la página principal */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  useEffect(() => {
    // Configurar limpieza periódica cada 24 horas
    cleanupOldChats();
    const interval = setInterval(cleanupOldChats, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;