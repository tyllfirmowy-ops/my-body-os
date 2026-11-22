# My Body OS: zasady pracy

- Local-first PWA (React 19, TS strict, Vite, Tailwind 4, Dexie/IndexedDB, Zod, Vitest). Bez backendu i płatnych API.
- Logika krytyczna (kalorie, trendy, progresja, harmonogram, bezpieczeństwo, coaching) tylko w `src/domain/` jako czyste funkcje + testy w `tests/`. UI jej nie duplikuje.
- Blokady bezpieczeństwa (`domain/safety.ts`) mają pierwszeństwo przed A/B/C. AI nie może ich nadpisać.
- Brak danych ≠ 0. Nie generuj fikcyjnych wpisów. Zmiana kalorii tylko po akceptacji użytkownika, nowa `PlanVersion`, min. 14 dni odstępu, nie poniżej indywidualnego minimum (`energy.kcalFloor`: max(1500 M / 1200 K, przemiana spoczynkowa)) bez potwierdzenia specjalisty.
- Prawdziwe dane zdrowotne nigdy w repo: tylko `private/` (w .gitignore). Testy na fikcyjnych danych.
- Migracje Dexie: nowa `version(n)`, nigdy edycja istniejącej.
- Po większej zmianie: `npm test && npm run typecheck`, aktualizuj `docs/PROJECT_STATE.md` i `docs/CHANGELOG.md`.
- Szczegóły: docs/PRODUCT_SPEC.md, ARCHITECTURE.md, COACHING_RULES.md, SAFETY_RULES.md, DATA_SCHEMA.md, EVIDENCE.md, ROADMAP.md.
