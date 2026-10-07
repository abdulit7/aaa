import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure any previously registered service workers and offline IndexedDB caches are cleanly removed
if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('indexedDB' in window) {
    try {
      window.indexedDB.deleteDatabase('GateMasterOfflineDB');
    } catch (_) {}
  }
}

createRoot(document.getElementById('root')!).render(<App />);
