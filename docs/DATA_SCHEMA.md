# Schemat danych (Dexie v1, typy w src/domain/types.ts)

Tabele: profile, health, plans (PlanVersion, historia zmian), morning, evening (klucz = data lokalna), measurements, foods, entries (FoodEntry ze snapshotem wartości), water, sessions, sets, custody, overrides, symptoms, labs, feedback, settings.
Jednostki: kg, cm, g, ml, min, kcal. Daty: 'YYYY-MM-DD' w Europe/Warsaw. Rekordy: id, createdAt, updatedAt, source.
Pola opcjonalne = brak danych (nigdy 0 zastępczo). Waga dzienna = check-in, w razie braku pomiar.
Encje ze specyfikacji jeszcze nieobecne jako tabele: ProgressPhoto, Recipe, MealPlan, ShoppingList (liczona w locie), CardioSession (pole cardioMin w sesji), SupplementLog, WeeklyReview (liczony w locie), NotificationPreferences, BackupMetadata (pole w settings).
