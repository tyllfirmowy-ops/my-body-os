import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { fk, jointAngle, phaseStart, sampleAt, totalDuration, type Key, type Skeleton, type V } from '../domain/rig';
import type { Rig } from '../data/rigs';
import { cx } from './kit';

const P = (p: V) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

/** Najmocniej przemieszczający się staw między klatkami: do narysowania toru ruchu. */
function mainPath(rig: Rig, from: string, to: string): V[] {
  const a = fk(rig.keys[from]), b = fk(rig.keys[to]);
  const joints: (keyof Skeleton)[] = ['hand', 'hip', 'shoulder', 'ankle'];
  const j = joints.reduce((best, k) => (Math.hypot((b[k] as V)[0] - (a[k] as V)[0], (b[k] as V)[1] - (a[k] as V)[1]) > Math.hypot((b[best] as V)[0] - (a[best] as V)[0], (b[best] as V)[1] - (a[best] as V)[1]) ? k : best), 'hand' as keyof Skeleton);
  return Array.from({ length: 11 }, (_, i) => {
    const s = sampleAt(rig.keys, [{ from, to, dur: 1, phase: 'eccentric', breath: '', label: '' }], i / 10 * 0.9999);
    return fk(s.key)[j] as V;
  });
}

export function Body({ s, rig, ghost, color = 'var(--ink)', highlight }: { s: Skeleton; rig: Rig; ghost?: boolean; color?: string; highlight?: boolean }) {
  const front = rig.view === 'front';
  const mx = (p: V): V => [200 - p[0], p[1]];
  const w = ghost ? 4 : 1;
  const line = (pts: V[], width: number, op = 1) => <polyline points={pts.map(P).join(' ')} fill="none" stroke={color} strokeWidth={ghost ? 3 : width} strokeLinecap="round" strokeLinejoin="round" opacity={op} />;
  const trunkPath = () => {
    const m: V = [(s.hip[0] + s.shoulder[0]) / 2, (s.hip[1] + s.shoulder[1]) / 2];
    const dx = s.shoulder[0] - s.hip[0], dy = s.shoulder[1] - s.hip[1], L = Math.hypot(dx, dy) || 1;
    const c: V = [m[0] + (-dy / L) * s.curve, m[1] + (dx / L) * s.curve];
    return <path d={`M${P(s.hip)} Q${P(c)} ${P(s.shoulder)} L${P(s.neck)}`} fill="none" stroke={color} strokeWidth={ghost ? 3 : 10} strokeLinecap="round" strokeLinejoin="round" />;
  };
  const headC: V = front ? [100, s.head[1]] : s.head;
  return (
    <g opacity={ghost ? 0.55 : 1}>
      {front && !ghost && <g opacity={0.45}>{line([mx(s.shoulder), mx(s.elbow), mx(s.hand)], 6)}{line([mx(s.hip), mx(s.knee), mx(s.ankle), mx(s.toe)], 7)}</g>}
      {line([s.hip, s.knee, s.ankle, s.toe], 7 * w)}
      {front ? <polygon points={[s.shoulder, mx(s.shoulder), mx(s.hip), s.hip].map(P).join(' ')} fill={ghost ? 'none' : color} stroke={color} strokeWidth={ghost ? 2 : 1} /> : trunkPath()}
      {front && line([[100, s.shoulder[1]], [100, s.neck[1]]], 5)}
      {line([s.shoulder, s.elbow, s.hand], 6)}
      <circle cx={headC[0]} cy={headC[1]} r={7} fill={ghost ? 'none' : color} stroke={color} strokeWidth={ghost ? 2 : 0} />
      {highlight && rig.muscles.map((m, i) => {
        const a = s[m.a] as V, b = s[m.b] as V; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const o: V = [(-dy / L) * 4 * m.side, (dx / L) * 4 * m.side];
        return <line key={i} x1={a[0] + o[0] + dx * 0.15} y1={a[1] + o[1] + dy * 0.15} x2={b[0] + o[0] - dx * 0.15} y2={b[1] + o[1] - dy * 0.15} stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" opacity={0.75} />;
      })}
    </g>
  );
}

function Props({ rig, s }: { rig: Rig; s: Skeleton }) {
  return (
    <>
      {rig.props.map((pr, i) => {
        if (pr.t === 'rect') return <rect key={i} x={pr.x} y={pr.y} width={pr.w} height={pr.h} rx="2" fill="var(--card)" stroke="var(--line)" />;
        if (pr.t === 'pad') return <line key={i} x1={pr.a[0]} y1={pr.a[1]} x2={pr.b[0]} y2={pr.b[1]} stroke="var(--line)" strokeWidth={pr.w} strokeLinecap="round" />;
        if (pr.t === 'mat') return <rect key={i} x="20" y="147" width="160" height="3" rx="1.5" fill="var(--accent)" opacity=".3" />;
        if (pr.t === 'cable') return <line key={i} x1={pr.from[0]} y1={pr.from[1]} x2={s.hand[0]} y2={s.hand[1]} stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="3 2" />;
        return null;
      })}
    </>
  );
}
function Held({ rig, s }: { rig: Rig; s: Skeleton }) {
  const hands = rig.mirror ? [s.hand, [200 - s.hand[0], s.hand[1]] as V] : [s.hand];
  return (
    <>
      {rig.props.map((pr, i) => {
        if (pr.t === 'db') return <g key={i}>{hands.map((h, j) => rig.view === 'front'
          ? <rect key={j} x={h[0] - 2.5} y={h[1] - 7} width="5" height="14" rx="1.5" fill="var(--accent)" />
          : <g key={j}><circle cx={h[0]} cy={h[1]} r="5" fill="var(--accent)" /><circle cx={h[0]} cy={h[1]} r="1.6" fill="var(--card2)" /></g>)}</g>;
        if (pr.t === 'bar') return <rect key={i} x={s.hand[0] - pr.w / 2 - 2} y={s.hand[1] - 2.5} width={pr.w + 4} height="5" rx="2" fill="var(--accent)" />;
        if (pr.t === 'roller') return <circle key={i} cx={s.ankle[0]} cy={s.ankle[1] - 5} r="5.5" fill="var(--accent)" opacity=".8" />;
        return null;
      })}
    </>
  );
}

export interface RigViewOpts { highlight?: boolean; errorIndex?: number | null; showPath?: boolean; showAngles?: boolean }

export function RigScene({ rig, keyPose, step, opts }: { rig: Rig; keyPose: Key; step?: number; opts?: RigViewOpts }) {
  const s = fk(keyPose);
  const st = step !== undefined ? rig.timeline[step] : undefined;
  const path = opts?.showPath !== false && st && st.from !== st.to ? mainPath(rig, st.from, st.to) : null;
  const err = opts?.errorIndex !== undefined && opts.errorIndex !== null ? rig.errors[opts.errorIndex] : undefined;
  const ghost = err?.ghost ? fk(err.ghost) : null;
  const angleMarks = opts?.showAngles !== false ? (rig.angles ?? []).filter((a) => st && (st.to === a.key || st.from === a.key)) : [];
  return (
    <svg viewBox="0 0 200 160" className="w-full" role="img" aria-label="Animacja ćwiczenia">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" /></marker></defs>
      <line x1="0" x2="200" y1="150.5" y2="150.5" stroke="var(--line)" strokeWidth="2" />
      <Props rig={rig} s={s} />
      {rig.benchAngle && <g><path d={`M${rig.benchAngle.a[0] - 26},${rig.benchAngle.a[1]} A26,26 0 0,1 ${rig.benchAngle.a[0] - 22.5},${rig.benchAngle.a[1] - 13}`} fill="none" stroke="var(--muted)" strokeWidth="1" />
        <text x={rig.benchAngle.a[0] - 40} y={rig.benchAngle.a[1] - 2} fontSize="7" fill="var(--muted)">~{rig.benchAngle.deg}°</text></g>}
      {path && <polyline points={path.map(P).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" markerEnd="url(#arr)" opacity=".8" />}
      {ghost && <Body s={ghost} rig={rig} ghost color="var(--danger)" />}
      <Body s={s} rig={rig} highlight={opts?.highlight} />
      <Held rig={rig} s={s} />
      {[s.ankle, s.toe].filter((p) => p[1] > 143).map((p, i) => <circle key={i} cx={p[0]} cy={149} r="1.8" fill="var(--warn)" />)}
      {angleMarks.map((a, i) => {
        const val = a.joint === 'knee' ? jointAngle(s.hip, s.knee, s.ankle) : a.joint === 'elbow' ? jointAngle(s.shoulder, s.elbow, s.hand) : jointAngle(s.shoulder, s.hip, s.knee);
        const at = a.joint === 'knee' ? s.knee : a.joint === 'elbow' ? s.elbow : s.hip;
        return <text key={i} x={at[0] + 6} y={at[1] - 6} fontSize="7" fill="var(--muted)">~{Math.round(val / 5) * 5}°</text>;
      })}
    </svg>
  );
}

/** Odtwarzacz: pauza, przewijanie, prędkość 0,5×/1×, skok do fazy. */
export function RigPlayer({ rig }: { rig: Rig }) {
  const total = totalDuration(rig.timeline);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1>(1);
  const [opts, setOpts] = useState<RigViewOpts>({ highlight: false, errorIndex: null });
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let raf = 0;
    const loop = (now: number) => {
      if (last.current !== null) setTime((t) => (t + ((now - last.current!) / 1000) * speed) % total);
      last.current = now; raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);
  const smp = sampleAt(rig.keys, rig.timeline, time);
  const breathColor = smp.phase === 'concentric' ? 'text-accent' : smp.phase === 'eccentric' ? 'text-warn' : 'text-muted';
  const err = opts.errorIndex !== null && opts.errorIndex !== undefined ? rig.errors[opts.errorIndex] : undefined;
  return (
    <div className="rounded-2xl bg-card2 p-3 space-y-2">
      <div className="relative">
        <RigScene rig={rig} keyPose={smp.key} step={smp.step} opts={opts} />
        {err?.ghost && <div className="absolute top-1 left-1 rounded bg-danger/15 px-2 py-0.5 text-[11px] text-danger">Czerwony = błąd: {err.title}</div>}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{smp.label}</span>
        <span className={cx('text-xs font-semibold uppercase', breathColor)}>{smp.breath}</span>
      </div>
      <input type="range" min={0} max={total} step={0.01} value={time} aria-label="Przewijanie animacji"
        onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} className="w-full accent-[var(--accent)]" />
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setPlaying(!playing)} className="flex items-center gap-1 rounded-lg bg-card px-3 py-2 text-xs" aria-label={playing ? 'Pauza' : 'Odtwórz'}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pauza' : 'Odtwórz'}</button>
        {([0.5, 1] as const).map((v) => <button key={v} onClick={() => setSpeed(v)} className={cx('rounded-lg px-3 py-2 text-xs', speed === v ? 'bg-accent text-accent-ink font-semibold' : 'bg-card')}>{v === 0.5 ? '0,5×' : '1×'}</button>)}
        <button onClick={() => setOpts({ ...opts, highlight: !opts.highlight })} className={cx('rounded-lg px-3 py-2 text-xs', opts.highlight ? 'bg-accent text-accent-ink font-semibold' : 'bg-card')}>Mięśnie</button>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Fazy ruchu">
        {rig.timeline.map((st, i) => st.phase === 'top' && i === rig.timeline.length - 1 ? null : (
          <button key={i} onClick={() => { setPlaying(false); setTime(phaseStart(rig.timeline, i) + st.dur * (st.from === st.to ? 0.5 : 0.999)); }}
            className={cx('rounded-full px-2.5 py-1 text-[11px]', smp.step === i ? 'bg-ink text-bg' : 'bg-card text-muted')}>{PHASE_PL[st.phase]}</button>
        ))}
      </div>
      {opts.highlight && <p className="text-xs text-muted">Pracują: {rig.muscleNames}</p>}
      <p className="text-[11px] text-muted">{rig.viewNote} {rig.reference ? 'Wzorzec przygotowany na podstawie opisów techniki z materiałów szkoleniowych.' : 'Schemat ruchu.'} To ilustracja poglądowa, nie ocena Twojej techniki ani zalecenie medyczne. Zakres ruchu dobierasz do swojej mobilności i bólu.</p>
      <ErrorsList rig={rig} selected={opts.errorIndex ?? null} onSelect={(i) => setOpts({ ...opts, errorIndex: i })} />
    </div>
  );
}
const PHASE_PL = { setup: 'Start', eccentric: 'Ekscentryczna', bottom: 'Dół / pauza', concentric: 'Koncentryczna', top: 'Góra / pauza' } as const;

function ErrorsList({ rig, selected, onSelect }: { rig: Rig; selected: number | null; onSelect: (i: number | null) => void }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted mb-1">3 najczęstsze błędy</div>
      <div className="space-y-1">
        {rig.errors.slice(0, 3).map((e, i) => (
          <button key={i} onClick={() => onSelect(selected === i ? null : i)} className={cx('w-full text-left rounded-lg px-3 py-2 text-sm', selected === i ? 'bg-danger/15' : 'bg-card')}>
            <span className="font-semibold">{e.title}</span>{e.ghost ? <span className="text-xs text-danger"> · pokaż na rysunku</span> : <span className="text-xs text-muted"> · niewidoczne w tej perspektywie</span>}
            {selected === i && <span className="block text-xs text-muted mt-0.5">{e.detail}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
