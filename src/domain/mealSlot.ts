/**
 * Domyślny posiłek przy szybkim dodawaniu (użytkownik zmienia go jednym dotknięciem).
 * 1) Ostatni wpis dziś sprzed < 90 min → ten sam posiłek (dokładanie składników).
 * 2) Inaczej pora dnia: okno 6:00–22:00 dzielone równo na liczbę posiłków z planu. Przekąska (5) nigdy domyślnie.
 */
export const MEAL_CONTINUE_MS = 90 * 60 * 1000;

export function defaultMeal(at: { hour: number; minute?: number }, mealsPerDay: number, lastToday?: { meal: number; createdAt: number }, nowMs?: number): number {
  const n = Math.max(1, Math.min(4, Math.round(mealsPerDay)));
  if (lastToday && nowMs !== undefined && nowMs - lastToday.createdAt < MEAL_CONTINUE_MS && lastToday.meal >= 1 && lastToday.meal <= 5) return lastToday.meal;
  const h = at.hour + (at.minute ?? 0) / 60;
  if (h < 6) return 1;
  return Math.min(n, Math.floor(((h - 6) / 16) * n) + 1);
}
