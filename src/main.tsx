import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { classifyStorageError, logStorageError } from './domain/storageDiag';
import { toast } from './ui/kit';

// Rejestr błędów zapisu bazy (tylko nazwa błędu i czas, bez danych) do diagnostyki w Profilu.
function onStorageError(e: unknown) {
  const c = classifyStorageError(e);
  if (!c) return;
  try { logStorageError(localStorage, c, Date.now()); } catch { /* brak localStorage */ }
  toast(c.quota ? 'Brak miejsca: zmiana mogła się nie zapisać. Zrób kopię i zwolnij miejsce.' : 'Błąd zapisu danych. Szczegóły: Zdrowie → Pamięć urządzenia.');
}
window.addEventListener('unhandledrejection', (ev) => onStorageError(ev.reason));
window.addEventListener('error', (ev) => onStorageError(ev.error));

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.endsWith('claude.ai') && import.meta.env.PROD && import.meta.env.MODE !== 'single') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
