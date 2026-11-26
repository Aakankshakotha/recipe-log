import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline + "Add to Home Screen" support. Only in production builds, so dev reloads stay fresh.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
}

// In dev, drop any worker/caches left over from a production build on this origin so stale files can't shadow live code.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()))
  void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)))
}

// Ask the browser not to evict our data (recipes live in localStorage and IndexedDB) when storage runs low.
void navigator.storage?.persist?.()
