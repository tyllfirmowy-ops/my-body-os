import type { Key, Step, V } from '../domain/rig';
import type { Skeleton } from '../domain/rig';

export type RigProp =
  | { t: 'rect'; x: number; y: number; w: number; h: number }
  | { t: 'pad'; a: V; b: V; w: number }
  | { t: 'db' } | { t: 'bar'; w: number } | { t: 'cable'; from: V } | { t: 'roller' } | { t: 'mat' };
export type Joint = keyof Omit<Skeleton, 'curve'>;
export interface Highlight { a: Joint; b: Joint; side: 1 | -1; name: string }
export interface ErrorDef { title: string; detail: string; ghost?: Key; visible: boolean }
export interface AngleMark { key: string; joint: 'knee' | 'elbow' | 'hip'; note: string }
export interface Rig {
  view: 'side' | 'front'; mirror?: boolean; keys: Record<string, Key>; timeline: Step[]; props: RigProp[];
  muscles: Highlight[]; muscleNames: string; errors: ErrorDef[]; angles?: AngleMark[]; benchAngle?: { a: V; b: V; deg: number; note: string };
  reference?: boolean; viewNote: string;
}

const ik = (target: V, bend: 1 | -1) => ({ mode: 'ik' as const, target, bend });
const ang = (a1: number, a2: number) => ({ mode: 'ang' as const, a1, a2 });
/** Typowy cykl: pozycja wyjściowa → faza 1 → pauza → faza 2 → krótka pauza. */
function cycle(start: string, end: string, first: { phase: Step['phase']; label: string; breath: string; dur: number }, second: { phase: Step['phase']; label: string; breath: string; dur: number }, holdLabel: string, hold = 0.5): Step[] {
  return [
    { from: start, to: start, dur: 1.2, phase: 'setup', breath: 'wdech, napnij brzuch', label: 'Pozycja wyjściowa' },
    { from: start, to: end, ...first },
    { from: end, to: end, dur: hold, phase: first.phase === 'eccentric' ? 'bottom' : 'top', breath: 'krótka pauza', label: holdLabel },
    { from: end, to: start, ...second },
    { from: start, to: start, dur: 0.4, phase: first.phase === 'eccentric' ? 'top' : 'bottom', breath: 'swobodnie', label: 'Powtórzenie zakończone' },
  ];
}
const ECC = (label: string, dur = 2.5) => ({ phase: 'eccentric' as const, label, breath: 'wdech, powoli', dur });
const CON = (label: string, dur = 1.5) => ({ phase: 'concentric' as const, label, breath: 'wydech', dur });

export const RIGS: Record<string, Rig> = {
  // ===== WZORCE (zweryfikowane z opisami techniki: NASM, UNMC, Human Kinetics, EliteFTS, CSCCa) =====
  db_rdl: {
    view: 'side', reference: true, viewNote: 'Widok z boku: najlepiej widać zawias w biodrach, linię pleców i tor hantli.',
    keys: {
      top: { hip: [99, 91.5], trunk: -87, arm: ik([104, 103], -1), leg: ik([100, 146], -1) },
      bottom: { hip: [86, 95.5], trunk: -27, arm: ik([104, 124], -1), leg: ik([100, 146], -1) },
    },
    timeline: cycle('top', 'bottom', ECC('Biodra w tył, hantle przy nogach'), CON('Biodra w przód, napnij pośladki'), 'Rozciągnięcie z tyłu ud'),
    props: [{ t: 'db' }],
    muscles: [{ a: 'hip', b: 'knee', side: -1, name: 'dwugłowe ud' }, { a: 'hip', b: 'shoulder', side: 1, name: 'prostowniki grzbietu' }],
    muscleNames: 'Dwugłowe ud i pośladki (główne), prostowniki grzbietu (stabilizacja)',
    errors: [
      { title: 'Okrągłe plecy', detail: 'Plecy mają zostać proste przez cały ruch. Zejdź tylko tak nisko, jak pozwala neutralny kręgosłup.', visible: true,
        ghost: { hip: [86, 95.5], trunk: -18, arm: ik([106, 130], -1), leg: ik([100, 146], -1), curve: -11 } },
      { title: 'Przysiad zamiast zawiasu', detail: 'Kolana uginają się coraz bardziej, a biodra idą w dół zamiast w tył. Kąt w kolanach ma być prawie stały.', visible: true,
        ghost: { hip: [91, 110], trunk: -45, arm: ik([110, 132], -1), leg: ik([100, 146], -1) } },
      { title: 'Hantle daleko od nóg', detail: 'Hantle mają przesuwać się blisko ud i goleni. Daleko od nóg rośnie obciążenie odcinka lędźwiowego.', visible: true,
        ghost: { hip: [86, 95.5], trunk: -27, arm: ang(90, 90), leg: ik([100, 146], -1) } },
    ],
  },
  box_step_up: {
    view: 'side', reference: true, viewNote: 'Widok z boku: tor bioder i ustawienie goleni. Kolana względem stóp (czy nie uciekają do środka) kontroluj w lustrze z przodu.',
    keys: {
      top: { hip: [107, 92], trunk: -86, arm: ang(8, 4), leg: ik([110, 146], -1) },
      bottom: { hip: [88, 103], trunk: -58, arm: ang(-4, -10), leg: ik([110, 146], -1) },
    },
    timeline: cycle('top', 'bottom', ECC('Biodra w tył, siadaj powoli'), CON('Stopy w podłogę, wstań'), 'Dotknij ławki bez rozluźniania', 0.6),
    props: [{ t: 'rect', x: 56, y: 107, w: 36, h: 43 }],
    muscles: [{ a: 'hip', b: 'knee', side: 1, name: 'czworogłowe' }, { a: 'hip', b: 'knee', side: -1, name: 'pośladki' }],
    muscleNames: 'Czworogłowe uda i pośladki (główne), mięśnie brzucha (stabilizacja)',
    errors: [
      { title: 'Kolana uciekają do środka', detail: 'Kolana mają iść w linii palców stóp. Tego nie widać z boku: sprawdź w lustrze z przodu.', visible: false },
      { title: 'Opadanie na ławkę', detail: 'Siadaj kontrolowanie i nie rozluźniaj brzucha na ławce. Opadanie przenosi obciążenie na kolana i kręgosłup.', visible: false },
      { title: 'Kolana mocno do przodu', detail: 'Ruch zaczynasz biodrami w tył. Gdy kolana wyjeżdżają daleko przed palce, rośnie obciążenie kolana.', visible: true,
        ghost: { hip: [97, 108], trunk: -78, arm: ang(-2, -8), leg: ik([110, 146], -1) } },
    ],
    angles: [{ key: 'bottom', joint: 'knee', note: 'Wysoka ławka ogranicza zgięcie: kąt w kolanie zostaje powyżej 90°. Wysokość dobierz do bezbólowego zakresu.' }],
  },
  incline_db_press: {
    view: 'side', reference: true, viewNote: 'Widok z boku: tor hantli i ustawienie przedramion. Kąt łokci od tułowia (~45°) widać tylko z góry lub z przodu.',
    keys: {
      top: { hip: [112, 112], trunk: 210, arm: ik([86, 54], 1), leg: ik([143, 146], -1) },
      bottom: { hip: [112, 112], trunk: 210, arm: ik([93, 91], 1), leg: ik([143, 146], -1) },
    },
    timeline: cycle('top', 'bottom', ECC('Opuszczaj do górnej części klatki'), CON('Wypchnij nad barki'), 'Przedramiona pionowo'),
    props: [{ t: 'pad', a: [110, 117], b: [70, 94], w: 6 }, { t: 'rect', x: 104, y: 117, w: 28, h: 5 }, { t: 'rect', x: 106, y: 122, w: 5, h: 28 }, { t: 'rect', x: 84, y: 112, w: 4, h: 38 }, { t: 'db' }],
    muscles: [{ a: 'shoulder', b: 'hip', side: -1, name: 'klatka (górna część)' }, { a: 'shoulder', b: 'elbow', side: 1, name: 'przednie barki, triceps' }],
    muscleNames: 'Klatka piersiowa, zwłaszcza górna część (główne), przednie aktony barków i triceps',
    errors: [
      { title: 'Łokcie rozłożone na boki (90°)', detail: 'Trzymaj łokcie ok. 45° od tułowia, nie w linii barków. Z boku tego nie widać.', visible: false },
      { title: 'Odbijanie i zbyt szybkie opuszczanie', detail: 'Opuszczaj 2–3 s i nie odbijaj hantli od klatki.', visible: false },
      { title: 'Biodra uniesione z ławki', detail: 'Pośladki i łopatki zostają na ławce, a stopy płasko na podłodze.', visible: true,
        ghost: { hip: [112, 103], trunk: 202, arm: ik([93, 80], 1), leg: ik([143, 146], -1), curve: 5 } },
    ],
    benchAngle: { a: [110, 117], b: [70, 94], deg: 30, note: 'Oparcie ~30° (spotykany zakres 30–45°).' },
  },

  // ===== POZOSTAŁE ĆWICZENIA FBW (ten sam silnik, bez osobnej weryfikacji szczegółów) =====
  machine_press: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      start: { hip: [70, 105], trunk: -90, arm: ik([88, 68], 1), leg: ik([100, 143], -1) },
      end: { hip: [70, 105], trunk: -90, arm: ik([111, 67], 1), leg: ik([100, 143], -1) },
    },
    timeline: cycle('start', 'end', CON('Wypychaj przed siebie'), ECC('Wracaj 2–3 s'), 'Prawie pełny wyprost', 0.4),
    props: [{ t: 'rect', x: 58, y: 52, w: 6, h: 58 }, { t: 'rect', x: 58, y: 108, w: 44, h: 6 }, { t: 'rect', x: 66, y: 114, w: 6, h: 36 }, { t: 'bar', w: 4 }],
    muscles: [{ a: 'shoulder', b: 'hip', side: 1, name: 'klatka' }, { a: 'shoulder', b: 'elbow', side: -1, name: 'triceps' }],
    muscleNames: 'Klatka piersiowa, przednie barki, triceps',
    errors: [
      { title: 'Plecy odrywają się od oparcia', detail: 'Łopatki i plecy przy oparciu przez całą serię.', visible: true, ghost: { hip: [70, 105], trunk: -75, arm: ik([111, 67], 1), leg: ik([100, 143], -1) } },
      { title: 'Łokcie wysoko, w linii barków', detail: 'Łokcie nieco poniżej barków, ok. 45° od tułowia.', visible: false },
      { title: 'Prostowanie łokci „na zamek”', detail: 'Zatrzymaj tuż przed pełnym wyprostem.', visible: false },
    ],
  },
  lat_pulldown: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      top: { hip: [90, 110], trunk: -90, arm: ik([100, 25], 1), leg: ik([120, 146], -1) },
      bottom: { hip: [90, 110], trunk: -80, arm: ik([103, 70], 1), leg: ik([120, 146], -1) },
    },
    timeline: cycle('top', 'bottom', CON('Łokcie w dół, drążek do klatki'), ECC('Ręce w górę, powoli'), 'Łopatki ściągnięte', 0.4),
    props: [{ t: 'cable', from: [100, 0] }, { t: 'bar', w: 40 }, { t: 'rect', x: 75, y: 112, w: 40, h: 6 }, { t: 'rect', x: 108, y: 99, w: 20, h: 7 }],
    muscles: [{ a: 'shoulder', b: 'hip', side: -1, name: 'najszerszy grzbietu' }, { a: 'shoulder', b: 'elbow', side: 1, name: 'biceps' }],
    muscleNames: 'Najszerszy grzbietu, mięśnie między łopatkami, biceps',
    errors: [
      { title: 'Mocne odchylanie do tyłu', detail: 'Lekkie odchylenie jest w porządku, bujanie tułowiem nie.', visible: true, ghost: { hip: [90, 110], trunk: -55, arm: ik([100, 70], 1), leg: ik([120, 146], -1) } },
      { title: 'Ciągnięcie za kark', detail: 'Drążek prowadź przed twarzą do górnej części klatki.', visible: false },
      { title: 'Szarpanie', detail: 'Płynnie w obie strony, bez rzucania ciężarem.', visible: false },
    ],
  },
  lateral_raise: {
    view: 'front', mirror: true, viewNote: 'Widok z przodu.',
    keys: {
      down: { hip: [106, 90], trunk: -90, arm: ang(78, 84), leg: ik([109, 146], 1) },
      up: { hip: [106, 90], trunk: -90, arm: ang(-2, 6), leg: ik([109, 146], 1) },
    },
    timeline: cycle('down', 'up', CON('Bokiem do wysokości barków'), ECC('Opuszczaj powoli'), 'Ręce na wysokości barków', 0.5),
    props: [{ t: 'db' }],
    muscles: [{ a: 'shoulder', b: 'elbow', side: -1, name: 'boczne aktony barków' }],
    muscleNames: 'Boczne aktony mięśni naramiennych',
    errors: [
      { title: 'Bujanie tułowiem', detail: 'Tułów stoi w miejscu, ruch tylko w barkach.', visible: false },
      { title: 'Unoszenie wyżej niż barki', detail: 'Wystarczy do wysokości barków.', visible: true, ghost: { hip: [106, 90], trunk: -90, arm: ang(-38, -32), leg: ik([109, 146], 1) } },
      { title: 'Za ciężkie hantle', detail: 'Zwykle 4–8 kg na start. Technika ważniejsza od ciężaru.', visible: false },
    ],
  },
  db_curl: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      down: { hip: [100, 91.5], trunk: -90, arm: ang(92, 92), leg: ik([100, 146], -1) },
      up: { hip: [100, 91.5], trunk: -90, arm: ang(92, -65), leg: ik([100, 146], -1) },
    },
    timeline: cycle('down', 'up', CON('Uginaj, łokcie przy tułowiu'), ECC('Prostuj powoli'), 'Krótka pauza', 0.3),
    props: [{ t: 'db' }],
    muscles: [{ a: 'shoulder', b: 'elbow', side: 1, name: 'biceps' }],
    muscleNames: 'Biceps, mięśnie przedramienia',
    errors: [
      { title: 'Łokcie wędrują do przodu', detail: 'Łokcie zostają przy tułowiu.', visible: true, ghost: { hip: [100, 91.5], trunk: -90, arm: ang(60, -80), leg: ik([100, 146], -1) } },
      { title: 'Bujanie tułowiem', detail: 'Bez odchylania się do tyłu.', visible: false },
      { title: 'Niepełny wyprost', detail: 'Na dole wyprostuj ręce, ale bez szarpnięcia.', visible: false },
    ],
  },
  dead_bug: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      start: { hip: [115, 140], trunk: 180, arm: ang(-90, -90), leg: ang(-90, 0), foot: -70 },
      ext: { hip: [115, 140], trunk: 180, arm: ang(188, 184), leg: ang(-12, -8), foot: -20 },
    },
    timeline: cycle('start', 'ext', CON('Prostuj rękę i przeciwną nogę'), ECC('Wróć, zmień stronę'), 'Lędźwie przy macie', 0.4),
    props: [{ t: 'mat' }],
    muscles: [{ a: 'hip', b: 'shoulder', side: -1, name: 'mięśnie głębokie brzucha' }],
    muscleNames: 'Mięśnie głębokie brzucha (stabilizacja)',
    errors: [
      { title: 'Lędźwie odrywają się od maty', detail: 'Dociśnij dolną część pleców przez cały ruch. Skróć zakres, jeśli się odrywa.', visible: true, ghost: { hip: [115, 136], trunk: 180, arm: ang(188, 184), leg: ang(-5, 0), foot: -20, curve: 4 } },
      { title: 'Pośpiech', detail: 'Wolno, z wydechem przy prostowaniu.', visible: false },
      { title: 'Wstrzymywanie oddechu', detail: 'Oddychaj spokojnie.', visible: false },
    ],
  },
  seated_row: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      start: { hip: [70, 125], trunk: -86, arm: ik([118, 104], 1), leg: ik([124, 124], -1) },
      end: { hip: [70, 125], trunk: -91, arm: ik([92, 108], 1), leg: ik([124, 124], -1) },
    },
    timeline: cycle('start', 'end', CON('Przyciągnij do brzucha'), ECC('Oddaj powoli'), 'Łopatki ściągnięte', 0.4),
    props: [{ t: 'cable', from: [170, 108] }, { t: 'rect', x: 50, y: 128, w: 40, h: 6 }, { t: 'rect', x: 129, y: 108, w: 6, h: 30 }, { t: 'bar', w: 6 }],
    muscles: [{ a: 'shoulder', b: 'hip', side: -1, name: 'mięśnie grzbietu' }, { a: 'shoulder', b: 'elbow', side: 1, name: 'tylne barki, biceps' }],
    muscleNames: 'Mięśnie grzbietu, tylne barki, biceps',
    errors: [
      { title: 'Bujanie tułowiem', detail: 'Tułów prawie nieruchomy.', visible: true, ghost: { hip: [70, 125], trunk: -60, arm: ik([118, 104], 1), leg: ik([124, 124], -1) } },
      { title: 'Garbienie się', detail: 'Klatka do przodu, plecy proste.', visible: false },
      { title: 'Ciągnięcie samymi rękami', detail: 'Najpierw ściągnij łopatki.', visible: false },
    ],
  },
  hip_thrust: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      down: { hip: [95, 141], trunk: 176.3, head: 180, arm: ang(8, 2), leg: ik([124, 146], -1) },
      up: { hip: [86, 120], trunk: 133.7, head: 180, arm: ang(8, 2), leg: ik([124, 146], -1) },
    },
    timeline: cycle('down', 'up', CON('Biodra w górę'), ECC('Opuszczaj'), 'Napnij pośladki', 0.8),
    props: [{ t: 'mat' }],
    muscles: [{ a: 'hip', b: 'knee', side: -1, name: 'pośladki, dwugłowe' }],
    muscleNames: 'Pośladki, dwugłowe ud',
    errors: [
      { title: 'Przeprost w lędźwiach', detail: 'Na górze napnij pośladki, nie wyginaj pleców.', visible: true, ghost: { hip: [86, 114], trunk: 128, head: 180, arm: ang(8, 2), leg: ik([124, 146], -1), curve: 5 } },
      { title: 'Stopy za daleko', detail: 'Stopy blisko pośladków.', visible: false },
      { title: 'Pchanie przez palce', detail: 'Dociskaj całe stopy, zwłaszcza pięty.', visible: false },
    ],
  },
  leg_curl: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      start: { hip: [80, 105], trunk: -92, arm: ang(70, 30), leg: ang(0, 5), foot: -80 },
      end: { hip: [80, 105], trunk: -92, arm: ang(70, 30), leg: ang(0, 98), foot: 10 },
    },
    timeline: cycle('start', 'end', CON('Uginaj płynnie'), ECC('Prostuj 2–3 s'), 'Krótka pauza', 0.3),
    props: [{ t: 'rect', x: 64, y: 108, w: 50, h: 6 }, { t: 'rect', x: 64, y: 52, w: 6, h: 58 }, { t: 'roller' }],
    muscles: [{ a: 'knee', b: 'ankle', side: -1, name: 'dwugłowe ud' }, { a: 'hip', b: 'knee', side: -1, name: 'dwugłowe ud' }],
    muscleNames: 'Dwugłowe ud',
    errors: [
      { title: 'Szarpanie', detail: 'Płynnie w obie strony.', visible: false },
      { title: 'Unoszenie bioder', detail: 'Biodra dociśnięte do siedziska.', visible: false },
      { title: 'Ból kolana w trakcie', detail: 'Zmniejsz zakres lub pomiń ćwiczenie.', visible: false },
    ],
  },
  triceps_pushdown: {
    view: 'side', viewNote: 'Widok z boku.',
    keys: {
      up: { hip: [100, 91.5], trunk: -93, arm: ang(95, -5), leg: ik([100, 146], -1) },
      down: { hip: [100, 91.5], trunk: -93, arm: ang(95, 88), leg: ik([100, 146], -1) },
    },
    timeline: cycle('up', 'down', CON('Prostuj w dół'), ECC('Wracaj powoli'), 'Pełny wyprost', 0.3),
    props: [{ t: 'cable', from: [126, 0] }, { t: 'bar', w: 8 }],
    muscles: [{ a: 'shoulder', b: 'elbow', side: -1, name: 'triceps' }],
    muscleNames: 'Triceps',
    errors: [
      { title: 'Łokcie odjeżdżają', detail: 'Łokcie stoją przy tułowiu.', visible: true, ghost: { hip: [100, 91.5], trunk: -93, arm: ang(60, 80), leg: ik([100, 146], -1) } },
      { title: 'Pochylanie się nad linką', detail: 'Tułów prawie pionowo.', visible: false },
      { title: 'Za duży ciężar', detail: 'Ruch tylko w łokciach.', visible: false },
    ],
  },
  pallof_press: {
    view: 'side', viewNote: 'Widok z boku. Najważniejsze (brak obrotu tułowia) lepiej widać z góry.',
    keys: {
      in: { hip: [100, 91.5], trunk: -90, arm: ik([110, 62], 1), leg: ik([100, 146], -1) },
      out: { hip: [100, 91.5], trunk: -90, arm: ik([140, 60], 1), leg: ik([100, 146], -1) },
    },
    timeline: cycle('in', 'out', CON('Wypchnij i trzymaj'), ECC('Do mostka'), 'Trzymaj 2 s, nie daj się obrócić', 2),
    props: [{ t: 'cable', from: [40, 60] }, { t: 'rect', x: 30, y: 10, w: 10, h: 140 }],
    muscles: [{ a: 'hip', b: 'shoulder', side: 1, name: 'mięśnie skośne brzucha' }],
    muscleNames: 'Mięśnie brzucha, zwłaszcza skośne (antyrotacja)',
    errors: [
      { title: 'Obrót tułowia', detail: 'Tułów i biodra zostają przodem.', visible: false },
      { title: 'Za duży ciężar', detail: 'Liczy się kontrola, nie ciężar.', visible: false },
      { title: 'Wstrzymywanie oddechu', detail: 'Spokojny oddech w trakcie trzymania.', visible: false },
    ],
  },
};

export const rigFor = (exerciseId: string): Rig | undefined => RIGS[exerciseId];
