export interface ExerciseCard {
  id: string; namePl: string; nameEn: string; muscles: string; equipment: string; setup: string; start: string;
  steps: string[]; breathing: string; mistakes: string[]; loadTip: string; warnings: string;
  knee: 'none' | 'low' | 'moderate'; alternatives: string[]; increment: number; perSide?: boolean;
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
  { id: 'box_step_up', namePl: 'Wstawanie z wysokiej ławki', nameEn: 'Box squat to high bench', muscles: 'Czworogłowe, pośladki', equipment: 'Wysoka ławka / skrzynia (siad z kolanem powyżej biodra)',
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

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)!;
