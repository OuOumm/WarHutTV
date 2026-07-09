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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
