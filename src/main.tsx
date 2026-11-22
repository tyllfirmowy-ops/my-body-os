import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai') && import.meta.env.PROD && import.meta.env.MODE !== 'single') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
