import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isNative } from '@/lib/native';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Production only: in dev the cache would just serve stale modules.
// Not in the iPhone app: its files ship inside it, and iOS web views there
// don't run service workers.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isNative()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline launch and notifications just won't be available.
    });
  });
}
