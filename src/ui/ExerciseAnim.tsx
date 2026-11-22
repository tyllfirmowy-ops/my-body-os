import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { ANIMS, type Anim, type P, type Pose } from '../data/poses';

const KEYS: (keyof Pose)[] = ['head', 'neck', 'sh', 'el', 'ha', 'hip', 'kn', 'an', 'to'];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function poseAt(a: Anim, t: number): Pose {
  const B = { ...a.A, ...a.B } as Pose;
  return Object.fromEntries(KEYS.map((k) => [k, lerp(a.A[k], B[k], t)])) as unknown as Pose;
}

/** Fazy pętli (s): start → ruch A→B → pauza → ruch B→A. Wysiłek ~1,5 s, faza powolna ~2,5 s. */
function timeline(a: Anim) {
  const holdA = 1, holdB = a.holdB ?? 0.4;
  const ab = a.effort === 'AtoB' ? 1.5 : 2.5, ba = a.effort === 'AtoB' ? 2.5 : 1.5;
  return { holdA, ab, holdB, ba, total: holdA + ab + holdB + ba };
}
export function frame(a: Anim, sec: number): { t: number; label: string; phase: 'start' | 'effort' | 'hold' | 'return' } {
  const tl = timeline(a); const s = sec % tl.total;
  const effortFirst = a.effort === 'AtoB';
  if (s < tl.holdA) return { t: 0, label: 'Pozycja wyjściowa', phase: 'start' };
  if (s < tl.holdA + tl.ab) return { t: ease((s - tl.holdA) / tl.ab), label: effortFirst ? a.effortLabel : a.returnLabel, phase: effortFirst ? 'effort' : 'return' };
  if (s < tl.holdA + tl.ab + tl.holdB) return { t: 1, label: a.holdB && a.holdB >= 1 ? 'Trzymaj' : 'Pauza', phase: 'hold' };
  return { t: 1 - ease((s - tl.holdA - tl.ab - tl.holdB) / tl.ba), label: effortFirst ? a.returnLabel : a.effortLabel, phase: effortFirst ? 'return' : 'effort' };
}

export function Figure({ a, p }: { a: Anim; p: Pose }) {
  const limb = (pts: P[], w = 7) => <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
  const mirror = (q: P): P => [200 - q[0], q[1]];
  return (
    <g>
      <line x1="0" x2="200" y1="150.5" y2="150.5" stroke="var(--line)" strokeWidth="2" />
      {a.props.map((pr, i) => {
        if (pr.t === 'rect') return <rect key={i} x={pr.x} y={pr.y} width={pr.w} height={pr.h} rx="2" fill="var(--card2)" stroke="var(--line)" />;
        if (pr.t === 'line') return <line key={i} x1={pr.a[0]} y1={pr.a[1]} x2={pr.b[0]} y2={pr.b[1]} stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" opacity=".6" />;
        if (pr.t === 'mat') return <rect key={i} x="20" y="147" width="160" height="4" rx="2" fill="var(--accent)" opacity=".35" />;
        if (pr.t === 'cable') return <line key={i} x1={pr.from[0]} y1={pr.from[1]} x2={p.ha[0]} y2={p.ha[1]} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 2" />;
        return null;
      })}
      {a.mirror && <g opacity=".55">{limb([a.A.neck, mirror(p.sh), mirror(p.el), mirror(p.ha)])}{limb([mirror(p.hip), mirror(p.kn), mirror(p.an), mirror(p.to)])}</g>}
      {limb([p.hip, p.kn, p.an, p.to])}
      {a.mirror ? <>{limb([p.neck, [100, p.hip[1]]], 9)}{limb([mirror(p.hip), p.hip], 9)}</> : limb([p.neck, p.hip], 9)}
      {limb([p.neck, p.sh, p.el, p.ha])}
      <circle cx={p.head[0]} cy={p.head[1]} r="8" fill="var(--ink)" />
      {a.props.map((pr, i) => {
        if (pr.t === 'db') return <g key={i}>{[p.ha, ...(a.mirror ? [mirror(p.ha)] : [])].map((h, j) => <rect key={j} x={h[0] - 7} y={h[1] - 3} width="14" height="6" rx="2" fill="var(--accent)" />)}</g>;
        if (pr.t === 'bar') return <rect key={i} x={p.ha[0] - pr.w / 2 - 2} y={p.ha[1] - 2.5} width={pr.w + 4} height="5" rx="2" fill="var(--accent)" />;
        if (pr.t === 'roller') return <circle key={i} cx={p.an[0]} cy={p.an[1] - 6} r="6" fill="var(--accent)" opacity=".8" />;
        return null;
      })}
    </g>
  );
}

export function ExerciseAnim({ id }: { id: string }) {
  const a = ANIMS[id];
  const [playing, setPlaying] = useState(true);
  const [sec, setSec] = useState(0);
  const raf = useRef(0); const t0 = useRef(performance.now());
  useEffect(() => {
    if (!a || !playing) return;
    t0.current = performance.now() - sec * 1000;
    const loop = (now: number) => { setSec((now - t0.current) / 1000); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, playing]);
  if (!a) return null;
  const f = playing ? frame(a, sec) : { t: 0, label: 'Pozycja wyjściowa', phase: 'start' as const };
  const color = f.phase === 'effort' ? 'text-accent' : f.phase === 'return' ? 'text-warn' : 'text-muted';
  return (
    <div className="rounded-2xl bg-card2 p-3">
      <svg viewBox="0 0 200 160" className="w-full max-h-64" role="img" aria-label={`Animacja: ${f.label}`}><Figure a={a} p={poseAt(a, f.t)} /></svg>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-sm font-semibold ${color}`}>{f.label}</span>
        <button onClick={() => { setPlaying(!playing); if (playing) setSec(0); }} className="flex items-center gap-1 rounded-lg bg-card px-3 py-2 text-xs" aria-label={playing ? 'Zatrzymaj na pozycji wyjściowej' : 'Odtwórz'}>
          {playing ? <><Pause size={14} /> Pozycja startowa</> : <><Play size={14} /> Odtwórz</>}
        </button>
      </div>
      <p className="text-xs mt-2"><b>Start:</b> {a.startCue}</p>
      <p className="text-xs mt-1"><b>Uważaj:</b> {a.watch}</p>
      <p className="text-[11px] text-muted mt-1">Tempo: wysiłek ~1,5 s z wydechem, powrót ~2,5 s z wdechem. Ilustracja poglądowa (schemat ruchu).</p>
    </div>
  );
}

export { poseAt };
