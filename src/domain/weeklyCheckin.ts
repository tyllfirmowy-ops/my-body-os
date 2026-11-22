import { addDays, mondayOf, type LocalDate } from './dates';

export type DietFeel = 'easy' | 'ok' | 'hard';
export type KneeFeel = 'none' | 'mild' | 'clear';
export type WeekChange = 'simpler_meals' | 'fewer_workouts' | 'nothing';

/** Raport tygodnia: tylko to, czego aplikacja nie zmierzy sama. id = poniedziałek ocenianego tygodnia. */
export interface WeeklyCheckin {
  id: LocalDate;
  weekStart: LocalDate;
  mood: 1 | 2 | 3 | 4 | 5;
  diet: DietFeel;
  hunger: boolean;
  /** tylko gdy w ankiecie zdrowotnej zgłoszono kolano */
  knee?: KneeFeel;
  changes: WeekChange[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export const REMIND = { sundayHour: 20, laterHour: 12 } as const;

const pad = (n: number) => String(n).padStart(2, '0');
/** Data lokalna (YYYY-MM-DD) i godzina z obiektu Date w strefie urządzenia. */
export function localParts(now: Date): { date: LocalDate; hour: number } {
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, hour: now.getHours() };
}

/**
 * Za który tydzień należy się raport i czy pokazać przypomnienie teraz.
 * Niedziela od 20:00: raport za kończący się tydzień. Od poniedziałku: raport za poprzedni tydzień,
 * przypomnienie od 12:00, raz dziennie (można odłożyć do jutra), aż do wypełnienia albo kolejnej niedzieli 20:00.
 * Nowy użytkownik: bez przypomnienia za tydzień sprzed założenia konta.
 */
export function reportDue(now: Date, checkins: { id: LocalDate }[], opts: { startedOn?: LocalDate; snoozedOn?: LocalDate } = {}): { weekStart: LocalDate; show: boolean } {
  const { date, hour } = localParts(now);
  const isSunday = new Date(`${date}T12:00:00`).getDay() === 0;
  const weekStart = isSunday && hour >= REMIND.sundayHour ? mondayOf(date) : addDays(mondayOf(date), -7);
  const done = checkins.some((c) => c.id === weekStart);
  const tooNew = !!opts.startedOn && opts.startedOn > addDays(weekStart, 6);
  const isTheSunday = date === addDays(weekStart, 6);
  const timeOk = isTheSunday ? hour >= REMIND.sundayHour : hour >= REMIND.laterHour;
  return { weekStart, show: !done && !tooNew && timeOk && opts.snoozedOn !== date };
}

/** Co z raportu wynika. Każda odpowiedź ma skutek; zmiany planu dalej wymagają zgody użytkownika. */
export interface CheckinEffects {
  /** wejście silnika dopasowania kalorii: blokuje obniżkę, może dać propozycję podniesienia */
  strongHunger: boolean;
  /** propozycja: cel 2 treningi w najbliższym tygodniu */
  lighterWeek: boolean;
  /** ćwiczenia obciążające kolano bez dokładania ciężaru w najbliższym tygodniu + sugestia konsultacji */
  kneeCaution: boolean;
  /** podpowiedzi posiłków: najpierw najszybsze */
  simplerMeals: boolean;
  lines: string[];
}

export function checkinEffects(c: WeeklyCheckin | undefined): CheckinEffects {
  if (!c) return { strongHunger: false, lighterWeek: false, kneeCaution: false, simplerMeals: false, lines: [] };
  const strongHunger = c.diet === 'hard' && c.hunger;
  const lighterWeek = c.mood <= 2 || c.changes.includes('fewer_workouts');
  const kneeCaution = c.knee === 'clear';
  const simplerMeals = c.changes.includes('simpler_meals');
  const lines: string[] = [];
  if (strongHunger) lines.push('Dieta była ciężka i z głodem: aplikacja nie zaproponuje obniżki kalorii, a przy szybkim spadku wagi może zaproponować podniesienie (do Twojej akceptacji).');
  else if (c.diet === 'hard') lines.push('Dieta była ciężka: w podpowiedziach posiłków najpierw te bardziej sycące i proste.');
  if (lighterWeek) lines.push('Lżejszy tydzień: możesz ustawić cel 2 treningi. To nadal minimum zaleceń.');
  if (kneeCaution) lines.push('Kolano wyraźnie bolało: w ćwiczeniach obciążających kolano bez dokładania ciężaru. Jeśli ból wraca, skonsultuj go ze specjalistą.');
  if (simplerMeals && !lines.some((l) => l.includes('posiłków'))) lines.push('Podpowiedzi posiłków: najpierw najszybsze przepisy.');
  if (!lines.length) lines.push('Bez zmian: plan zostaje taki, jaki jest.');
  return { strongHunger, lighterWeek, kneeCaution, simplerMeals: simplerMeals || c.diet === 'hard', lines };
}

/** Ostatni raport, który obowiązuje teraz (za poprzedni albo bieżący tydzień). */
export function activeCheckin<T extends { weekStart: LocalDate }>(checkins: T[], today: LocalDate): T | undefined {
  const from = addDays(mondayOf(today), -7);
  return checkins.filter((c) => c.weekStart >= from).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
}

/** Wydarzenie cykliczne do kalendarza (niedziela 20:30, powiadomienie o czasie). */
export function reminderIcs(firstSunday: LocalDate, url: string): string {
  const d = firstSunday.replace(/-/g, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Body OS//PL', 'BEGIN:VEVENT', `UID:mybodyos-weekly-${d}@local`, `DTSTAMP:${d}T000000Z`,
    `DTSTART;TZID=Europe/Warsaw:${d}T203000`, `DTEND;TZID=Europe/Warsaw:${d}T204000`, 'RRULE:FREQ=WEEKLY;BYDAY=SU', 'SUMMARY:My Body OS: raport tygodnia',
    `DESCRIPTION:4 krótkie pytania (ok. 30 s). ${url}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Raport tygodnia', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
