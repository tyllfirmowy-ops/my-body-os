# My Body OS

Osobista aplikacja do redukcji, treningu FBW, żywienia i zdrowia. Działa lokalnie w przeglądarce (IndexedDB), offline, bez konta.

## Uruchomienie
```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:5173
npm test             # testy logiki (Vitest)
npm run build        # PWA do dist/ (z service workerem i manifestem)
npm run build:single # jeden plik HTML do dist-single/
```

## Instalacja na iPhonie (pełne PWA, offline)
1. Wrzuć `dist/` na darmowy hosting statyczny z HTTPS (np. Netlify Drop, Cloudflare Pages, GitHub Pages).
2. Otwórz adres w Safari → Udostępnij → „Do ekranu początkowego”.
3. Przy pierwszym uruchomieniu wczytaj prywatny plik `hubert-profile.json` (nie trzymaj go w repo).

## Kopia zapasowa
Zdrowie → Kopia zapasowa → Eksport (opcjonalnie z hasłem, AES-GCM). Zapisz plik w Plikach/iCloud. Import zastępuje dane.
Dane przeglądarki mogą zniknąć (czyszczenie Safari, brak miejsca, ~7 dni nieużywania strony w Safari bez instalacji PWA). Rób eksport co tydzień; aplikacja przypomina.

## Prywatność
Brak telemetrii, reklam i wysyłania danych. Raport dla AI tylko kopiujesz ręcznie. Aplikacja nie jest wyrobem medycznym.
