import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, Dumbbell, Sun, UserRound, UtensilsCrossed } from 'lucide-react';
import { loadAll, seedIfEmpty, derive, type AppData, type Derived } from './db/repo';
import { useLive, cx, ToastHost } from './ui/kit';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Diet } from './screens/Diet';
import { Training } from './screens/Training';
import { Progress } from './screens/Progress';
import { Profile } from './screens/Profile';
import { today as todayFn } from './domain/dates';
import { parseSync } from './domain/sync';

export type Tab = 'today' | 'diet' | 'training' | 'progress' | 'profile';
export interface ScreenProps { data: AppData; d: Derived; go: (t: Tab) => void }

/** Główna nawigacja: 4 zakładki. Profil i ustawienia otwiera ikona w górnym rogu. */
const TABS: { id: Tab; label: string; Icon: typeof Sun }[] = [
  { id: 'today', label: 'Dzisiaj', Icon: Sun }, { id: 'diet', label: 'Jedzenie', Icon: UtensilsCrossed },
  { id: 'training', label: 'Trening', Icon: Dumbbell }, { id: 'progress', label: 'Postępy', Icon: Activity },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTabRaw] = useState<Tab>(() => (sessionStorage.getItem('tab') as Tab) || 'today');
  const [back, setBack] = useState<Tab>(() => (sessionStorage.getItem('tabBack') as Tab) || 'today');
  const setTab = (t: Tab) => { if (t === 'profile' && tab !== 'profile') { setBack(tab); sessionStorage.setItem('tabBack', tab); } setTabRaw(t); };
  const [day, setDay] = useState(todayFn());
  useEffect(() => { // dane ze Skrótu iOS w adresie: #sync&steps=...
    const grab = () => {
      const r = parseSync(location.hash);
      if (r) { sessionStorage.setItem('pendingSync', JSON.stringify(r)); history.replaceState(null, '', location.pathname); setTab('today'); window.dispatchEvent(new Event('pendingSync')); }
    };
    grab(); window.addEventListener('hashchange', grab);
    return () => window.removeEventListener('hashchange', grab);
  }, []);
  useEffect(() => { seedIfEmpty().then(() => setReady(true)).catch((e) => setErr(String(e?.message ?? e))); }, []);
  useEffect(() => { sessionStorage.setItem('tab', tab); window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { // zmiana dnia przy otwartej aplikacji
    const t = setInterval(() => setDay(todayFn()), 60000);
    const v = () => setDay(todayFn());
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, []);
  const data = useLive(loadAll, [ready]);
  const d = useMemo(() => (data ? derive(data, day) : undefined), [data, day]);
  useEffect(() => { document.documentElement.classList.toggle('dark', (data?.settings?.theme ?? 'dark') === 'dark'); }, [data?.settings?.theme]);

  if (err) return <div className="p-6">Nie można otworzyć lokalnej bazy danych: {err}. Sprawdź, czy przeglądarka nie jest w trybie prywatnym.</div>;
  if (!ready || !data || !d) return <div className="min-h-dvh grid place-items-center text-muted">Ładowanie…</div>;
  if (!data.settings?.onboarded || !data.profile || (!data.custody && !data.settings?.custodyOff)) return <><Onboarding data={data} /><ToastHost /></>;

  const props: ScreenProps = { data, d, go: setTab };
  return (
    <div className="mx-auto max-w-lg min-h-dvh pb-24 lg:max-w-2xl">
      <div className="safe-t px-2 flex items-center justify-between h-11" aria-label="Pasek górny" data-topbar>
        {tab === 'profile'
          ? <button onClick={() => setTab(back)} className="min-h-11 px-2 flex items-center gap-1 text-accent"><ChevronLeft size={20} /> Wróć</button>
          : <span />}
        {tab !== 'profile' && <button onClick={() => setTab('profile')} aria-label="Profil i ustawienia" className="min-h-11 min-w-11 grid place-items-center rounded-full text-muted active:opacity-70"><UserRound size={24} /></button>}
      </div>
      <main className="px-4 space-y-3">
        {tab === 'today' && <Today {...props} />}
        {tab === 'diet' && <Diet {...props} />}
        {tab === 'training' && <Training {...props} />}
        {tab === 'progress' && <Progress {...props} />}
        {tab === 'profile' && <Profile {...props} />}
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-bg/90 backdrop-blur safe-b" aria-label="Nawigacja">
        <div className="mx-auto max-w-lg lg:max-w-2xl grid grid-cols-4">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={cx('flex flex-col items-center gap-0.5 pt-2 pb-1 min-h-12 text-xs', tab === id ? 'text-accent' : 'text-muted')}>
              <Icon size={22} strokeWidth={tab === id ? 2.4 : 1.8} />{label}
            </button>
          ))}
        </div>
      </nav>
      <ToastHost />
    </div>
  );
}
