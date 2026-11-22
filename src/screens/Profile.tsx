import { useEffect, useState } from 'react';
import { Download, Upload, Trash2, Moon, Sun } from 'lucide-react';
import type { ScreenProps } from '../App';
import { db, now, uid } from '../db/db';
import { classifyStorageError, clearStorageErrors, diagnose, logStorageError, readStorageErrors, type StorageInfo } from '../domain/storageDiag';
import { exportAll, importAll, encryptBackup, isEncrypted, decryptBackup, wipeAll, inspectBackup, verifyBackupText, storageStatus, requestPersist, type Inspect, type Verify } from '../db/backup';
import { range, formatPl, diffDays } from '../domain/dates';
import { withDaughter } from '../domain/schedule';
import { bmrMifflin, ageOn, tdeeRange, macroKcal } from '../domain/calc';
import { EnergySheet, HealthSyncHelp, PlanEditorSheet, PlanSettingsSheet } from './Energy';
import { Badge, Btn, Card, copyText, cx, download, Field, inputCls, NumInput, Sheet, Title, toast, Toggle } from '../ui/kit';

const DOCTOR_TOPICS = ['Morfologia', 'Glukoza na czczo', 'HbA1c', 'Lipidogram', 'TSH', 'ALT i AST', 'Kreatynina z eGFR', 'Ferrytyna', 'Witamina B12', 'Elektrolity', 'Ciśnienie tętnicze',
  'Przewlekłe zmęczenie i jakość snu', 'Czy potrzebna diagnostyka zaburzeń oddychania w czasie snu', 'Nawracające objawy po nabiale', 'Ocena kolana: fizjoterapeuta lub ortopeda'];

export function Profile({ data, d }: ScreenProps) {
  const [sheet, setSheet] = useState<'custody' | 'lab' | 'symptom' | 'wipe' | 'profile' | 'supp' | 'energy' | 'sync' | 'plan' | 'edit' | null>(null);
  const [pass, setPass] = useState('');
  const [pending, setPending] = useState<unknown>(null);
  const [paste, setPaste] = useState('');
  const p = data.profile!;
  const confirmed = data.settings?.lastBackupConfirmedAt;
  const lastExport = data.settings?.lastExport ?? (data.settings?.lastBackupAt ? { at: data.settings.lastBackupAt, total: 0, bytes: 0, verified: false, encrypted: false } : undefined);
  const backupDue = !confirmed || (now() - confirmed) / 864e5 > (data.settings?.backupReminderDays ?? 7);
  const bmr = d.bmr;
  const [prepared, setPrepared] = useState<{ name: string; text: string; v: Verify; saved?: 'shared' | 'downloaded' | 'copied' } | null>(null);
  const [preview, setPreview] = useState<Inspect | null>(null);
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number; quota?: number }>({});
  const [writeTest, setWriteTest] = useState<StorageInfo['writeTest']>();
  const [errLog, setErrLog] = useState(() => readStorageErrors(localStorage));
  useEffect(() => { storageStatus().then(setStorage); }, []);
  useEffect(() => {
    if (sessionStorage.getItem('scrollTo') === 'backup') { sessionStorage.removeItem('scrollTo'); setTimeout(() => document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth' }), 100); }
  }, []);
  const standalone = typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const diag = diagnose({ supported: typeof indexedDB !== 'undefined', ...storage, standalone, errors: errLog, writeTest }, now());
  async function runWriteTest() {
    const t0 = performance.now();
    try {
      await db.transaction('rw', db.settings, async () => { const s = await db.settings.get('settings'); if (s) await db.settings.put(s); });
      setWriteTest({ ok: true, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      const c = classifyStorageError(e);
      if (c) { logStorageError(localStorage, c, now()); setErrLog(readStorageErrors(localStorage)); }
      setWriteTest({ ok: false, error: c?.name ?? (e as Error)?.name ?? 'błąd' });
    }
  }
  async function askPersist() {
    const r = await requestPersist(); setStorage(await storageStatus());
    toast(r === true ? 'Pamięć oznaczona jako trwała' : r === false ? 'Przeglądarka odmówiła (na iOS zwykle pomaga dodanie do ekranu głównego)' : 'Przeglądarka nie obsługuje tej funkcji');
  }

  async function prepareExport() {
    setBusy(true);
    try {
      void requestPersist().then(() => storageStatus().then(setStorage));
      const all = await exportAll();
      const text = JSON.stringify(pass ? await encryptBackup(all, pass) : all);
      const v = await verifyBackupText(text, pass);
      const name = `my-body-os-kopia-${d.today}${pass ? '-zaszyfrowana' : ''}.json`;
      setPrepared({ name, text, v });
      await db.settings.update('settings', { lastExport: { at: now(), total: v.ok ? v.total : 0, bytes: new Blob([text]).size, verified: v.ok, encrypted: !!pass } });
    } finally { setBusy(false); }
  }
  async function saveFile() {
    if (!prepared) return;
    const file = new File([prepared.text], prepared.name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: prepared.name }); setPrepared({ ...prepared, saved: 'shared' }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return toast('Anulowano. Plik nie został zapisany.'); }
    }
    download(prepared.name, prepared.text);
    setPrepared({ ...prepared, saved: 'downloaded' });
  }
  async function confirmSaved() {
    await db.settings.update('settings', { lastBackupConfirmedAt: now() });
    setPrepared(null); toast('Zapisano potwierdzenie kopii');
  }
  async function prepareImport(text: string) {
    try {
      let json: unknown = JSON.parse(text);
      if (isEncrypted(json)) { if (!pass) return toast('Wpisz hasło kopii w polu powyżej'); json = await decryptBackup(json, pass); }
      const info = await inspectBackup(json);
      setPreview(info);
      setPending(info.ok ? json : null);
    } catch { toast('Nie udało się odczytać kopii (złe hasło lub uszkodzony plik)'); }
  }
  async function confirmImport() {
    const r = await importAll(pending); setPending(null); setPreview(null); setPaste('');
    toast(r.ok ? `Dane odtworzone${r.untouched.length ? ` (bez zmian: ${r.untouched.join(', ')})` : ''}` : r.error);
  }
  async function copyBackup() {
    if (!prepared) return;
    await copyText(prepared.text);
    setPrepared({ ...prepared, saved: 'copied' });
  }
  const mb = (b?: number) => (b === undefined ? '?' : b < 1e6 ? `${Math.round(b / 1e3)} kB` : `${(b / 1e6).toFixed(1)} MB`);

  return (
    <>
      <header className="pt-2 flex items-end justify-between">
        <h1 className="text-2xl font-bold">Profil i zdrowie</h1>
        <button aria-label="Motyw" className="p-2" onClick={() => db.settings.update('settings', { theme: data.settings?.theme === 'dark' ? 'light' : 'dark' })}>{data.settings?.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>

      {backupDue && <Card className="border-warn"><div className="font-semibold text-warn">Zrób kopię zapasową</div><p className="text-sm text-muted">Dane są tylko w tej przeglądarce i mogą zostać usunięte (np. przy czyszczeniu Safari).</p></Card>}

      <Card onClick={() => setSheet('profile')}>
        <Title>Profil</Title>
        <div className="text-sm">{p.name} · {ageOn(p, d.today)} lat · {p.heightCm} cm · cele: {p.goals.map((g) => `${g.kg} kg`).join(' → ') || '—'}</div>
        {bmr && <div className="text-xs text-muted mt-1">BMR (Mifflin-St Jeor): {Math.round(bmr)} kcal · TDEE szacunkowo {tdeeRange(bmr).join('–')} kcal (hipoteza, nie pomiar)</div>}
      </Card>

      <Card onClick={() => setSheet('energy')}>
        <Title>Zapotrzebowanie kaloryczne</Title>
        <p className="text-sm">{p.activity ? 'Wywiad o ruchu zapisany. Dotknij, by przeliczyć.' : 'Odpowiedz na 6 pytań o ruch, a policzę TDEE i plan.'}</p>
      </Card>
      <Card onClick={() => setSheet('sync')}>
        <Title>Apple Zdrowie i zegarek</Title>
        <p className="text-sm">Kroki, sen, waga, tętno spoczynkowe przez Skrót iOS + codzienne przypomnienie o 21:00.</p>
      </Card>

      <Card onClick={() => setSheet('plan')}>
        <Title>Ustawienia planu</Title>
        <p className="text-sm">Dni treningowe vs bez treningu, insulinooporność, bez nabiału, liczba treningów.</p>
      </Card>

      <Card>
        <Title right={<button className="text-xs text-accent" onClick={() => setSheet('edit')}>edytuj kcal i makro</button>}>Plan (wersje)</Title>
        {[...data.plans].reverse().map((pl, i) => (
          <div key={pl.id} className={cx('py-2 border-b border-line last:border-0 text-sm', i > 0 && 'text-muted')}>
            <div className="flex justify-between"><span>od {formatPl(pl.validFrom)} {i === 0 && <Badge tone="accent">aktualny</Badge>}</span><span className="num">{pl.kcal} kcal</span></div>
            <div className="text-xs text-muted">B {pl.proteinG} · T {pl.fatG} · W {pl.carbsG} g ({macroKcal(pl.proteinG, pl.fatG, pl.carbsG)} kcal) · {pl.reason}</div>
          </div>
        ))}
      </Card>

      <Card onClick={() => setSheet('custody')}>
        <Title>Kalendarz opieki 2-2-3</Title>
        <div className="grid grid-cols-7 gap-1">
          {range(d.today, 14).map((dt) => <div key={dt} className={cx('rounded-md py-1 text-center text-[11px]', withDaughter(d.custody!, dt) ? 'bg-accent text-accent-ink' : 'bg-card2')}>{Number(dt.slice(8))}</div>)}
        </div>
        <p className="text-xs text-muted mt-2">Dotknij, aby zmienić pojedyncze dni lub fazę.</p>
      </Card>

      <Card>
        <Title>Zdrowie</Title>
        {data.health?.conditions.map((c) => <div key={c} className="text-sm">• {c}</div>)}
        {data.health?.kneeNote && <div className="text-sm">• Kolano: {data.health.kneeNote}</div>}
        <div className="mt-2"><Toggle on={!!data.health?.kneeCleared} onChange={(v) => db.health.update('me', { kneeCleared: v, updatedAt: now() })} label="Kolano ocenione przez specjalistę, zgoda na cięższe ćwiczenia nóg" /></div>
        <Toggle on={!!data.health?.dairyAvoid} onChange={(v) => db.health.update('me', { dairyAvoid: v, updatedAt: now() })} label="Unikam nabiału (objawy, bez diagnozy)" />
        <p className="text-xs text-muted mt-2">Aplikacja nie diagnozuje i nie zastępuje lekarza. Przewlekła senność i zmęczenie to temat do omówienia z lekarzem niezależnie od redukcji. Nie lecz ich energetykami ani przedtreningówkami.</p>
      </Card>

      <Card>
        <Title>Tematy do omówienia z lekarzem</Title>
        <ul className="text-sm space-y-1">{DOCTOR_TOPICS.map((t) => <li key={t}>☐ {t}</li>)}</ul>
        <p className="text-xs text-muted mt-2">Lista tematów, nie skierowanie. Zakres badań ustala lekarz.</p>
      </Card>

      <Card>
        <Title right={<button className="text-xs text-accent" onClick={() => setSheet('lab')}>+ dodaj</button>}>Wyniki badań</Title>
        {data.labs.length ? [...data.labs].sort((a, b) => b.date.localeCompare(a.date)).map((l) => (
          <div key={l.id} className="py-1.5 text-sm border-b border-line last:border-0"><span className="text-muted">{l.date}</span> {l.name}: <b>{l.value} {l.unit}</b> {l.refRange && <span className="text-muted">(norma lab.: {l.refRange})</span>}{l.doctorNote && <div className="text-xs text-muted">{l.doctorNote}</div>}</div>
        )) : <p className="text-sm text-muted">Brak wyników.</p>}
      </Card>

      <Card>
        <Title right={<button className="text-xs text-accent" onClick={() => setSheet('symptom')}>+ dodaj</button>}>Dziennik trawienny</Title>
        {data.symptoms.length ? [...data.symptoms].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((s) => (
          <div key={s.id} className="py-1.5 text-sm border-b border-line last:border-0"><span className="text-muted">{s.date} {s.time}</span> {s.products} · {[s.abdominalPain && `ból ${s.abdominalPain}/10`, s.diarrhea && 'biegunka', s.bloating && 'wzdęcia', s.onsetMinutes && `po ${s.onsetMinutes} min`].filter(Boolean).join(', ')}</div>
        )) : <p className="text-sm text-muted">Brak wpisów.</p>}
        <SymptomPatterns symptoms={data.symptoms} />
      </Card>

      <Card onClick={() => setSheet('supp')}>
        <Title>Suplementy</Title>
        <p className="text-sm">Obecnie: brak. Moduł edukacyjny, bez obowiązkowego pakietu.</p>
      </Card>

      <Card>
        <Title>Sen: kierunek</Title>
        <p className="text-sm">Pobudka 07:30 · śniadanie 08:00 · ostatnia kawa ~14:00 · wyciszenie 22:30 · sen ~23:30. Przesuwaj o 15–30 min co kilka dni. Cel 7–9 h.</p>
      </Card>

      <Card>
        <Title>Przypomnienia</Title>
        <p className="text-sm text-muted">W tej wersji przypomnienia pokazują się po otwarciu aplikacji (check-in, kopia, pomiar). Powiadomienia push na iPhonie wymagają instalacji na ekranie głównym i serwera wysyłającego: to etap 4.</p>
      </Card>

      <Card>
        <Title>Pamięć urządzenia</Title>
        <div className="text-xs text-muted space-y-0.5 num">
          <div>persisted(): {storage.persisted === undefined ? 'brak odpowiedzi' : storage.persisted ? 'tak (trwała)' : 'nie'} · tryb: {standalone ? 'aplikacja z ekranu głównego' : 'przeglądarka'}</div>
          <div>Zajęte: {storage.usage !== undefined ? mb(storage.usage) : 'brak danych'}{storage.quota ? ` z limitu ${mb(storage.quota)} (${Math.round((100 * (storage.usage ?? 0)) / storage.quota)}%)` : ''}</div>
          <div>Błędy zapisu: {errLog.length ? `${errLog.length}, ostatni ${new Date(errLog[0].t).toLocaleString('pl-PL')} (${errLog[0].name})` : 'brak'}</div>
        </div>
        <div className="mt-2 space-y-1">{diag.items.map((i) => <p key={i.text} className={cx('text-xs', i.level === 'danger' ? 'text-danger' : i.level === 'warn' ? 'text-warn' : i.level === 'ok' ? 'text-accent' : 'text-muted')}>{i.text}</p>)}</div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Btn kind="soft" className="text-sm" onClick={runWriteTest}>Test zapisu</Btn>
          <Btn kind="soft" className="text-sm" onClick={askPersist} disabled={storage.persisted === true}>Poproś o trwałą pamięć</Btn>
        </div>
        {errLog.length > 0 && <Btn kind="ghost" className="w-full mt-1 text-xs" onClick={() => { clearStorageErrors(localStorage); setErrLog([]); }}>Wyczyść rejestr błędów</Btn>}
      </Card>

      <Card id="backup">
        <Title>Kopia zapasowa</Title>
        <div className="text-xs text-muted mb-2 space-y-0.5">
          <div>Potwierdzona kopia: {confirmed ? new Date(confirmed).toLocaleString('pl-PL') : 'brak'}</div>
          <div>Ostatnio wygenerowany plik: {lastExport ? `${new Date(lastExport.at).toLocaleString('pl-PL')}${lastExport.total ? ` · ${lastExport.total} rekordów · ${mb(lastExport.bytes)}` : ''} · ${lastExport.verified ? 'zweryfikowany' : 'bez weryfikacji'}` : 'nigdy'}</div>
        </div>
        <Field label="Hasło kopii (opcjonalne, zapamiętaj je)"><input type="password" className={inputCls} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></Field>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Btn onClick={prepareExport} disabled={busy}><Download size={16} className="inline -mt-0.5" /> {busy ? 'Sprawdzam…' : 'Przygotuj kopię'}</Btn>
          <label className="min-h-12 rounded-xl bg-card2 grid place-items-center cursor-pointer"><span><Upload size={16} className="inline -mt-0.5" /> Import</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await prepareImport(await f.text()); e.target.value = ''; }} /></label>
        </div>
        {prepared && <div className={cx('mt-3 rounded-xl border p-3 text-sm', prepared.v.ok ? 'border-accent' : 'border-danger')}>
          {prepared.v.ok
            ? <div><b>1. Plik gotowy i sprawdzony</b><div className="text-xs text-muted">{prepared.v.total} rekordów · {mb(prepared.v.bytes)} · suma kontrolna i liczby rekordów zgodne z bazą{pass ? ' · odszyfrowanie hasłem działa' : ''}</div></div>
            : <div className="text-danger"><b>Weryfikacja nieudana:</b> {prepared.v.error}</div>}
          {prepared.v.ok && <>
            <Btn className="w-full mt-2" onClick={saveFile}>2. Zapisz w Plikach / iCloud</Btn>
            <p className="text-xs text-muted mt-1">W arkuszu wybierz „Zapisz w Plikach”, potem iCloud Drive (np. folder My Body OS) i „Zapisz”. Aplikacja nie widzi, czy zapis się udał.</p>
            <Btn kind="soft" className="w-full mt-2" onClick={copyBackup}>albo skopiuj tekst kopii do schowka</Btn>
            {prepared.saved && <Btn kind="soft" className="w-full mt-2" onClick={confirmSaved}>3. Potwierdzam: plik jest zapisany</Btn>}
          </>}
        </div>}
        <textarea className={inputCls + ' mt-2 min-h-20 py-2 text-xs'} placeholder="…albo wklej tu tekst kopii do importu" value={paste} onChange={(e) => setPaste(e.target.value)} />
        {paste && <Btn kind="soft" className="w-full mt-2" onClick={() => prepareImport(paste)}>Sprawdź wklejoną kopię</Btn>}
        {preview && !preview.ok && <div className="mt-3 rounded-xl border border-danger p-3 text-sm text-danger">{preview.error} Obecne dane bez zmian.</div>}
        {preview?.ok && pending !== null && <div className="mt-3 rounded-xl border border-warn p-3 text-sm">
          <div>Kopia z {new Date(preview.exportedAt).toLocaleString('pl-PL')}{preview.app ? ` (wersja ${preview.app})` : ''}: {preview.total} rekordów.</div>
          <div className="text-xs text-muted">Integralność: {preview.integrity === 'verified' ? 'suma kontrolna zgodna' : 'starsza kopia bez sumy kontrolnej (sprawdzono format i rekordy)'}{preview.missing.length ? ` · brak tabel w kopii (zostaną bez zmian): ${preview.missing.join(', ')}` : ''}</div>
          <div className="mt-1">Import zastąpi obecne dane tabelami z kopii. Przy błędzie nic nie zostanie zmienione.</div>
          <div className="flex gap-2 mt-2"><Btn kind="danger" className="flex-1" onClick={confirmImport}>Zastąp dane</Btn><Btn kind="ghost" onClick={() => { setPending(null); setPreview(null); }}>Anuluj</Btn></div></div>}
        <Btn kind="ghost" className="w-full mt-2 text-danger" onClick={() => setSheet('wipe')}><Trash2 size={16} className="inline -mt-0.5" /> Usuń wszystkie dane</Btn>
      </Card>
      <p className="text-center text-xs text-muted pb-2">My Body OS 0.7.0 · dane lokalne · bez reklam i śledzenia · nie jest wyrobem medycznym</p>

      {sheet === 'energy' && <EnergySheet data={data} d={d} onClose={() => setSheet(null)} />}
      {sheet === 'sync' && <HealthSyncHelp onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <PlanEditorSheet data={data} d={d} onClose={() => setSheet(null)} />}
      {sheet === 'plan' && <PlanSettingsSheet plan={d.plan!} today={d.today} onClose={() => setSheet(null)} />}
      {sheet === 'custody' && <CustodySheet d={d} onClose={() => setSheet(null)} />}
      {sheet === 'lab' && <LabSheet today={d.today} onClose={() => setSheet(null)} />}
      {sheet === 'symptom' && <SymptomSheet today={d.today} onClose={() => setSheet(null)} />}
      {sheet === 'profile' && <ProfileSheet data={data} onClose={() => setSheet(null)} />}
      <Sheet open={sheet === 'supp'} onClose={() => setSheet(null)} title="Suplementy: informacje">
        <ul className="text-sm space-y-2">
          <li><b>Kreatyna monohydrat</b>: dobrze przebadana przy treningu siłowym, typowo 3–5 g dziennie. W Twoim profilu: dopiero po ocenie zdrowia (badania, nerki).</li>
          <li><b>Witamina D</b>: dawkę ustal z lekarzem, najlepiej po badaniu.</li>
          <li><b>Białko roślinne</b>: opcjonalnie, gdy trudno dobić białko jedzeniem.</li>
          <li><b>Omega-3</b>: do rozważenia, gdy tłuste ryby jesz rzadko.</li>
          <li><b>Magnez</b>: nie wdrażaj automatycznie; część form nasila biegunkę.</li>
        </ul>
        <p className="text-xs text-muted">Bez spalaczy tłuszczu i zbędnych przedtreningówek.</p>
      </Sheet>
      <WipeSheet open={sheet === 'wipe'} onClose={() => setSheet(null)} />
    </>
  );
}

function SymptomPatterns({ symptoms }: { symptoms: ScreenProps['data']['symptoms'] }) {
  const counts = new Map<string, number>();
  symptoms.filter((s) => (s.severity ?? s.abdominalPain ?? 0) >= 2 || s.diarrhea).forEach((s) => s.products.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).forEach((p) => counts.set(p, (counts.get(p) ?? 0) + 1)));
  const top = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return symptoms.length ? <p className="text-xs text-muted mt-2">Za mało powtórzeń, by wskazać zależność.</p> : null;
  return <p className="text-xs text-muted mt-2">Powtarza się przy objawach: {top.map(([p, n]) => `${p} (${n}×)`).join(', ')}. To obserwacja, nie diagnoza. Omów ją z lekarzem.</p>;
}

function CustodySheet({ d, onClose }: { d: ScreenProps['d']; onClose: () => void }) {
  const days = range(d.today, 28);
  async function toggle(dt: string) {
    const cur = withDaughter(d.custody!, dt);
    await db.overrides.put({ date: dt, withDaughter: !cur, updatedAt: now() });
  }
  async function shiftPhase() {
    const c = await db.custody.get('custody');
    if (!c) return;
    const t = new Date(c.cycleStart + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 7);
    await db.custody.update('custody', { cycleStart: t.toISOString().slice(0, 10), updatedAt: now() });
    toast('Faza przesunięta o tydzień');
  }
  return (
    <Sheet open onClose={onClose} title="Opieka: najbliższe 4 tygodnie">
      <p className="text-sm text-muted">Dotknij dzień, aby zmienić (np. zamiana z drugim rodzicem). Plan treningów przeliczy się sam.</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((dt) => <button key={dt} onClick={() => toggle(dt)} className={cx('rounded-lg py-2 text-xs leading-tight', withDaughter(d.custody!, dt) ? 'bg-accent text-accent-ink' : 'bg-card2', dt in d.custody!.overrides && 'ring-2 ring-warn')}>{formatPl(dt).split(' ')[0]}<br />{Number(dt.slice(8))}</button>)}
      </div>
      <p className="text-xs text-muted">Pomarańczowa obwódka = ręczna zmiana.</p>
      <Btn kind="soft" className="w-full" onClick={shiftPhase}>Cała faza jest przesunięta: zamień tygodnie</Btn>
    </Sheet>
  );
}

function LabSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [f, setF] = useState({ date: today, name: '', value: '', unit: '', refRange: '', doctorNote: '' });
  return (
    <Sheet open onClose={onClose} title="Wynik badania">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Data"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Parametr"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="np. HbA1c" /></Field>
        <Field label="Wartość"><input className={inputCls} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
        <Field label="Jednostka"><input className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
      </div>
      <Field label="Zakres referencyjny laboratorium"><input className={inputCls} value={f.refRange} onChange={(e) => setF({ ...f, refRange: e.target.value })} /></Field>
      <Field label="Notatka lekarza"><input className={inputCls} value={f.doctorNote} onChange={(e) => setF({ ...f, doctorNote: e.target.value })} /></Field>
      <Btn className="w-full" disabled={!f.name || !f.value} onClick={async () => { await db.labs.add({ id: uid(), createdAt: now(), updatedAt: now(), ...f, source: 'manual' }); onClose(); }}>Zapisz</Btn>
    </Sheet>
  );
}

function SymptomSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [f, setF] = useState({ date: today, time: '', products: '', abdominalPain: undefined as number | undefined, diarrhea: false, bloating: false, onsetMinutes: undefined as number | undefined });
  return (
    <Sheet open onClose={onClose} title="Objawy trawienne">
      <Field label="Produkty (po przecinku)"><input className={inputCls} value={f.products} onChange={(e) => setF({ ...f, products: e.target.value })} placeholder="np. jogurt bez laktozy, owsianka" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Godzina posiłku"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Objawy po (min)"><NumInput value={f.onsetMinutes} onChange={(v) => setF({ ...f, onsetMinutes: v })} /></Field>
      </div>
      <Field label="Ból brzucha 0–10"><NumInput value={f.abdominalPain} onChange={(v) => setF({ ...f, abdominalPain: v })} /></Field>
      <Toggle on={f.diarrhea} onChange={(v) => setF({ ...f, diarrhea: v })} label="Biegunka" />
      <Toggle on={f.bloating} onChange={(v) => setF({ ...f, bloating: v })} label="Wzdęcia" />
      <p className="text-xs text-muted">Przy objawach ciężkiej reakcji (duszność, obrzęk twarzy lub gardła) dzwoń 112. Nie testuj samodzielnie ponownie produktu, który wywołał silną reakcję.</p>
      <Btn className="w-full" disabled={!f.products} onClick={async () => { await db.symptoms.add({ id: uid(), createdAt: now(), updatedAt: now(), ...f, severity: f.abdominalPain, source: 'manual' }); onClose(); }}>Zapisz</Btn>
    </Sheet>
  );
}

function ProfileSheet({ data, onClose }: { data: ScreenProps['data']; onClose: () => void }) {
  const p = data.profile!;
  const [f, setF] = useState<{ name: string; heightCm: number; ageYears: number; g1?: number; g2?: number; startDate: string }>({ name: p.name, heightCm: p.heightCm, ageYears: p.ageYears, g1: p.goals[0]?.kg, g2: p.goals[1]?.kg, startDate: p.startDate });
  const bmr = bmrMifflin({ weightKg: p.declaredWeightKg, heightCm: f.heightCm, age: f.ageYears, sex: p.sex });
  return (
    <Sheet open onClose={onClose} title="Edytuj profil">
      <Field label="Imię"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Wzrost"><NumInput value={f.heightCm} onChange={(v) => setF({ ...f, heightCm: v ?? f.heightCm })} /></Field>
        <Field label="Wiek"><NumInput value={f.ageYears} onChange={(v) => setF({ ...f, ageYears: v ?? f.ageYears })} /></Field>
        <Field label="Cel 1 (kg)"><NumInput value={f.g1} onChange={(v) => setF({ ...f, g1: v })} /></Field>
        <Field label="Cel 2 (kg)"><NumInput value={f.g2} onChange={(v) => setF({ ...f, g2: v })} /></Field>
      </div>
      <Field label="Start planu (kalibracja 14 dni)"><input type="date" className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      <p className="text-xs text-muted">BMR przy zadeklarowanej wadze: {Math.round(bmr)} kcal. Po osiągnięciu pierwszego celu: ponowna ocena wyglądu, obwodów, zdrowia i wyników.</p>
      <Btn className="w-full" onClick={async () => {
        const goals = [f.g1 && { kg: f.g1, label: 'Cel 1' }, f.g2 && { kg: f.g2, label: 'Cel 2' }].filter(Boolean) as { kg: number; label: string }[];
        await db.profile.update('me', { name: f.name, heightCm: f.heightCm, ageYears: f.ageYears, ageRefDate: diffDays(p.ageRefDate, new Date().toISOString().slice(0, 10)) > 0 && f.ageYears !== p.ageYears ? new Date().toISOString().slice(0, 10) : p.ageRefDate, goals, startDate: f.startDate, updatedAt: now() });
        onClose();
      }}>Zapisz</Btn>
    </Sheet>
  );
}

function WipeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [t, setT] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title="Usuń wszystkie dane">
      <p className="text-sm">Tego nie da się cofnąć. Najpierw zrób kopię zapasową. Wpisz <b>USUŃ</b>, aby potwierdzić.</p>
      <input className={inputCls} value={t} onChange={(e) => setT(e.target.value)} />
      <Btn kind="danger" className="w-full" disabled={t !== 'USUŃ'} onClick={async () => { await wipeAll(); localStorage.clear(); location.reload(); }}>Usuń trwale</Btn>
    </Sheet>
  );
}
