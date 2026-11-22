/**
 * Lekki szkielet 2D do instruktażu ćwiczeń (czysta logika, bez UI).
 * - Stałe długości segmentów (proporcje antropometryczne, wzrost umowny ~112 j.).
 * - Pozycja = biodro + kąt tułowia; kończyny przez 2-segmentową kinematykę odwrotną (IK) do celu
 *   (stopa na podłodze, dłoń na uchwycie/hantlu) albo przez kąty (kinematyka prosta).
 * - Kąty w stopniach w układzie SVG: 0° = w prawo, 90° = w dół.
 * IK z definicji zachowuje długości kości; gdy cel jest poza zasięgiem, kończyna prostuje się w jego kierunku.
 */
export type V = [number, number];
export const BONES = { shin: 28, thigh: 27, trunk: 32, neck: 7, headR: 7, upperArm: 20, forearm: 23, foot: 13 } as const;

export type Limb = { mode: 'ik'; target: V; bend: 1 | -1 } | { mode: 'ang'; a1: number; a2: number };
export interface Key { hip: V; trunk: number; head?: number; arm: Limb; leg: Limb; foot?: number; curve?: number }
export interface Skeleton { hip: V; knee: V; ankle: V; toe: V; shoulder: V; elbow: V; hand: V; neck: V; head: V; curve: number }

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const dir = (a: number): V => [Math.cos(rad(a)), Math.sin(rad(a))];
export const add = (p: V, d: V, k = 1): V => [p[0] + d[0] * k, p[1] + d[1] * k];
export const dist = (a: V, b: V) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const angleOf = (a: V, b: V) => deg(Math.atan2(b[1] - a[1], b[0] - a[0]));

/** IK dwóch segmentów: zwraca staw środkowy i koniec (koniec = cel, jeśli osiągalny). */
export function ik2(base: V, target: V, l1: number, l2: number, bend: 1 | -1): { mid: V; end: V } {
  const raw = dist(base, target);
  const d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, raw));
  const a = Math.atan2(target[1] - base[1], target[0] - base[0]);
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const alpha = Math.acos(cosA) * bend;
  const mid: V = [base[0] + Math.cos(a + alpha) * l1, base[1] + Math.sin(a + alpha) * l1];
  const end: V = [base[0] + Math.cos(a) * d, base[1] + Math.sin(a) * d];
  return { mid, end };
}

function limb(base: V, l: Limb, l1: number, l2: number): { mid: V; end: V } {
  if (l.mode === 'ik') return ik2(base, l.target, l1, l2, l.bend);
  const mid = add(base, dir(l.a1), l1);
  return { mid, end: add(mid, dir(l.a2), l2) };
}

/** Kinematyka prosta: z klatki kluczowej do pozycji stawów. */
export function fk(k: Key): Skeleton {
  const shoulder = add(k.hip, dir(k.trunk), BONES.trunk);
  const headA = k.head ?? k.trunk;
  const neck = add(shoulder, dir(headA), BONES.neck);
  const head = add(neck, dir(headA), BONES.headR);
  const arm = limb(shoulder, k.arm, BONES.upperArm, BONES.forearm);
  const leg = limb(k.hip, k.leg, BONES.thigh, BONES.shin);
  const toe = add(leg.end, dir(k.foot ?? 0), BONES.foot);
  return { hip: k.hip, knee: leg.mid, ankle: leg.end, toe, shoulder, elbow: arm.mid, hand: arm.end, neck, head, curve: k.curve ?? 0 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const lerpA = (a: number, b: number, t: number) => { let d = ((b - a + 540) % 360) - 180; if (d === -180) d = 180; return a + d * t; };

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if (a.mode === 'ik' && b.mode === 'ik') return { mode: 'ik', target: lerpV(a.target, b.target, t), bend: a.bend };
  if (a.mode === 'ang' && b.mode === 'ang') return { mode: 'ang', a1: lerpA(a.a1, b.a1, t), a2: lerpA(a.a2, b.a2, t) };
  throw new Error('Klatki kluczowe muszą używać tego samego trybu kończyny');
}

/** Interpolacja klatek: pozycje liniowo, kąty najkrótszą drogą; kości zachowują długość, bo pozycje liczy fk/IK. */
export function lerpKey(a: Key, b: Key, t: number): Key {
  return {
    hip: lerpV(a.hip, b.hip, t), trunk: lerpA(a.trunk, b.trunk, t),
    head: a.head !== undefined || b.head !== undefined ? lerpA(a.head ?? a.trunk, b.head ?? b.trunk, t) : undefined,
    arm: lerpLimb(a.arm, b.arm, t), leg: lerpLimb(a.leg, b.leg, t),
    foot: lerpA(a.foot ?? 0, b.foot ?? 0, t), curve: lerp(a.curve ?? 0, b.curve ?? 0, t),
  };
}

/** Kąt wewnętrzny w stawie b (między ramionami b→a i b→c), 0–180°. */
export function jointAngle(a: V, b: V, c: V): number {
  const v1: V = [a[0] - b[0], a[1] - b[1]], v2: V = [c[0] - b[0], c[1] - b[1]];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
  return deg(Math.acos(Math.min(1, Math.max(-1, cos))));
}
/** Odchylenie odcinka od pionu (0° = pion). */
export function fromVertical(a: V, b: V): number {
  return Math.abs(deg(Math.atan2(b[0] - a[0], Math.abs(b[1] - a[1]))));
}

// ---- oś czasu ----
export type Phase = 'setup' | 'eccentric' | 'bottom' | 'concentric' | 'top';
export interface Step { from: string; to: string; dur: number; phase: Phase; breath: string; label: string }
export interface Sample { key: Key; step: number; phase: Phase; label: string; breath: string; t: number }

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const totalDuration = (tl: Step[]) => tl.reduce((a, s) => a + s.dur, 0);
export function phaseStart(tl: Step[], i: number) { return tl.slice(0, i).reduce((a, s) => a + s.dur, 0); }

/** Próbka animacji w czasie (s). Pętla. */
export function sampleAt(keys: Record<string, Key>, tl: Step[], time: number): Sample {
  const total = totalDuration(tl);
  let s = ((time % total) + total) % total;
  for (let i = 0; i < tl.length; i++) {
    const st = tl[i];
    if (s <= st.dur || i === tl.length - 1) {
      const t = st.dur > 0 ? ease(Math.min(1, s / st.dur)) : 1;
      return { key: lerpKey(keys[st.from], keys[st.to], t), step: i, phase: st.phase, label: st.label, breath: st.breath, t };
    }
    s -= st.dur;
  }
  throw new Error('pusta oś czasu');
}
