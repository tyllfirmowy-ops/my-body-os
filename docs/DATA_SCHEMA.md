# Schemat danych (Dexie v1, typy w src/domain/types.ts)

Tabele: profile, health, plans (PlanVersion, historia zmian), morning, evening (klucz = data lokalna), measurements, foods, entries (FoodEntry ze snapshotem wartości), water, sessions, sets, custody, overrides, symptoms, labs, feedback, settings.
Jednostki: kg, cm, g, ml, min, kcal. Daty: 'YYYY-MM-DD' w Europe/Warsaw. Rekordy: id, createdAt, updatedAt, source.
Pola opcjonalne = brak danych (nigdy 0 zastępczo). Waga dzienna = check-in, w razie braku pomiar.
Encje ze specyfikacji jeszcze nieobecne jako tabele: ProgressPhoto, Recipe, MealPlan, ShoppingList (liczona w locie), CardioSession (pole cardioMin w sesji), SupplementLog, WeeklyReview (liczony w locie), NotificationPreferences, BackupMetadata (pole w settings).

v0.3: Nutrients ma opcjonalne sugar/satFat/salt; FoodProduct: barcode, brand, ingredients; PlanVersion: cycling, rules (insulinResistance, dairyFree). Bez zmiany schematu Dexie (pola nieindeksowane).
v0.4: Dexie version(2) – upgrade oznacza stare szybkie wpisy (productId 'quick') polem unknown; FoodEntry.unknown?: MacroKey[]; EveningCheckIn.foodLogComplete?; PlanRules.insulinResistance.shiftExcessToFat?. Import kopii stosuje migrateEntryV2.
v0.5: WorkoutSession.substitutions?: Record<slot, exerciseId> (slot = id ćwiczenia z szablonu); WorkoutSet.slot?: string (miejsce w planie), exerciseId = ćwiczenie faktycznie wykonane. Bez nowej wersji Dexie (pola nieindeksowane). Stare dane i kopie bez `slot` traktowane jako slot = exerciseId; import starych kopii działa bez migracji. Historyczne id ćwiczeń bez zmian (w tym box_step_up).
