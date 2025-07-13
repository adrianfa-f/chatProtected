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

      // Forzar actualización del service worker
      registration.update();

      // Verificar si hay una nueva versión cada hora
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    })
    .catch(error => {
      console.error('Error al registrar Service Worker:', error);
    });

  // Limpiar service workers antiguos
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      if (registration.active?.scriptURL !== '/sw.js') {
        registration.unregister();
      }
    });
  });
}