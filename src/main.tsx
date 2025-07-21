import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Render de React
createRoot(document.getElementById('root')!).render(<App />)

// Registro automático del SW generado por VitePWA
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
})
