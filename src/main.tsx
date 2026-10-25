import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles/global.css';

registerSW({ immediate: true });

// Purge the caches left by the previous version of this site (its own service
// worker used the prefix « kine-shell: »); the new worker replaces it.
if ('caches' in window) {
  caches
    .keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('kine-shell:')).map((key) => caches.delete(key))))
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
