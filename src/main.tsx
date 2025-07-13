import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <App />
)

// Registro simplificado del service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('Service Worker registrado con éxito:', registration.scope);
    })
    .catch(error => {
      console.error('Error al registrar Service Worker:', error);
    });
}