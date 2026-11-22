/**
 * Krótka rozgrzewka i nieobowiązkowe rozciąganie do treningu FBW.
 * Dobór: bez przysiadów, wykroków i skoków (oszczędnie dla kolana). Źródła i ograniczenia: docs/EVIDENCE.md, „Rozgrzewka i rozciąganie”.
 */
export interface PrepItem {
  id: string;
  name: string;
  /** ile: czas albo powtórzenia */
  dose: string;
  /** na czym się skupić, co czuć */
  focus: string;
  steps: string[];
  /** fraza do wyszukania wideo (YouTube) */
  video: string;
}

export const WARMUP: PrepItem[] = [
  { id: 'wu_cardio', name: 'Marsz na bieżni albo rower', dose: '5 min', focus: 'Ma być cieplej i szybszy oddech, ale nadal możesz rozmawiać.',
    steps: ['Bieżnia: 4–5 km/h, bez nachylenia. Rower: lekki opór, spokojne tempo.', 'Ostatnią minutę trochę szybciej.'], video: 'treadmill walking warm up' },
  { id: 'wu_arms', name: 'Krążenia ramion', dose: '10 w przód + 10 w tył', focus: 'Barki pracują swobodnie, ruch płynny, bez szarpania.',
    steps: ['Stań prosto, ręce wzdłuż ciała.', 'Rób duże, spokojne koła prostymi rękami: najpierw w przód, potem w tył.'], video: 'arm circles warm up' },
  { id: 'wu_hinge', name: 'Skłon z bioder bez ciężaru', dose: '10 powt.', focus: 'Czujesz rozciąganie z tyłu ud. Plecy proste, ruch zaczyna się w biodrach.',
    steps: ['Stań na szerokość bioder, dłonie na biodrach, kolana lekko ugięte.', 'Wypchnij biodra do tyłu i pochyl tułów, aż poczujesz tył ud.', 'Wróć, ściskając pośladki.'], video: 'bodyweight hip hinge' },
  { id: 'wu_bridge', name: 'Most biodrowy na macie', dose: '10 powt.', focus: 'Pracują pośladki, nie lędźwia. Na górze krótkie zatrzymanie.',
    steps: ['Połóż się na plecach, stopy na podłodze blisko pośladków.', 'Unieś biodra do linii kolano–biodro–bark, zatrzymaj na 1 s.', 'Opuść powoli.'], video: 'glute bridge' },
  { id: 'wu_specific', name: 'Lekkie serie pierwszego ćwiczenia', dose: '1–2 serie, nie liczą się do treningu', focus: 'Sprawdzasz tor ruchu i ustawienie maszyny. Bez zmęczenia.',
    steps: ['Seria 1: ok. połowa ciężaru roboczego × 8–10.', 'Seria 2 (przy cięższym ćwiczeniu): ok. 3/4 ciężaru × 4–5.', 'Potem od razu właściwe serie.'], video: 'warm up sets strength training' },
];

export const COOLDOWN: PrepItem[] = [
  { id: 'cd_chest', name: 'Klatka i przód barku przy ścianie', dose: '20–30 s na stronę', focus: 'Lekkie ciągnięcie z przodu klatki, nie w stawie barkowym.',
    steps: ['Przedramię oprzyj o framugę lub słupek, łokieć na wysokości barku.', 'Obróć tułów delikatnie w drugą stronę.', 'Oddychaj spokojnie, bez bólu.'], video: 'doorway chest stretch' },
  { id: 'cd_lats', name: 'Bok pleców (najszerszy)', dose: '20–30 s', focus: 'Rozciąganie pod pachami i wzdłuż boku pleców.',
    steps: ['Chwyć oparcie albo drążek na wysokości bioder.', 'Cofnij biodra, ręce proste, głowa między ramionami.', 'Spokojny oddech.'], video: 'lat stretch standing' },
  { id: 'cd_hams', name: 'Tył uda na stojąco', dose: '20–30 s na nogę', focus: 'Ciągnie tył uda, nie miejsce pod kolanem. Kolano lekko ugięte.',
    steps: ['Pięta na niskim stopniu lub ławce, palce w górę.', 'Pochyl tułów z bioder, plecy proste.', 'Gdy czujesz ból w kolanie, zmniejsz zakres albo pomiń.'], video: 'standing hamstring stretch' },
  { id: 'cd_glute', name: 'Pośladek leżąc („czwórka”)', dose: '20–30 s na stronę', focus: 'Rozciąganie w pośladku, kolano bez bólu.',
    steps: ['Połóż się na plecach, kostkę jednej nogi oprzyj na kolanie drugiej.', 'Przyciągnij nogę podporową do siebie za udo.', 'Zmień stronę.'], video: 'supine figure four stretch' },
  { id: 'cd_calf', name: 'Łydka przy ścianie', dose: '20–30 s na nogę', focus: 'Rozciąganie w łydce, pięta cały czas na podłodze.',
    steps: ['Dłonie na ścianie, jedna noga z tyłu, prosta.', 'Pięta tylnej nogi dociśnięta do podłogi, przenieś ciężar do przodu.'], video: 'wall calf stretch' },
];
