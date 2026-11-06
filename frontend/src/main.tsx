import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Pause always-on background animations when the tab is hidden (perf).
// The <html class="anim-paused"> rule in index.css freezes body::before/
// body::after/.orb animations while the page is in the background.
document.addEventListener('visibilitychange', () => {
  document.documentElement.classList.toggle('anim-paused', document.hidden)
})

// Register the service worker only in production builds. In dev the SW served
// by Vite is a stale copy of public/sw.js and its network-first handler caches
// HTML for hashed asset URLs, which is a classic source of "why is my change
// not showing up" during development.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('[sw] registration failed', error))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
