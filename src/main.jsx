import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './i18n' // Initialisation i18next — doit être importé avant App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Enregistrement du service worker — condition d'installabilité PWA
// (préalable à l'emballage TWA pour Google Play). Voir public/sw.js.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
