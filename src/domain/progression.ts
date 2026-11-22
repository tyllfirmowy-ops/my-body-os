import { diffDays } from './dates';

export interface SetResult { weightKg: number; reps: number; rir?: number; pain?: number; done: boolean }
export type ProgressAction = 'increase' | 'reps' | 'hold' | 'decrease' | 'skip' | 'no_data' | 'pain';
export interface Suggestion {
  action: ProgressAction;
  weightKg: number | null;
  targetReps: string;
  reason: string;
  /** krótkie fakty, na których oparto sugestię */
  basis?: string[];
  /** większy ciężar do świadomego wyboru (np. skok > 10%), nie domyślny */
  alternativeKg?: number;
}
export interface SessionResult { date: string; sets: SetResult[]; technique?: 'ok' | 'bad' }

export interface ProgressInput {
  /** zakończone sesje TEGO ćwiczenia (exerciseId), od najnowszej; zamienniki mają własną historię */
  history: SessionResult[];
  today: string;
  plannedSets: number; repMin: number; repMax: number;
  /** najmniejszy dostępny skok obciążenia w kg (0 = bez obciążenia zewnętrznego) */
  step: number;
  safetyBlock: boolean;
  /** ćwiczenie mocno obciążające kolano bez oceny specjalisty: bez obciążenia */
  kneeNoLoad?: boolean;
  /** powód, dla którego dziś nie zwiększamy (plan B, ból kolana w check-inie) */
  noIncrease?: string;
  /** brak wpisanego bólu nie potwierdza bezpieczeństwa: zwiększenie tylko, gdy ból zaznaczono w ostatnim treningu */
  requirePainRecord?: boolean;
}

export const GAP = { hold: 14, minus10: 28, minus15: 56 } as const;
/** skok powyżej 10% nie jest proponowany domyślnie (ACSM 2009: zwykle 2–10%) */
export const MAX_JUMP = 0.1;
/** górna granica powtórzeń przy progresji powtórzeniami zamiast dużego skoku (reguła projektowa) */
export const repCap = (repMax: number) => Math.min(20, repMax + 3);

/** Zaokrąglenie do siatki skoku (kg); dla kroku 0 bez zmian. */
export function roundToStep(kg: number, step: number): number {
  if (!step) return Math.max(0, Math.round(kg * 10) / 10);
  return Math.max(0, Math.round(Math.round(kg / step) * step * 100) / 100);
}
/** Obniżka: w dół do siatki skoku (bezpieczniej), co najmniej o jeden skok. */
const down = (w: number, pct: number, step: number) => {
  if (!step) return Math.max(0, Math.round(w * (1 - pct) * 10) / 10);
  const r = Math.max(0, Math.floor((w * (1 - pct)) / step + 1e-9) * step);
  return Math.round((r >= w ? Math.max(0, w - step) : r) * 100) / 100;
};
/** Ciężar „roboczy” sesji: najczęstszy (przy remisie niższy). */
function workingWeight(sets: SetResult[]): number {
  const c = new Map<number, number>();
  for (const s of sets) c.set(s.weightKg, (c.get(s.weightKg) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}
const done = (s: SessionResult | undefined) => (s?.sets ?? []).filter((x) => x.done);
const atTop = (sets: SetResult[], w: number, p: ProgressInput) => sets.length >= p.plannedSets && sets.every((s) => s.weightKg === w && s.reps >= p.repMax);
const fmt = (kg: number) => `${String(Math.round(kg * 100) / 100).replace('.', ',')} kg`;

/**
 * Podwójna progresja (double progression) z zabezpieczeniami.
 * 1) Ten sam ciężar, dokładamy powtórzenia w zakresie. 2) Gdy wszystkie serie są na górze zakresu
 * w DWÓCH kolejnych sesjach (albo w jednej z zapasem RIR ≥ 2 w każdej serii), proponujemy najmniejszy skok.
 * Nigdy nie zmienia planu sam: wynik to propozycja do akceptacji.
 */
export function suggestProgression(p: ProgressInput): Suggestion {
  const range = `${p.repMin}–${p.repMax}`;
  if (p.safetyBlock) return { action: 'skip', weightKg: null, targetReps: range, reason: 'Aktywna blokada bezpieczeństwa. Pomiń to ćwiczenie dziś.' };
  if (p.kneeNoLoad) return { action: 'hold', weightKg: 0, targetReps: range, reason: 'Bez obciążenia do czasu oceny kolana przez specjalistę.' };
  const s0 = done(p.history[0]);
  if (!s0.length) return { action: 'no_data', weightKg: null, targetReps: range, reason: `Start: pierwsza seria lekko na rozgrzewkę, potem ciężar, przy którym po ${p.repMin}–${p.repMax} powtórzeniach zostają ok. 2–3 w zapasie. Zapiszę go jako punkt wyjścia.` };
  const w = workingWeight(s0);
  const basis: string[] = [`Ostatnio (${p.history[0].date}): ${s0.map((s) => `${String(s.weightKg).replace('.', ',')}×${s.reps}`).join(', ')}`];
  const res = (action: ProgressAction, weightKg: number | null, targetReps: string, reason: string): Suggestion => ({ action, weightKg, targetReps, reason, basis });

  // ból
  const maxPain = Math.max(...s0.map((s) => s.pain ?? 0));
  // ból ≥ 4: bez automatycznej zmiany ciężaru (ani w górę, ani „bezpiecznego” −10%); decyzja: pominąć albo zamiennik
  if (maxPain >= 4) return res('pain', null, range, `Ból ${maxPain}/10 ostatnio. Bez automatycznej zmiany ciężaru. Jeśli ból wraca, przerwij ćwiczenie albo wybierz zamiennik; nawracający ból skonsultuj ze specjalistą.`);
  // przerwa
  const gap = diffDays(p.history[0].date, p.today);
  if (gap >= GAP.minus15) return res('decrease', down(w, 0.15, p.step), range, `${gap} dni przerwy: ostrożny powrót, ok. 15% lżej.`);
  if (gap >= GAP.minus10) return res('decrease', down(w, 0.1, p.step), range, `${gap} dni przerwy: ostrożny powrót, ok. 10% lżej.`);
  if (gap >= GAP.hold) return res('hold', w, range, `${gap} dni przerwy: ten sam ciężar, bez zwiększania.`);
  if (maxPain === 3) return res('hold', w, range, 'Ból 3/10 ostatnio: bez zwiększania.');
  if (p.history[0].technique === 'bad') return res('hold', w, range, 'Słabsza technika ostatnio: ten sam ciężar.');

  // spadek wydolności
  const s1 = done(p.history[1]);
  const sameW1 = s1.length > 0 && workingWeight(s1) === w;
  const below = (sets: SetResult[]) => sets.filter((s) => s.reps < p.repMin).length >= Math.ceil(sets.length / 2);
  if (sameW1 && below(s0) && below(s1)) return res('decrease', down(w, 0.1, p.step), range, 'Dwa treningi z rzędu poniżej zakresu powtórzeń: lżej o ok. 10%.');
  if (s0.some((s) => s.reps < p.repMin) && s0.some((s) => s.rir === 0)) return res('decrease', down(w, 0.1, p.step), range, 'Poniżej zakresu bez zapasu (RIR 0): lżej o ok. 10%.');
  const tot = (sets: SetResult[]) => sets.reduce((a, s) => a + s.reps, 0);
  if (sameW1 && tot(s0) < tot(s1) * 0.8) return res('hold', w, range, `Wynik słabszy o ${Math.round((1 - tot(s0) / tot(s1)) * 100)}% niż poprzednio: ten sam ciężar.`);

  // górny zakres → zwiększenie tylko gdy uzasadnione
  if (atTop(s0, w, p)) {
    if (p.noIncrease) return res('hold', w, range, `${p.noIncrease}: dziś bez zwiększania.`);
    if (s0.some((s) => s.rir === 0)) return res('hold', w, range, 'Górny zakres, ale bez zapasu (RIR 0). Powtórz, zanim zwiększysz.');
    if (p.requirePainRecord && s0.some((s) => s.pain === undefined)) return res('hold', w, range, 'Ćwiczenie obciąża kolano: zaznacz ból (0–10) w seriach. Bez tej informacji nie zwiększam ciężaru.');
    const twice = sameW1 && atTop(s1, w, p);
    const clearReserve = s0.every((s) => s.rir !== undefined && s.rir >= 2);
    if (!twice && !clearReserve) return res('hold', w, range, `Pierwszy raz górny zakres (${p.repMax}). Powtórz; przy kolejnym takim wyniku zaproponuję więcej.`);
    if (!p.step) return res('reps', null, `${p.repMax}+`, 'Górny zakres bez obciążenia: dodaj serię albo wybierz trudniejszy wariant.');
    const next = roundToStep(w + p.step, p.step);
    const pct = w > 0 ? p.step / w : 0; // procent ze skoku, nie z zaokrąglonej wartości
    basis.push(twice ? 'Górny zakres w 2 kolejnych treningach' : 'Górny zakres z zapasem RIR ≥ 2 w każdej serii');
    if (pct > MAX_JUMP + 1e-6) {
      // skok > 10%: domyślnie ten sam ciężar i więcej powtórzeń (do repMax + 3), większy ciężar tylko świadomie
      const cap = repCap(p.repMax);
      const capTwice = sameW1 && [s0, s1].every((ss) => ss.length >= p.plannedSets && ss.every((x) => x.weightKg === w && x.reps >= cap));
      if (!capTwice) {
        const r = res('reps', w, `${p.repMax}–${cap}`, `Najmniejszy skok to +${Math.round(pct * 100)}% (${fmt(next)}), więcej niż zwykłe 2–10%. Zostań przy ${fmt(w)} i dokładaj powtórzenia do ${cap}.`);
        return { ...r, alternativeKg: next };
      }
      return res('increase', next, `${p.repMin}–${p.repMax}`, `Dwa treningi po ${cap} powtórzeń: +${fmt(next - w)} (+${Math.round(pct * 100)}%), zacznij od ${p.repMin} powtórzeń.`);
    }
    return res('increase', next, `${p.repMin}–${p.repMax}`, `${twice ? 'Dwa treningi' : 'Trening'} na górze zakresu: +${fmt(next - w)}.`);
  }
  // za mało serii albo powtórzeń: najpierw powtórzenia
  if (s0.length < p.plannedSets) return res('reps', w, range, `Ten sam ciężar; zrób wszystkie ${p.plannedSets} serie.`);
  const missing = s0.filter((s) => s.reps < p.repMax).length;
  return res('reps', w, range, `Ten sam ciężar; dołóż 1 powtórzenie w ${missing === s0.length ? 'każdej serii' : `${missing} seriach`} (do ${p.repMax}).`);
}

/** Zgodność wstecz: dawne wywołanie z jedną sesją (bez daty = bez oceny przerwy). */
export function suggestNext(p: {
  last: SetResult[] | undefined; plannedSets: number; repMin: number; repMax: number; increment: number;
  technique?: 'ok' | 'bad'; safetyBlock: boolean; minRir?: number;
}): Suggestion {
  return suggestProgression({ history: p.last?.length ? [{ date: '2000-01-01', sets: p.last, technique: p.technique }] : [], today: '2000-01-01', plannedSets: p.plannedSets, repMin: p.repMin, repMax: p.repMax, step: p.increment, safetyBlock: p.safetyBlock });
}

/** Pierwsze 2 tygodnie: 2 serie; tydz. 3–4: docelowe serie. */
export function plannedSetsFor(templateSets: number, weekIndex: number): number {
  return weekIndex < 2 ? Math.min(2, templateSets) : templateSets;
}

// ---- jednostki i skoki obciążenia ----
export type WeightUnit = 'kg' | 'lb';
export const LB = 0.45359237;
export type LoadEquip = 'dumbbell' | 'machine' | 'cable' | 'barbell';
/** Domyślne najmniejsze skoki w jednostce użytkownika. */
export const DEFAULT_STEPS: Record<WeightUnit, Record<LoadEquip, number>> = {
  kg: { dumbbell: 2, machine: 2.5, cable: 2.5, barbell: 2.5 },
  lb: { dumbbell: 5, machine: 5, cable: 5, barbell: 5 },
};
export const toDisplay = (kg: number, u: WeightUnit) => (u === 'kg' ? Math.round(kg * 100) / 100 : Math.round((kg / LB) * 2) / 2);
export const fromDisplay = (v: number, u: WeightUnit) => (u === 'kg' ? v : v * LB);
export const fmtWeight = (kg: number, u: WeightUnit) => `${String(toDisplay(kg, u)).replace('.', ',')} ${u}`;

/**
 * Skok obciążenia dla ćwiczenia (kg): ustawienie użytkownika dla rodzaju sprzętu, inaczej wartość z karty ćwiczenia.
 * Ćwiczenia bez obciążenia (increment 0) zostają bez skoku.
 */
export function loadStepKg(ex: { increment: number; equip?: string[] }, unit: WeightUnit, steps?: Partial<Record<LoadEquip, number>>): number {
  if (!ex.increment) return 0;
  const eq = (ex.equip ?? []).find((e): e is LoadEquip => ['dumbbell', 'machine', 'cable', 'barbell'].includes(e));
  const user = eq ? steps?.[eq] : undefined;
  if (user && user > 0) return fromDisplay(user, unit);
  return unit === 'kg' ? ex.increment : fromDisplay(eq ? DEFAULT_STEPS.lb[eq] : 5, 'lb');
}
