import type { SafetyAlert, SafetyLevel } from './safety';
import type { PlanLevel } from './readiness';
import { suppression } from './feedback';
import type { LocalDate } from './dates';
import type { RecommendationFeedback } from './types';

/**
 * NextBestAction: jedna najważniejsza rzecz na dziś (ekran Dzisiaj).
 * Kolejność stała i testowalna; alert zdrowotny zawsze wygrywa, zwykłą sugestię można odłożyć (feedback `nba_<rodzaj>`).
 */
export type NbaKind = 'health' | 'training_block' | 'resume_workout' | 'return' | 'start_workout' | 'weekly_report' | 'log_food' | 'recovery' | 'coach' | 'walk';
export type NbaTarget = 'training' | 'food' | 'weekly' | 'return' | 'none';
export interface NextAction {
  kind: NbaKind;
  title: string;
  text: string;
  cta?: { label: string; target: NbaTarget };
  importance: 'urgent' | 'high' | 'normal' | 'low';
  /** skąd pochodzi rekomendacja (wyświetlane po rozwinięciu) */
  source: string;
  dismissible: boolean;
  /** identyfikator do feedbacku (odłożenie / pamięć odrzuconych) */
  recId: string;
}

export interface NbaRec { id: string; title: string; action: string; basis?: string; health?: boolean }
export interface NbaInput {
  today: LocalDate;
  /** godzina lokalna 0–23 */
  hour: number;
  safetyLevel: SafetyLevel;
  alerts: SafetyAlert[];
  inProgress?: { templateId: string };
  todayWorkout?: { templateId: string };
  doneToday: boolean;
  /** gotowość tylko gdy był poranny check-in; brak = nie zgadujemy */
  readiness?: PlanLevel;
  sleepMinutes?: number;
  entriesToday: number;
  returnMode: boolean;
  weeklyDue: boolean;
  /** porada coacha już przefiltrowana przez pickRecommendation */
  rec?: NbaRec;
  feedback: RecommendationFeedback[];
}

/** Od tej godziny brak wpisów jedzenia staje się sugestią (wcześniej wiele osób jeszcze nie jadło albo nie zapisuje śniadania od razu). */
export const LOG_FOOD_FROM_HOUR = 11;
export const SHORT_SLEEP_MIN = 6 * 60;

export function nextBestAction(i: NbaInput): NextAction | undefined {
  const hidden = (recId: string) => suppression(recId, i.feedback, i.today, {}).hidden;
  const accepted = (recId: string) => i.feedback.some((f) => f.recId === recId && f.date === i.today && f.action === 'accepted');
  const out: NextAction[] = [];
  const add = (a: Omit<NextAction, 'recId'> & { recId?: string }) => out.push({ ...a, recId: a.recId ?? `nba_${a.kind}` });

  // 1. pilne zagrożenie zdrowotne
  const urgent = i.alerts.find((a) => a.level === 'urgent');
  if (i.safetyLevel === 'urgent' || urgent) {
    return { kind: 'health', title: urgent?.title ?? 'Najpierw zdrowie', text: urgent?.text ?? 'Dziś bez treningu. W razie potrzeby zadzwoń pod 112.', importance: 'urgent', source: 'Blokady bezpieczeństwa (objawy z check-inu)', dismissible: false, recId: 'nba_health' };
  }
  // 2. istotna blokada treningowa (tylko gdy dotyczy dzisiejszego treningu)
  const legs = i.alerts.find((a) => a.level === 'stop_legs');
  if (legs && (i.todayWorkout || i.inProgress) && !i.doneToday) {
    add({ kind: 'training_block', title: legs.title, text: `${legs.text} Ćwiczenia obciążające nogi są dziś zablokowane.`, cta: { label: 'Zobacz trening', target: 'training' }, importance: 'high', source: 'Blokady bezpieczeństwa', dismissible: false });
  }
  // 3. trening w trakcie
  if (i.inProgress) add({ kind: 'resume_workout', title: `Dokończ trening ${i.inProgress.templateId}`, text: 'Zapisane serie są bezpieczne. Wracasz tam, gdzie skończyłeś.', cta: { label: 'Wznów', target: 'training' }, importance: 'high', source: 'Rozpoczęta sesja treningowa', dismissible: false });
  // powrót po przerwie: zanim zaproponujemy cokolwiek innego
  if (i.returnMode && !accepted('return')) add({ kind: 'return', recId: 'return', title: 'Dobrze, że jesteś', text: 'Zaczynamy od dzisiaj. Historia zostaje, nie musisz niczego nadrabiać.', cta: { label: 'Wracam', target: 'return' }, importance: 'normal', source: 'Brak wpisów przez kilka dni', dismissible: true });
  // raport tygodnia (tylko w swoim oknie czasowym; ma własne „Jutro”). Przed treningiem, bo trening i tak widać w kafelku ruchu
  if (i.weeklyDue) add({ kind: 'weekly_report', title: 'Raport tygodnia', text: '4 pytania, ok. 30 s.', cta: { label: 'Wypełnij', target: 'weekly' }, importance: 'normal', source: 'Raport tygodnia', dismissible: false });
  // 4. zaplanowany trening, jeśli wykonalny (plan C = odpoczynek)
  if (i.todayWorkout && !i.doneToday && !i.inProgress && i.readiness !== 'C') {
    const short = i.readiness === 'B';
    const lowSleep = i.sleepMinutes !== undefined && i.sleepMinutes < SHORT_SLEEP_MIN;
    const caution = i.alerts.find((a) => a.level === 'caution_legs');
    const text = caution ? `${caution.title}: ${caution.text}`
      : lowSleep ? 'Krótki sen tej nocy. Zrób trening, ale bez zwiększania obciążenia.'
      : short ? 'Trudniejszy dzień: krótsza wersja (2 serie) wystarczy.'
      : 'Zacznij od spokojnej rozgrzewki, reszta prowadzi krok po kroku.';
    add({ kind: 'start_workout', title: `Dzisiaj trening ${i.todayWorkout.templateId}${short ? ' w krótszej wersji' : ''}`, text, cta: { label: 'Rozpocznij', target: 'training' }, importance: 'normal', source: 'Planer tygodniowy', dismissible: true });
  }
  // 5. zapisanie jedzenia
  if (i.entriesToday === 0 && i.hour >= LOG_FOOD_FROM_HOUR) add({ kind: 'log_food', title: 'Dodaj pierwszy posiłek', text: 'Wystarczy to, co pamiętasz. Brak wpisu nie znaczy, że nic nie było.', cta: { label: 'Dodaj jedzenie', target: 'food' }, importance: 'normal', source: 'Dziennik jedzenia', dismissible: true });
  // 6. regeneracja
  if (i.readiness === 'C') add({ kind: 'recovery', title: 'Dzień regeneracji', text: 'Odpoczynek jest częścią planu. Zadbaj dzisiaj o podstawy: regularne posiłki i wodę.', importance: 'normal', source: 'Poranny check-in', dismissible: true });
  // 7. porada z historii (coach + pamięć odrzuconych porad)
  if (i.rec && i.rec.id !== 'return') add({ kind: 'coach', recId: i.rec.id, title: i.rec.title, text: i.rec.action, importance: i.rec.health ? 'high' : 'low', source: i.rec.basis ?? 'Historia ostatnich dni', dismissible: true });
  // 8. neutralna zachęta
  add({ kind: 'walk', title: 'Krótki spacer', text: '10–15 minut spaceru to dobry, prosty ruch na dziś.', importance: 'low', source: 'Ogólna zachęta do ruchu', dismissible: true });

  return out.find((a) => !a.dismissible || a.kind === 'coach' || !hidden(a.recId));
}

/** Krótki opis dnia po porannym check-inie (bez nazw A/B/C na ekranie głównym). Bez check-inu: brak opisu. */
export const DAY_MESSAGE: Record<PlanLevel, string> = {
  A: 'Masz dziś energię. Realizujemy zwykły plan.',
  B: 'Możesz dziś zrobić mniej. Wybierzmy prostszy wariant.',
  C: 'Odpoczynek jest częścią planu. Zadbaj dzisiaj o podstawy.',
};
