import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Search, Star, Zap } from 'lucide-react';
import { db, now } from '../db/db';
import { offByBarcode, offSearch } from '../data/offClient';
import { scaleNutrients } from '../domain/calc';
import type { FoodEntry, FoodProduct } from '../domain/types';
import { Badge, Btn, cx, Field, inputCls, NumInput, Sheet, toast } from '../ui/kit';

export const basisLabel = (b: FoodProduct['basis']) => ({ raw: 'waga surowa', dry: 'waga sucha (przed gotowaniem)', cooked: 'waga po ugotowaniu', drained: 'waga po odsączeniu', as_sold: 'waga produktu' }[b]);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

type Tab = 'local' | 'online' | 'scan' | 'quick';

export function FoodPicker({ foods, entries, onClose, onAdd, onQuick, onNew, title }: {
  foods: FoodProduct[]; entries: FoodEntry[]; onClose: () => void;
  onAdd: (p: FoodProduct, g: number) => Promise<void>; onQuick?: (name: string, kcal: number, protein: number) => Promise<void>; onNew: () => void; title?: string;
}) {
  const [tab, setTab] = useState<Tab>('local');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<FoodProduct | null>(null);
  const [g, setG] = useState<number | undefined>(100);
  const [online, setOnline] = useState<FoodProduct[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState<{ name: string; kcal?: number; protein?: number }>({ name: '' });
  // białko puste = nieznane (nie 0)

  const recent = useMemo(() => {
    const m = new Map<string, number>();
    [...entries].sort((a, b) => b.createdAt - a.createdAt).forEach((e, i) => { if (!m.has(e.productId)) m.set(e.productId, i); });
    return m;
  }, [entries]);
  const list = useMemo(() => {
    const nq = norm(q.trim());
    const words = nq.split(/\s+/).filter(Boolean);
    return foods.filter((f) => words.every((w) => norm(f.name).includes(w)))
      .sort((a, b) => (Number(!!b.favorite) - Number(!!a.favorite)) || ((recent.get(a.id) ?? 1e9) - (recent.get(b.id) ?? 1e9)) || a.name.localeCompare(b.name, 'pl'))
      .slice(0, nq ? 60 : 30);
  }, [foods, q, recent]);

  async function searchOnline() {
    if (!q.trim()) return toast('Wpisz nazwę produktu');
    setBusy(true); setOnline(null);
    try { setOnline(await offSearch(q.trim())); } catch { toast('Brak połączenia z bazą Open Food Facts'); } finally { setBusy(false); }
  }
  async function pick(p: FoodProduct) {
    if (p.id.startsWith('off_') && !foods.some((f) => f.id === p.id)) await db.foods.put(p);
    setSel(foods.find((f) => f.id === p.id) ?? p); setG(p.unit?.grams ?? 100);
  }
  async function byCode(code: string) {
    setBusy(true);
    try {
      const local = foods.find((f) => f.barcode === code);
      const p = local ?? (await offByBarcode(code));
      if (!p) { toast(`Brak produktu ${code} w bazie (lub bez wartości odżywczych). Dodaj go ręcznie z etykiety.`); return; }
      await pick(p);
    } catch { toast('Brak połączenia z bazą Open Food Facts'); } finally { setBusy(false); }
  }

  if (sel) {
    const n = g !== undefined ? scaleNutrients(sel.per100, g) : null;
    return (
      <Sheet open onClose={onClose} title={sel.name}>
        <div className="text-xs text-muted">{basisLabel(sel.basis)} · {sel.reliability === 'label' ? 'z etykiety' : sel.reliability === 'reference' ? 'wartość referencyjna' : 'szacunek'}{sel.barcode ? ` · kod ${sel.barcode}` : ''}</div>
        <Field label="Gramatura (g)"><NumInput value={g} onChange={setG} /></Field>
        {sel.unit && <div className="flex gap-2">{[1, 2, 3].map((k) => <Btn key={k} kind="soft" className="flex-1 text-sm" onClick={() => setG(sel.unit!.grams * k)}>{k} × {sel.unit!.name}</Btn>)}</div>}
        {n && <div className="rounded-xl bg-card2 p-3 text-sm num">
          <b>{Math.round(n.kcal)} kcal</b> · B {n.protein.toFixed(1)} · T {n.fat.toFixed(1)} · W {n.carbs.toFixed(1)} · Bł {n.fiber.toFixed(1)}
          {(n.sugar !== undefined || n.satFat !== undefined || n.salt !== undefined) && <div className="text-xs text-muted mt-1">{n.sugar !== undefined && `cukry ${n.sugar.toFixed(1)} g`}{n.satFat !== undefined && ` · nasycone ${n.satFat.toFixed(1)} g`}{n.salt !== undefined && ` · sól ${n.salt.toFixed(2)} g`}</div>}
        </div>}
        {sel.dairy === 'contains' && <p className="text-sm text-warn">Zawiera składniki mleczne (mleko, serwatka, kazeina, laktoza lub ser).</p>}
        {sel.dairy === 'unknown' && <p className="text-sm text-muted">Skład niepewny pod kątem mleka: sprawdź etykietę.</p>}
        {sel.ingredients && <details className="text-xs text-muted"><summary>Skład</summary>{sel.ingredients}</details>}
        <div className="flex gap-2"><Btn kind="soft" onClick={() => setSel(null)}>Wstecz</Btn><Btn className="flex-1" disabled={!g} onClick={async () => { await onAdd(sel, g!); onClose(); }}>Dodaj</Btn></div>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title={title ?? 'Dodaj produkt'}>
      <div className={cx('grid gap-1 rounded-xl bg-card2 p-1 text-xs', onQuick ? 'grid-cols-4' : 'grid-cols-3')}>
        {([['local', 'Moje', Search], ['online', 'Online', Search], ['scan', 'Skanuj', Barcode], ['quick', 'Szybko', Zap]] as const).filter(([k]) => onQuick || k !== 'quick').map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('flex flex-col items-center gap-0.5 rounded-lg py-2', tab === k ? 'bg-card font-semibold' : 'text-muted')}><I size={16} />{l}</button>
        ))}
      </div>
      {(tab === 'local' || tab === 'online') && (
        <input autoFocus className={inputCls} placeholder={tab === 'local' ? 'Szukaj w bazie (np. kurczak, ryż)…' : 'Nazwa lub marka produktu…'} value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tab === 'online') searchOnline(); }} />
      )}
      {tab === 'local' && (<>
        <div className="divide-y divide-line">{list.map((f) => <Row key={f.id} f={f} onClick={() => pick(f)} recent={recent.has(f.id)} />)}</div>
        {!list.length && <p className="text-sm text-muted">Nie ma w Twojej bazie. Sprawdź „Online” albo zeskanuj kod.</p>}
        <div className="grid grid-cols-2 gap-2"><Btn kind="soft" className="text-sm" onClick={() => { setTab('online'); if (q) setTimeout(searchOnline, 0); }}>Szukaj online</Btn><Btn kind="soft" className="text-sm" onClick={() => { onClose(); onNew(); }}>+ Z etykiety</Btn></div>
      </>)}
      {tab === 'online' && (<>
        <Btn className="w-full" disabled={busy} onClick={searchOnline}>{busy ? 'Szukam…' : 'Szukaj w Open Food Facts'}</Btn>
        {online && <div className="divide-y divide-line">{online.map((f) => <Row key={f.id} f={f} onClick={() => pick(f)} />)}</div>}
        {online && !online.length && <p className="text-sm text-muted">Brak wyników z wartościami odżywczymi. Spróbuj krótszej nazwy lub zeskanuj kod.</p>}
        <p className="text-xs text-muted">Open Food Facts to otwarta baza produktów z etykiet. Dane wpisują użytkownicy: przy ważnych produktach porównaj z opakowaniem. Produkt zapisze się w Twojej bazie i będzie dostępny offline.</p>
      </>)}
      {tab === 'scan' && <Scanner busy={busy} onCode={byCode} />}
      {tab === 'quick' && onQuick && (<>
        <p className="text-sm text-muted">Gdy nie znasz produktu (restauracja, impreza): wpisz szacunek. Zapisze się jako szacunek.</p>
        <Field label="Co to było"><input className={inputCls} value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} placeholder="np. obiad w restauracji" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="kcal"><NumInput value={quick.kcal} onChange={(v) => setQuick({ ...quick, kcal: v })} /></Field>
          <Field label="Białko (g, opcjonalnie)"><NumInput value={quick.protein} onChange={(v) => setQuick({ ...quick, protein: v })} /></Field>
        </div>
        <Btn className="w-full" disabled={!quick.kcal} onClick={async () => { await onQuick(quick.name || 'Szybki wpis', quick.kcal!, quick.protein ?? 0); onClose(); }}>Dodaj</Btn>
      </>)}
    </Sheet>
  );
}

function Row({ f, onClick, recent }: { f: FoodProduct; onClick: () => void; recent?: boolean }) {
  return (
    <button onClick={onClick} className="w-full flex justify-between gap-2 py-3 text-left">
      <span className="text-sm">{f.favorite && <Star size={12} className="inline text-accent mr-1" />}{f.name}
        {recent && !f.favorite && <span className="text-xs text-muted"> · ostatnio</span>}
        {f.tolerance === 'bad' && <Badge tone="danger">źle tolerowany</Badge>}{f.dairy === 'contains' && <Badge tone="warn">mleko</Badge>}
        {f.reliability === 'estimate' && <span className="text-xs text-muted"> · szac.</span>}</span>
      <span className="text-xs text-muted num shrink-0 text-right">{f.per100.kcal} kcal<br />B {f.per100.protein}</span>
    </button>
  );
}

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function Scanner({ busy, onCode }: { busy: boolean; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [found, setFound] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null; let timer = 0; let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stop || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
        const Native = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
        const det: Detector = Native ? new Native({ formats }) : new (await import('barcode-detector/ponyfill')).BarcodeDetector({ formats: formats as never });
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const r = await det.detect(video.current);
            if (r[0]?.rawValue) { setFound(r[0].rawValue); stop = true; stream?.getTracks().forEach((t) => t.stop()); onCode(r[0].rawValue); return; }
          } catch { /* klatka bez kodu */ }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch (e) { setErr((e as Error)?.name === 'NotAllowedError' ? 'Brak zgody na aparat. Zezwól w Ustawienia → Safari → Aparat albo wpisz kod ręcznie.' : 'Aparat niedostępny. Wpisz kod ręcznie.'); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onCode]);
  return (
    <div className="space-y-3">
      {!err && !found && <div className="relative overflow-hidden rounded-2xl bg-black aspect-[4/3]">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
        <div className="absolute bottom-2 inset-x-0 text-center text-xs text-white/80">Nakieruj na kod kreskowy</div>
      </div>}
      {found && <p className="text-sm">Kod {found}: {busy ? 'szukam produktu…' : 'gotowe'}</p>}
      {err && <p className="text-sm text-warn">{err}</p>}
      <div className="flex gap-2"><input className={inputCls} inputMode="numeric" placeholder="Kod ręcznie (EAN)" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
        <Btn kind="soft" disabled={manual.length < 8 || busy} onClick={() => onCode(manual)}>OK</Btn></div>
    </div>
  );
}

export async function addQuickEntry(date: string, meal: number, name: string, kcal: number, protein: number, id: string) {
  // Nieznane makro oznaczone jawnie: w snapshot 0 tylko technicznie, analizy traktują je jako brak danych.
  const unknown: ('protein' | 'fat' | 'carbs' | 'fiber')[] = protein > 0 ? ['fat', 'carbs', 'fiber'] : ['protein', 'fat', 'carbs', 'fiber'];
  await db.entries.add({ id, createdAt: now(), updatedAt: now(), date, meal, productId: 'quick', grams: 0, snapshot: { name: `${name} (szacunek)`, kcal, protein, fat: 0, carbs: 0, fiber: 0 }, unknown, source: 'estimate' });
}
