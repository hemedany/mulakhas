import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The service worker receives Share-ins from other apps (Android). Skipped in dev so it
// never caches the hot-reloading dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // The page opened from the cache is the version before. When the new one's worker takes over
  // (it does as soon as it is installed), reload once, so an update shows now and not next time.
  const updating = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload() })
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
}
