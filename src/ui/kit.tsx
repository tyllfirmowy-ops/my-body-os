import { createPortal } from 'react-dom';
import { liveQuery } from 'dexie';
import { useEffect, useState, type ReactNode } from 'react';
import { X, Minus, Plus } from 'lucide-react';

export function useLive<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setV, error: (e) => console.error('DB error', e?.name) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, onClick, id }: { children: ReactNode; className?: string; onClick?: () => void; id?: string }) {
  return <div id={id} onClick={onClick} className={cx('rounded-2xl bg-card border border-line p-4 rise', onClick && 'active:scale-[0.99] transition cursor-pointer', className)}>{children}</div>;
}
export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="flex items-center justify-between mb-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>{right}</div>;
}
export function Btn({ children, onClick, kind = 'primary', className, disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'soft' | 'danger'; className?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const k = { primary: 'bg-accent text-accent-ink font-semibold', ghost: 'text-accent', soft: 'bg-card2 text-ink', danger: 'bg-danger text-white font-semibold' }[kind];
  return <button type={type} disabled={disabled} onClick={onClick} className={cx('min-h-12 px-4 rounded-xl active:opacity-80 disabled:opacity-40 transition', k, className)}>{children}</button>;
}
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'warn' | 'danger' }) {
  const t = { muted: 'bg-card2 text-muted', accent: 'bg-accent/15 text-accent', warn: 'bg-warn/15 text-warn', danger: 'bg-danger/15 text-danger' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', t)}>{children}</span>;
}
export function Stat({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-2xl font-semibold leading-tight">{value}<span className="text-sm font-normal text-muted">{unit ? ` ${unit}` : ''}</span></div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
export function Bar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'warn' }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return <div className="h-2 rounded-full bg-card2 overflow-hidden"><div className={cx('h-full rounded-full transition-all', tone === 'accent' ? 'bg-accent' : 'bg-warn')} style={{ width: `${p}%` }} /></div>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = o; };
  }, [open]);
  if (!open) return null;
  // portal: arkusz otwarty z wnętrza karty (animacja transform) nie może być przycięty do karty ani schowany pod licznikiem przerwy
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-bg border border-line safe-b" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-bg/95 backdrop-blur px-4 py-3 border-b border-line">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Zamknij" className="p-2 -mr-2 text-muted"><X size={22} /></button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Skala liczbowa (np. 1–5) jako duże przyciski; ponowne kliknięcie = brak danych. */
export function Scale({ label, min, max, value, onChange, hint }: { label: string; min: number; max: number; value?: number; onChange: (v: number | undefined) => void; hint?: string }) {
  const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div role="group" aria-label={label}>
      <div className="flex justify-between text-sm mb-1.5"><span>{label}</span><span className="text-muted text-xs">{hint}</span></div>
      <div className="flex gap-1">
        {opts.map((o) => (
          <button key={o} onClick={() => onChange(value === o ? undefined : o)} aria-pressed={value === o}
            className={cx('flex-1 min-h-11 rounded-lg text-sm num transition', value === o ? 'bg-accent text-accent-ink font-semibold' : 'bg-card2 text-ink')}>{o}</button>
        ))}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, unit, big }: { value: number; onChange: (v: number) => void; step?: number; min?: number; unit?: string; big?: boolean }) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center gap-2">
      <button aria-label="Mniej" onClick={() => set(value - step)} className={cx('rounded-xl bg-card2 grid place-items-center', big ? 'w-14 h-14' : 'w-11 h-11')}><Minus size={20} /></button>
      <input inputMode="decimal" value={Number.isFinite(value) ? String(value) : ''} onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')); if (!Number.isNaN(v)) set(v); }}
        className={cx('num text-center bg-transparent font-semibold w-20 outline-none', big ? 'text-3xl h-14' : 'text-xl h-11')} aria-label={unit ?? 'wartość'} />
      <button aria-label="Więcej" onClick={() => set(value + step)} className={cx('rounded-xl bg-card2 grid place-items-center', big ? 'w-14 h-14' : 'w-11 h-11')}><Plus size={20} /></button>
      {unit && <span className="text-muted text-sm">{unit}</span>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="text-sm text-muted">{label}</span><div className="mt-1">{children}</div></label>;
}
export const inputCls = 'w-full min-h-12 rounded-xl bg-card2 border border-line px-3 outline-none focus:border-accent';

export function NumInput({ value, onChange, placeholder, step }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string; step?: string }) {
  const [txt, setTxt] = useState(value === undefined ? '' : String(value));
  useEffect(() => { setTxt(value === undefined ? '' : String(value)); }, [value]);
  return <input className={inputCls} inputMode="decimal" step={step} placeholder={placeholder} value={txt}
    onChange={(e) => { setTxt(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); onChange(e.target.value.trim() === '' || Number.isNaN(v) ? undefined : v); }} />;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center justify-between w-full min-h-12" role="switch" aria-checked={on}>
      <span className="text-sm text-left">{label}</span>
      <span className={cx('w-12 h-7 rounded-full p-0.5 transition', on ? 'bg-accent' : 'bg-card2')}><span className={cx('block w-6 h-6 rounded-full bg-white transition', on && 'translate-x-5')} /></span>
    </button>
  );
}

let toastSet: ((s: string | null) => void) | null = null;
export function toast(msg: string) { toastSet?.(msg); setTimeout(() => toastSet?.(null), 2200); }
export function ToastHost() {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => { toastSet = setM; return () => { toastSet = null; }; }, []);
  if (!m) return null;
  return <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] rounded-full bg-ink text-bg px-4 py-2 text-sm shadow-lg rise" role="status">{m}</div>;
}

export function download(name: string, content: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); toast('Skopiowano'); } catch { toast('Nie udało się skopiować'); }
}
