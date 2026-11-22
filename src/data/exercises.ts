export type MuscleGroup = 'chest' | 'back_vertical' | 'back_horizontal' | 'hinge' | 'squat' | 'shoulders' | 'biceps' | 'triceps' | 'core' | 'hamstrings' | 'glutes';
export type Equip = 'machine' | 'dumbbell' | 'cable' | 'bench' | 'bodyweight';
export interface ExerciseCard {
  id: string; namePl: string; nameEn: string; muscles: string; equipment: string; setup: string; start: string;
  steps: string[]; breathing: string; mistakes: string[]; loadTip: string; warnings: string;
  knee: 'none' | 'low' | 'moderate'; alternatives: string[]; increment: number; perSide?: boolean;
  group?: MuscleGroup; equip?: Equip[];
  /** id ćwiczeń, na które można zamienić w trakcie treningu (kolejność = preferencja) */
  swapTo?: string[];
}
export interface TemplateExercise { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number; kneeCaution?: boolean }

const LOAD = 'Zacznij lekko. Ciężar jest dobry, gdy po serii czujesz, że zrobiłbyś jeszcze ~3 powtórzenia z dobrą techniką (RIR 3).';

export const EXERCISES: ExerciseCard[] = [
  { id: 'machine_press', namePl: 'Wyciskanie na maszynie', nameEn: 'Machine chest press', muscles: 'Klatka, przednie barki, triceps', equipment: 'Maszyna do wyciskania siedząc',
    setup: 'Siedzisko tak, by uchwyty były na wysokości środka klatki.', start: 'Plecy i łopatki dociśnięte do oparcia, stopy płasko na podłodze.',
    steps: ['Chwyć uchwyty, nadgarstki proste.', 'Wypchnij przed siebie do prawie pełnego wyprostu łokci.', 'Wracaj powoli 2–3 s, aż poczujesz rozciągnięcie klatki.'],
    breathing: 'Wydech przy wypychaniu, wdech przy powrocie.', mistakes: ['Odrywanie pleców od oparcia', 'Zbyt szybki powrót', 'Łokcie wysoko na wysokości barków'],
    loadTip: LOAD, warnings: 'Ból barku: zmniejsz zakres ruchu.', knee: 'none', alternatives: ['Wyciskanie hantli na ławce płaskiej'], increment: 2.5 },
  { id: 'lat_pulldown', namePl: 'Ściąganie drążka wyciągu', nameEn: 'Lat pulldown', muscles: 'Najszerszy grzbietu, biceps', equipment: 'Wyciąg górny z drążkiem',
    setup: 'Wałki ud tak, by blokowały nogi. Chwyt nieco szerzej niż barki.', start: 'Siedzisz prosto, ramiona wyprostowane w górze.',
    steps: ['Ściągnij łopatki w dół.', 'Prowadź drążek do górnej części klatki, łokcie w dół.', 'Wracaj powoli do pełnego wyprostu.'],
    breathing: 'Wydech przy ściąganiu.', mistakes: ['Odchylanie się mocno do tyłu', 'Ciągnięcie za kark', 'Szarpanie'],
    loadTip: LOAD, warnings: '', knee: 'none', alternatives: ['Podciąganie z asystą na maszynie'], increment: 2.5 },
  { id: 'db_rdl', namePl: 'Martwy ciąg rumuński z hantlami', nameEn: 'Dumbbell Romanian deadlift', muscles: 'Dwugłowe ud, pośladki, prostowniki', equipment: 'Hantle',
    setup: 'Stań na szerokość bioder, hantle przed udami.', start: 'Kolana lekko ugięte (stały kąt), plecy neutralne.',
    steps: ['Cofaj biodra do tyłu, hantle przesuwaj blisko nóg.', 'Schodź, aż poczujesz rozciągnięcie z tyłu ud (zwykle do połowy piszczeli).', 'Wypchnij biodra do przodu i wróć do pionu.'],
    breathing: 'Wdech na dole lub przed zejściem, wydech przy powrocie.', mistakes: ['Zaokrąglanie pleców', 'Uginanie kolan jak w przysiadzie', 'Hantle daleko od nóg'],
    loadTip: LOAD, warnings: 'Ból krzyża: zmniejsz ciężar i zakres.', knee: 'low', alternatives: ['Most biodrowy'], increment: 2 },
  { id: 'box_step_up', namePl: 'Siad na wysoką ławkę i wstawanie', nameEn: 'Box squat to high bench', muscles: 'Czworogłowe, pośladki', equipment: 'Wysoka ławka / skrzynia (siad z kolanem powyżej biodra)',
    setup: 'Ławka na tyle wysoka, by po siadzie kąt w kolanie był większy niż 90°.', start: 'Stań tyłem do ławki, stopy na szerokość barków.',
    steps: ['Usiądź powoli, biodra do tyłu.', 'Dotknij ławki bez opadania.', 'Wstań, dociskając całe stopy.'],
    breathing: 'Wdech przy siadaniu, wydech przy wstawaniu.', mistakes: ['Kolana uciekające do środka', 'Opadanie na ławkę', 'Zbyt niska ławka'],
    loadTip: 'Najpierw bez obciążenia. Dodaj hantle dopiero, gdy kolano nie boli w trakcie i następnego dnia.', warnings: 'Ćwiczenie obciąża kolano. Przy bólu ≥3/10 pomiń.', knee: 'moderate', alternatives: ['Most biodrowy', 'Uginanie nóg na maszynie'], increment: 2 },
  { id: 'lateral_raise', namePl: 'Unoszenie hantli bokiem', nameEn: 'Dumbbell lateral raise', muscles: 'Boczne aktony barków', equipment: 'Lekkie hantle',
    setup: '', start: 'Stań prosto, hantle przy biodrach, łokcie lekko ugięte.',
    steps: ['Unoś ramiona bokiem do wysokości barków.', 'Zatrzymaj na chwilę.', 'Opuszczaj powoli.'],
    breathing: 'Wydech przy unoszeniu.', mistakes: ['Bujanie tułowiem', 'Unoszenie wyżej niż barki', 'Za ciężkie hantle'],
    loadTip: 'Zwykle 4–8 kg na start.', warnings: 'Ból barku: mniejszy zakres.', knee: 'none', alternatives: ['Unoszenie bokiem na wyciągu'], increment: 1 },
  { id: 'db_curl', namePl: 'Uginanie ramion z hantlami', nameEn: 'Dumbbell biceps curl', muscles: 'Biceps', equipment: 'Hantle',
    setup: '', start: 'Stań prosto, łokcie przy tułowiu.', steps: ['Ugnij ramiona bez ruszania łokci.', 'Opuszczaj powoli do pełnego wyprostu.'],
    breathing: 'Wydech przy uginaniu.', mistakes: ['Bujanie', 'Wysuwanie łokci do przodu'], loadTip: LOAD, warnings: '', knee: 'none', alternatives: ['Uginanie na wyciągu'], increment: 1 },
  { id: 'dead_bug', namePl: 'Dead bug', nameEn: 'Dead bug', muscles: 'Mięśnie głębokie brzucha', equipment: 'Mata',
    setup: '', start: 'Leżysz na plecach, ręce w górze, biodra i kolana zgięte 90°.',
    steps: ['Dociśnij lędźwie do podłogi.', 'Prostuj przeciwną rękę i nogę.', 'Wróć i zmień stronę.'],
    breathing: 'Wydech przy prostowaniu.', mistakes: ['Odrywanie lędźwi od maty', 'Pośpiech'], loadTip: 'Bez obciążenia.', warnings: '', knee: 'none', alternatives: ['Plank na kolanach'], increment: 0, perSide: true },
  { id: 'incline_db_press', namePl: 'Wyciskanie hantli na ławce skośnej', nameEn: 'Incline dumbbell press', muscles: 'Górna część klatki, barki, triceps', equipment: 'Ławka 30°, hantle',
    setup: 'Oparcie na ~30°.', start: 'Hantle nad klatką, łopatki ściągnięte, stopy na podłodze.',
    steps: ['Opuszczaj hantle do boków klatki, łokcie ~45° od tułowia.', 'Wypchnij w górę.'],
    breathing: 'Wdech w dół, wydech w górę.', mistakes: ['Zbyt stromy kąt', 'Odbijanie hantli'], loadTip: LOAD, warnings: 'Pomoc przy odkładaniu ciężkich hantli.', knee: 'none', alternatives: ['Wyciskanie na maszynie skośnej'], increment: 2 },
  { id: 'seated_row', namePl: 'Wiosłowanie siedząc na wyciągu', nameEn: 'Seated cable row', muscles: 'Plecy, tylne barki, biceps', equipment: 'Wyciąg dolny z uchwytem V',
    setup: 'Stopy na podestach, kolana lekko ugięte.', start: 'Tułów pionowo, ramiona wyprostowane.',
    steps: ['Ściągnij łopatki.', 'Przyciągnij uchwyt do brzucha.', 'Wracaj powoli bez zaokrąglania pleców.'],
    breathing: 'Wydech przy przyciąganiu.', mistakes: ['Bujanie tułowiem', 'Garbienie się'], loadTip: LOAD, warnings: '', knee: 'none', alternatives: ['Wiosłowanie na maszynie'], increment: 2.5 },
  { id: 'hip_thrust', namePl: 'Most biodrowy', nameEn: 'Glute bridge / hip thrust', muscles: 'Pośladki, dwugłowe ud', equipment: 'Mata lub ławka, opcjonalnie sztanga/hantla',
    setup: 'Wersja startowa: leżąc na macie.', start: 'Leżysz na plecach, stopy blisko pośladków.',
    steps: ['Dociśnij stopy, unieś biodra.', 'Na górze napnij pośladki, nie wyginaj lędźwi.', 'Opuść powoli.'],
    breathing: 'Wydech przy unoszeniu.', mistakes: ['Przeprost w lędźwiach', 'Stopy za daleko'], loadTip: 'Najpierw bez obciążenia, potem hantla na biodrach.', warnings: '', knee: 'low', alternatives: ['Odwodzenie bioder na maszynie'], increment: 2.5 },
  { id: 'leg_curl', namePl: 'Uginanie nóg na maszynie', nameEn: 'Machine leg curl', muscles: 'Dwugłowe ud', equipment: 'Maszyna (siedząc lub leżąc)',
    setup: 'Oś maszyny na wysokości kolana, wałek nad piętami.', start: 'Nogi wyprostowane, biodra dociśnięte.',
    steps: ['Ugnij nogi płynnie.', 'Wracaj powoli 2–3 s.'], breathing: 'Wydech przy uginaniu.', mistakes: ['Szarpanie', 'Unoszenie bioder'],
    loadTip: LOAD, warnings: 'Ból kolana w trakcie: zmniejsz zakres lub pomiń.', knee: 'low', alternatives: ['Most biodrowy'], increment: 2.5 },
  { id: 'triceps_pushdown', namePl: 'Prostowanie ramion na wyciągu', nameEn: 'Cable triceps pushdown', muscles: 'Triceps', equipment: 'Wyciąg górny, linka lub drążek',
    setup: '', start: 'Łokcie przy tułowiu.', steps: ['Prostuj ramiona w dół.', 'Wracaj powoli do kąta ~90°.'],
    breathing: 'Wydech przy prostowaniu.', mistakes: ['Ruszanie łokciami', 'Pochylanie się nad linką'], loadTip: LOAD, warnings: '', knee: 'none', alternatives: ['Prostowanie z hantlą nad głową'], increment: 2.5 },
  { id: 'pallof_press', namePl: 'Pallof press', nameEn: 'Pallof press', muscles: 'Mięśnie brzucha (antyrotacja)', equipment: 'Wyciąg na wysokości klatki',
    setup: 'Stań bokiem do wyciągu.', start: 'Uchwyt przy mostku, stopy na szerokość barków.',
    steps: ['Wypchnij uchwyt przed siebie, nie pozwalając się obrócić.', 'Przytrzymaj 2 s.', 'Wróć.'], breathing: 'Spokojny oddech, wydech przy wypchnięciu.',
    mistakes: ['Obracanie tułowia', 'Za duży ciężar'], loadTip: 'Lekki ciężar, liczy się kontrola.', warnings: '', knee: 'none', alternatives: ['Plank'], increment: 1, perSide: true },
];

const LOAD2 = 'Zacznij lekko: po serii mają zostać ~3 powtórzenia w zapasie (RIR 3).';
/** Ćwiczenia zamienne (bez animacji w tej wersji: karta tekstowa + wideo). */
export const ALT_EXERCISES: ExerciseCard[] = [
  { id: 'flat_db_press', namePl: 'Wyciskanie hantli na ławce płaskiej', nameEn: 'Flat dumbbell bench press', muscles: 'Klatka, przednie barki, triceps', equipment: 'Ławka płaska, hantle',
    setup: 'Ławka płaska.', start: 'Leżysz, stopy na podłodze, łopatki ściągnięte, hantle nad klatką.', steps: ['Opuszczaj hantle do boków klatki, łokcie ~45° od tułowia.', 'Wypchnij w górę.'],
    breathing: 'Wdech w dół, wydech w górę.', mistakes: ['Łokcie w linii barków', 'Odbijanie hantli', 'Unoszenie bioder'], loadTip: LOAD2, warnings: '', knee: 'none', alternatives: [], increment: 2 },
  { id: 'incline_machine_press', namePl: 'Wyciskanie na maszynie skośnej', nameEn: 'Incline machine press', muscles: 'Górna część klatki, barki, triceps', equipment: 'Maszyna do wyciskania skośnego',
    setup: 'Siedzisko tak, by uchwyty były na wysokości górnej części klatki.', start: 'Plecy przy oparciu, stopy płasko.', steps: ['Wypchnij uchwyty skośnie w górę.', 'Wracaj 2–3 s.'],
    breathing: 'Wydech przy wypychaniu.', mistakes: ['Odrywanie pleców', 'Łokcie wysoko', 'Zbyt szybki powrót'], loadTip: LOAD2, warnings: '', knee: 'none', alternatives: [], increment: 2.5 },
  { id: 'pushup_incline', namePl: 'Pompki na podwyższeniu', nameEn: 'Incline push-up', muscles: 'Klatka, triceps, mięśnie brzucha', equipment: 'Ławka lub poręcz',
    setup: 'Dłonie na ławce, im wyżej, tym łatwiej.', start: 'Ciało w linii od głowy do pięt.', steps: ['Opuść klatkę do ławki, łokcie ~45°.', 'Wypchnij się w górę.'],
    breathing: 'Wdech w dół, wydech w górę.', mistakes: ['Opadające biodra', 'Łokcie na boki', 'Niepełny zakres'], loadTip: 'Trudność regulujesz wysokością podparcia.', warnings: '', knee: 'none', alternatives: [], increment: 0 },
  { id: 'assisted_pullup', namePl: 'Podciąganie z asystą na maszynie', nameEn: 'Assisted pull-up', muscles: 'Najszerszy grzbietu, biceps', equipment: 'Maszyna do podciągania z asystą',
    setup: 'Większy ciężar asysty = łatwiej. Wpisuj ciężar asysty.', start: 'Kolana na podeście, chwyt nachwytem.', steps: ['Ściągnij łopatki w dół.', 'Podciągnij klatkę do drążka.', 'Opuszczaj powoli.'],
    breathing: 'Wydech przy podciąganiu.', mistakes: ['Bujanie', 'Niepełny zakres', 'Barki przy uszach'], loadTip: 'Progresja = mniejsza asysta.', warnings: '', knee: 'none', alternatives: [], increment: 2.5 },
  { id: 'machine_row', namePl: 'Wiosłowanie na maszynie', nameEn: 'Machine row', muscles: 'Mięśnie grzbietu, tylne barki, biceps', equipment: 'Maszyna do wiosłowania z oparciem na klatkę',
    setup: 'Oparcie tak, by uchwyty były na wysokości dolnej części klatki.', start: 'Klatka przy oparciu, ramiona wyprostowane.', steps: ['Ściągnij łopatki.', 'Przyciągnij uchwyty.', 'Oddaj powoli.'],
    breathing: 'Wydech przy przyciąganiu.', mistakes: ['Odrywanie klatki od oparcia', 'Szarpanie', 'Barki do uszu'], loadTip: LOAD2, warnings: '', knee: 'none', alternatives: [], increment: 2.5 },
  { id: 'db_row', namePl: 'Wiosłowanie hantlą w podporze', nameEn: 'One-arm dumbbell row', muscles: 'Mięśnie grzbietu, biceps', equipment: 'Ławka, hantla',
    setup: 'Ręka i kolano na ławce.', start: 'Plecy proste, równolegle do podłogi.', steps: ['Przyciągnij hantlę do biodra.', 'Opuszczaj powoli.'],
    breathing: 'Wydech przy przyciąganiu.', mistakes: ['Skręcanie tułowia', 'Okrągłe plecy', 'Szarpanie'], loadTip: LOAD2, warnings: 'Kolano na ławce: jeśli uciska bolesne kolano, podeprzyj się samą ręką, stojąc.', knee: 'low', alternatives: [], increment: 2, perSide: true },
  { id: 'back_extension', namePl: 'Wyprosty tułowia na ławce 45°', nameEn: '45° back extension', muscles: 'Pośladki, dwugłowe ud, prostowniki', equipment: 'Ławka rzymska 45°',
    setup: 'Wałek tuż pod biodrami, nie na brzuchu.', start: 'Ciało w linii, ręce skrzyżowane na klatce.', steps: ['Zegnij się w biodrach z prostymi plecami.', 'Wróć do linii prostej, napinając pośladki.'],
    breathing: 'Wdech w dół, wydech w górę.', mistakes: ['Przeprost na górze', 'Okrągłe plecy', 'Szarpanie'], loadTip: 'Najpierw bez obciążenia.', warnings: '', knee: 'none', alternatives: [], increment: 2.5 },
  { id: 'cable_lateral_raise', namePl: 'Unoszenie bokiem na wyciągu', nameEn: 'Cable lateral raise', muscles: 'Boczne aktony barków', equipment: 'Wyciąg dolny',
    setup: 'Uchwyt na dole, stań bokiem.', start: 'Ręka przy biodrze, łokieć lekko ugięty.', steps: ['Unieś bokiem do wysokości barku.', 'Opuszczaj powoli.'],
    breathing: 'Wydech przy unoszeniu.', mistakes: ['Bujanie', 'Za wysoko', 'Za ciężko'], loadTip: 'Lekki ciężar.', warnings: '', knee: 'none', alternatives: [], increment: 1, perSide: true },
  { id: 'cable_curl', namePl: 'Uginanie ramion na wyciągu', nameEn: 'Cable curl', muscles: 'Biceps', equipment: 'Wyciąg dolny z drążkiem',
    setup: 'Drążek na dole.', start: 'Łokcie przy tułowiu.', steps: ['Uginaj ramiona.', 'Prostuj powoli.'], breathing: 'Wydech przy uginaniu.', mistakes: ['Łokcie do przodu', 'Bujanie', 'Niepełny wyprost'], loadTip: LOAD2, warnings: '', knee: 'none', alternatives: [], increment: 2.5 },
  { id: 'overhead_db_extension', namePl: 'Prostowanie ramion z hantlą nad głową', nameEn: 'Overhead dumbbell triceps extension', muscles: 'Triceps', equipment: 'Hantla, ławka z oparciem',
    setup: 'Siedząc z oparciem.', start: 'Hantla nad głową w obu dłoniach.', steps: ['Opuść hantlę za głowę, łokcie w górę.', 'Wyprostuj ramiona.'], breathing: 'Wydech przy prostowaniu.', mistakes: ['Łokcie na boki', 'Przeprost w lędźwiach', 'Za ciężko'], loadTip: LOAD2, warnings: 'Ból barku: wybierz prostowanie na wyciągu.', knee: 'none', alternatives: [], increment: 2 },
  { id: 'plank_knees', namePl: 'Plank na kolanach', nameEn: 'Kneeling plank', muscles: 'Mięśnie brzucha', equipment: 'Mata',
    setup: '', start: 'Przedramiona pod barkami, kolana na macie.', steps: ['Ciało w linii od głowy do kolan.', 'Trzymaj zadany czas.'], breathing: 'Spokojny oddech.', mistakes: ['Opadające biodra', 'Biodra wysoko', 'Wstrzymywanie oddechu'], loadTip: 'Powtórzenia = sekundy trzymania.', warnings: 'Ból kolana przy podporze: podłóż złożoną matę.', knee: 'low', alternatives: [], increment: 0 },
  { id: 'plank', namePl: 'Plank', nameEn: 'Plank', muscles: 'Mięśnie brzucha', equipment: 'Mata',
    setup: '', start: 'Przedramiona pod barkami, ciało w linii.', steps: ['Napnij brzuch i pośladki.', 'Trzymaj zadany czas.'], breathing: 'Spokojny oddech.', mistakes: ['Opadające biodra', 'Biodra wysoko', 'Wstrzymywanie oddechu'], loadTip: 'Powtórzenia = sekundy trzymania.', warnings: '', knee: 'none', alternatives: [], increment: 0 },
];

const META: Record<string, { group: MuscleGroup; equip: Equip[]; swapTo: string[] }> = {
  machine_press: { group: 'chest', equip: ['machine'], swapTo: ['flat_db_press', 'incline_db_press', 'incline_machine_press', 'pushup_incline'] },
  incline_db_press: { group: 'chest', equip: ['dumbbell', 'bench'], swapTo: ['incline_machine_press', 'flat_db_press', 'machine_press', 'pushup_incline'] },
  flat_db_press: { group: 'chest', equip: ['dumbbell', 'bench'], swapTo: [] }, incline_machine_press: { group: 'chest', equip: ['machine'], swapTo: [] }, pushup_incline: { group: 'chest', equip: ['bodyweight', 'bench'], swapTo: [] },
  lat_pulldown: { group: 'back_vertical', equip: ['cable'], swapTo: ['assisted_pullup'] }, assisted_pullup: { group: 'back_vertical', equip: ['machine'], swapTo: [] },
  seated_row: { group: 'back_horizontal', equip: ['cable'], swapTo: ['machine_row', 'db_row'] }, machine_row: { group: 'back_horizontal', equip: ['machine'], swapTo: [] }, db_row: { group: 'back_horizontal', equip: ['dumbbell', 'bench'], swapTo: [] },
  db_rdl: { group: 'hinge', equip: ['dumbbell'], swapTo: ['back_extension', 'hip_thrust', 'leg_curl'] }, back_extension: { group: 'hinge', equip: ['bench'], swapTo: [] },
  box_step_up: { group: 'squat', equip: ['bench', 'bodyweight'], swapTo: ['hip_thrust', 'leg_curl'] },
  hip_thrust: { group: 'glutes', equip: ['bodyweight'], swapTo: ['back_extension'] },
  leg_curl: { group: 'hamstrings', equip: ['machine'], swapTo: ['hip_thrust', 'back_extension'] },
  lateral_raise: { group: 'shoulders', equip: ['dumbbell'], swapTo: ['cable_lateral_raise'] }, cable_lateral_raise: { group: 'shoulders', equip: ['cable'], swapTo: [] },
  db_curl: { group: 'biceps', equip: ['dumbbell'], swapTo: ['cable_curl'] }, cable_curl: { group: 'biceps', equip: ['cable'], swapTo: [] },
  triceps_pushdown: { group: 'triceps', equip: ['cable'], swapTo: ['overhead_db_extension'] }, overhead_db_extension: { group: 'triceps', equip: ['dumbbell', 'bench'], swapTo: [] },
  dead_bug: { group: 'core', equip: ['bodyweight'], swapTo: ['plank_knees', 'plank', 'pallof_press'] }, pallof_press: { group: 'core', equip: ['cable'], swapTo: ['dead_bug', 'plank_knees', 'plank'] },
  plank_knees: { group: 'core', equip: ['bodyweight'], swapTo: [] }, plank: { group: 'core', equip: ['bodyweight'], swapTo: [] },
};
for (const e of [...EXERCISES, ...ALT_EXERCISES]) Object.assign(e, META[e.id]);
export const ALL_EXERCISES: ExerciseCard[] = [...EXERCISES, ...ALT_EXERCISES];

export const WORKOUTS: Record<'A' | 'B', TemplateExercise[]> = {
  A: [
    { exerciseId: 'machine_press', sets: 3, repMin: 10, repMax: 12, restSec: 120 },
    { exerciseId: 'lat_pulldown', sets: 3, repMin: 10, repMax: 12, restSec: 120 },
    { exerciseId: 'db_rdl', sets: 2, repMin: 10, repMax: 12, restSec: 120 },
    { exerciseId: 'box_step_up', sets: 2, repMin: 10, repMax: 10, restSec: 90, kneeCaution: true },
    { exerciseId: 'lateral_raise', sets: 2, repMin: 12, repMax: 15, restSec: 60 },
    { exerciseId: 'db_curl', sets: 2, repMin: 10, repMax: 15, restSec: 60 },
    { exerciseId: 'dead_bug', sets: 2, repMin: 8, repMax: 8, restSec: 60 },
  ],
  B: [
    { exerciseId: 'incline_db_press', sets: 3, repMin: 10, repMax: 12, restSec: 120 },
    { exerciseId: 'seated_row', sets: 3, repMin: 10, repMax: 12, restSec: 120 },
    { exerciseId: 'hip_thrust', sets: 2, repMin: 12, repMax: 15, restSec: 90 },
    { exerciseId: 'leg_curl', sets: 2, repMin: 12, repMax: 15, restSec: 90, kneeCaution: true },
    { exerciseId: 'lateral_raise', sets: 2, repMin: 12, repMax: 15, restSec: 60 },
    { exerciseId: 'triceps_pushdown', sets: 2, repMin: 12, repMax: 15, restSec: 60 },
    { exerciseId: 'pallof_press', sets: 2, repMin: 10, repMax: 10, restSec: 60 },
  ],
};

export const exerciseById = (id: string) => ALL_EXERCISES.find((e) => e.id === id)!;
