/**
 * Pozy do animacji ćwiczeń (widok z boku, viewBox 200×160, podłoga y=150).
 * A = pozycja wyjściowa. effort: w którą stronę jest faza wysiłku (wydech).
 */
export type P = [number, number];
export interface Pose { head: P; neck: P; sh: P; el: P; ha: P; hip: P; kn: P; an: P; to: P }
export type Prop =
  | { t: 'rect'; x: number; y: number; w: number; h: number }
  | { t: 'line'; a: P; b: P }
  | { t: 'db' } | { t: 'bar'; w: number } | { t: 'cable'; from: P } | { t: 'roller' } | { t: 'mat' };
export interface Anim {
  A: Pose; B: Partial<Pose>; effort: 'AtoB' | 'BtoA'; props: Prop[]; mirror?: boolean;
  effortLabel: string; returnLabel: string; holdB?: number; startCue: string; watch: string;
}

const legsStand = { hip: [100, 88] as P, kn: [101, 118] as P, an: [100, 148] as P, to: [110, 150] as P };

export const ANIMS: Record<string, Anim> = {
  machine_press: {
    A: { head: [70, 46], neck: [70, 56], sh: [70, 64], el: [60, 80], ha: [88, 68], hip: [70, 105], kn: [100, 106], an: [100, 142], to: [110, 145] },
    B: { el: [99, 66], ha: [128, 66] }, effort: 'AtoB',
    props: [{ t: 'rect', x: 56, y: 52, w: 6, h: 58 }, { t: 'rect', x: 56, y: 108, w: 46, h: 6 }, { t: 'rect', x: 66, y: 114, w: 6, h: 36 }, { t: 'bar', w: 4 }],
    effortLabel: 'WYDECH · wypychaj', returnLabel: 'WDECH · wracaj 2–3 s', startCue: 'Plecy i łopatki przy oparciu, uchwyty na wysokości środka klatki, stopy płasko.', watch: 'Nie odrywaj pleców, nie prostuj łokci „na zamek”.',
  },
  lat_pulldown: {
    A: { head: [90, 50], neck: [90, 60], sh: [90, 68], el: [97, 44], ha: [100, 22], hip: [90, 110], kn: [120, 110], an: [120, 145], to: [128, 147] },
    B: { head: [87, 51], neck: [88, 61], sh: [87, 69], el: [80, 90], ha: [104, 68] }, effort: 'AtoB',
    props: [{ t: 'cable', from: [100, 0] }, { t: 'bar', w: 40 }, { t: 'rect', x: 75, y: 112, w: 40, h: 6 }, { t: 'rect', x: 112, y: 100, w: 18, h: 7 }],
    effortLabel: 'WYDECH · łokcie w dół', returnLabel: 'WDECH · ręce w górę powoli', startCue: 'Wałki na udach, chwyt nieco szerzej niż barki, ramiona wyprostowane.', watch: 'Najpierw ściągnij łopatki, drążek do górnej części klatki, bez bujania.',
  },
  db_rdl: {
    A: { head: [101, 35], neck: [100, 44], sh: [100, 50], el: [101, 68], ha: [102, 86], ...legsStand, kn: [103, 117] },
    B: { head: [136, 63], neck: [128, 66], sh: [123, 70], el: [124, 94], ha: [125, 116], hip: [82, 88], kn: [105, 118] }, effort: 'BtoA',
    props: [{ t: 'db' }], effortLabel: 'WYDECH · biodra w przód', returnLabel: 'WDECH · biodra w tył', startCue: 'Stopy na szerokość bioder, kolana lekko ugięte, plecy proste, hantle przy udach.', watch: 'Plecy cały czas proste, hantle blisko nóg, kolana nie uginają się bardziej.',
  },
  box_step_up: {
    A: { head: [105, 37], neck: [104, 46], sh: [104, 52], el: [116, 62], ha: [128, 60], hip: [102, 88], kn: [108, 118], an: [110, 148], to: [120, 150] },
    B: { head: [107, 60], neck: [103, 68], sh: [100, 72], el: [114, 80], ha: [127, 77], hip: [80, 102], kn: [110, 106] }, effort: 'BtoA',
    props: [{ t: 'rect', x: 58, y: 104, w: 34, h: 46 }], effortLabel: 'WYDECH · wstań', returnLabel: 'WDECH · siadaj powoli',
    startCue: 'Stań tyłem do wysokiej ławki, stopy na szerokość barków, ręce przed sobą.', watch: 'Kolana nad stopami (nie do środka), dotknij ławki bez opadania. Ból kolana > 3/10 = przerwij.',
  },
  lateral_raise: {
    A: { head: [100, 30], neck: [100, 40], sh: [113, 46], el: [117, 68], ha: [119, 88], hip: [107, 88], kn: [108, 118], an: [108, 148], to: [113, 150] },
    B: { el: [135, 47], ha: [155, 49] }, effort: 'AtoB', mirror: true,
    props: [{ t: 'db' }], effortLabel: 'WYDECH · bokiem w górę', returnLabel: 'WDECH · opuszczaj powoli', holdB: 0.6,
    startCue: 'Stań prosto, hantle przy biodrach, łokcie lekko ugięte.', watch: 'Do wysokości barków, nie wyżej. Bez bujania tułowiem.',
  },
  db_curl: {
    A: { head: [101, 35], neck: [100, 44], sh: [100, 50], el: [101, 72], ha: [104, 94], ...legsStand },
    B: { ha: [114, 54] }, effort: 'AtoB', props: [{ t: 'db' }], effortLabel: 'WYDECH · uginaj', returnLabel: 'WDECH · prostuj powoli',
    startCue: 'Stań prosto, łokcie przy tułowiu, hantle w dłoniach.', watch: 'Łokcie nie wędrują do przodu, bez bujania.',
  },
  dead_bug: {
    A: { head: [52, 138], neck: [62, 141], sh: [70, 142], el: [71, 120], ha: [72, 98], hip: [115, 142], kn: [116, 116], an: [139, 116], to: [142, 110] },
    B: { el: [52, 130], ha: [34, 134], kn: [140, 133], an: [165, 139], to: [169, 134] }, effort: 'AtoB',
    props: [{ t: 'mat' }], effortLabel: 'WYDECH · prostuj rękę i nogę', returnLabel: 'WDECH · wróć, zmień stronę',
    startCue: 'Leżysz na plecach, ręce w górze, biodra i kolana zgięte pod kątem 90°.', watch: 'Lędźwie przyklejone do maty przez cały ruch.',
  },
  incline_db_press: {
    A: { head: [64, 84], neck: [70, 88], sh: [76, 92], el: [70, 112], ha: [82, 88], hip: [112, 112], kn: [138, 110], an: [141, 148], to: [151, 150] },
    B: { el: [80, 68], ha: [83, 44] }, effort: 'AtoB',
    props: [{ t: 'line', a: [56, 96], b: [122, 118] }, { t: 'rect', x: 108, y: 116, w: 22, h: 6 }, { t: 'rect', x: 92, y: 120, w: 6, h: 30 }, { t: 'db' }],
    effortLabel: 'WYDECH · wypychaj', returnLabel: 'WDECH · opuszczaj 2–3 s', startCue: 'Ławka ~30°, łopatki ściągnięte, stopy na podłodze, hantle nad klatką.', watch: 'Łokcie ok. 45° od tułowia, nie odbijaj hantli.',
  },
  seated_row: {
    A: { head: [73, 74], neck: [72, 84], sh: [72, 90], el: [100, 98], ha: [126, 104], hip: [70, 125], kn: [100, 110], an: [126, 124], to: [129, 117] },
    B: { el: [58, 100], ha: [90, 106] }, effort: 'AtoB',
    props: [{ t: 'cable', from: [170, 108] }, { t: 'rect', x: 50, y: 128, w: 40, h: 6 }, { t: 'rect', x: 131, y: 108, w: 6, h: 30 }, { t: 'bar', w: 6 }],
    effortLabel: 'WYDECH · przyciągnij', returnLabel: 'WDECH · oddaj powoli', startCue: 'Stopy na podestach, kolana lekko ugięte, tułów pionowo.', watch: 'Najpierw ściągnij łopatki, tułów się nie buja.',
  },
  hip_thrust: {
    A: { head: [47, 141], neck: [55, 143], sh: [62, 144], el: [78, 147], ha: [92, 147], hip: [96, 143], kn: [116, 120], an: [126, 148], to: [136, 150] },
    B: { hip: [96, 116], kn: [119, 108] }, effort: 'AtoB', holdB: 0.8,
    props: [{ t: 'mat' }], effortLabel: 'WYDECH · biodra w górę', returnLabel: 'WDECH · opuszczaj', startCue: 'Leżysz na plecach, stopy blisko pośladków na szerokość bioder.', watch: 'Na górze napnij pośladki, bez wyginania lędźwi.',
  },
  leg_curl: {
    A: { head: [79, 53], neck: [79, 63], sh: [78, 69], el: [86, 86], ha: [96, 100], hip: [80, 105], kn: [114, 106], an: [150, 109], to: [158, 103] },
    B: { an: [108, 140], to: [116, 146] }, effort: 'AtoB',
    props: [{ t: 'rect', x: 66, y: 108, w: 52, h: 6 }, { t: 'rect', x: 66, y: 52, w: 6, h: 58 }, { t: 'roller' }],
    effortLabel: 'WYDECH · uginaj', returnLabel: 'WDECH · prostuj 2–3 s', startCue: 'Oś maszyny na wysokości kolana, wałek nad piętami, biodra dociśnięte.', watch: 'Płynnie, bez szarpania. Ból kolana = mniejszy zakres lub pomiń.',
  },
  triceps_pushdown: {
    A: { head: [101, 35], neck: [100, 44], sh: [100, 50], el: [102, 73], ha: [123, 67], ...legsStand },
    B: { ha: [107, 97] }, effort: 'AtoB', props: [{ t: 'cable', from: [126, 0] }, { t: 'bar', w: 8 }],
    effortLabel: 'WYDECH · prostuj w dół', returnLabel: 'WDECH · wracaj powoli', startCue: 'Stań przodem do wyciągu, łokcie przy tułowiu.', watch: 'Łokcie stoją w miejscu, nie pochylaj się nad linką.',
  },
  pallof_press: {
    A: { head: [101, 35], neck: [100, 44], sh: [100, 50], el: [96, 68], ha: [110, 62], ...legsStand },
    B: { el: [118, 54], ha: [140, 54] }, effort: 'AtoB', holdB: 2,
    props: [{ t: 'cable', from: [40, 56] }, { t: 'rect', x: 30, y: 10, w: 10, h: 140 }],
    effortLabel: 'WYDECH · wypchnij i trzymaj 2 s', returnLabel: 'WDECH · do mostka', startCue: 'Stań bokiem do wyciągu, uchwyt przy mostku, stopy na szerokość barków.', watch: 'Nie daj się obrócić: tułów i biodra przodem.',
  },
};
