import type { MealSlot, Recipe } from '../domain/types';

/**
 * Gotowe, proste przepisy domowe (własne opracowanie typowych dań z redukcji).
 * Składniki wyłącznie z bazy produktów, gramatury na cały przepis, wartości liczone przez recipeTotals.
 * Nie są zapisywane w bazie: „Dodaj do moich” robi kopię w tabeli recipes.
 */
const R = (id: string, name: string, meal: MealSlot, minutes: number, servings: number, items: [string, number][], steps: string[]): Recipe =>
  ({ id: `lib_${id}`, name, meal, minutes, servings, items: items.map(([productId, grams]) => ({ productId, grams })), steps, createdAt: 0, updatedAt: 0, source: 'template' });

export const RECIPE_LIBRARY: Recipe[] = [
  // Śniadania
  R('oats_apple', 'Owsianka z jabłkiem i masłem orzechowym', 'breakfast', 10, 1, [['oats', 60], ['soy_drink', 250], ['apple', 150], ['peanut_butter', 15]],
    ['Płatki zalej napojem i gotuj 3–4 min, mieszając.', 'Dodaj starte lub pokrojone jabłko.', 'Na wierzch masło orzechowe.']),
  R('scrambled', 'Jajecznica z pomidorem i chlebem żytnim', 'breakfast', 10, 1, [['egg', 180], ['x_tomato', 150], ['rye_bread', 70], ['olive_oil', 5]],
    ['Rozgrzej oliwę, wbij 3 jajka i smaż na małym ogniu, mieszając.', 'Podaj z pokrojonym pomidorem i chlebem.']),
  R('turkey_sandwich', 'Kanapki z indykiem i warzywami', 'breakfast', 5, 1, [['rye_bread', 90], ['turkey_ham', 80], ['hummus', 30], ['x_cucumber', 100], ['x_tomato', 100]],
    ['Posmaruj chleb hummusem.', 'Połóż indyka, ogórek i pomidor.']),
  R('omelette', 'Omlet ze szpinakiem i pieczarkami', 'breakfast', 12, 1, [['egg', 120], ['x_egg_white', 100], ['x_spinach', 60], ['x_mushrooms', 100], ['olive_oil', 5], ['rye_bread', 50]],
    ['Podsmaż pokrojone pieczarki i szpinak.', 'Zalej roztrzepanymi jajkami z białkami, smaż pod przykryciem 4–5 min.', 'Podaj z chlebem.']),
  R('skyr_bowl', 'Skyr z owocami i musli', 'breakfast', 3, 1, [['x_skyr', 200], ['x_muesli', 40], ['x_berries_frozen', 100]],
    ['Wyłóż skyr do miski, dodaj owoce (mogą być rozmrożone) i musli.']),
  R('tofu_scramble', 'Tofucznica z papryką', 'breakfast', 12, 1, [['tofu', 180], ['x_pepper_red', 100], ['x_onion', 50], ['x_spinach', 40], ['olive_oil', 7], ['rye_bread', 60]],
    ['Podsmaż cebulę i paprykę na oliwie.', 'Dodaj rozkruszone tofu i szpinak, smaż 5 min; dopraw solą, pieprzem, kurkumą.', 'Podaj z chlebem.']),
  // Obiady (zwykle 2–4 porcje: meal prep)
  R('chicken_rice', 'Kurczak z ryżem i brokułem', 'lunch', 30, 4, [['chicken_raw', 500], ['rice', 200], ['x_broccoli', 500], ['olive_oil', 20]],
    ['Ugotuj ryż.', 'Kurczaka pokrój, dopraw i usmaż na oliwie (ok. 8 min).', 'Brokuł ugotuj na parze 5 min.', 'Podziel na 4 pojemniki.']),
  R('lecso', 'Leczo z kurczakiem i ryżem', 'lunch', 35, 4, [['chicken_raw', 500], ['x_pepper_red', 400], ['x_zucchini', 400], ['x_onion', 150], ['passata', 400], ['olive_oil', 20], ['rice', 200]],
    ['Podsmaż cebulę i kurczaka w kostce.', 'Dodaj paprykę i cukinię, duś 10 min.', 'Wlej passatę, gotuj 10 min; dopraw papryką słodką.', 'Podawaj z ryżem.']),
  R('bolognese', 'Spaghetti bolognese pełnoziarniste', 'lunch', 35, 4, [['beef_5', 500], ['ww_pasta', 320], ['passata', 700], ['x_onion', 120], ['x_carrot', 150], ['x_garlic', 10], ['olive_oil', 15]],
    ['Podsmaż cebulę, czosnek i startą marchew.', 'Dodaj mięso, smaż do zbrązowienia.', 'Wlej passatę, duś 15 min.', 'Ugotuj makaron al dente i połącz.']),
  R('turkey_buckwheat', 'Indyk z kaszą gryczaną i warzywami', 'lunch', 25, 4, [['x_turkey_breast', 500], ['buckwheat', 240], ['x_veg_frozen', 750], ['olive_oil', 20]],
    ['Ugotuj kaszę.', 'Indyka pokrój w paski i usmaż.', 'Dodaj mrożone warzywa, smaż 8 min.', 'Podziel z kaszą na porcje.']),
  R('salmon_potatoes', 'Łosoś pieczony z ziemniakami i fasolką', 'lunch', 35, 2, [['salmon', 300], ['potato', 600], ['x_green_beans', 400], ['olive_oil', 10], ['x_lemon', 40]],
    ['Ziemniaki ugotuj (ok. 20 min).', 'Łososia skrop cytryną, piecz 15 min w 200°C.', 'Fasolkę ugotuj 6–8 min, polej oliwą.']),
  R('chili', 'Chili con carne z ryżem', 'lunch', 35, 4, [['beef_5', 500], ['x_beans_can', 400], ['x_corn_can', 140], ['passata', 500], ['x_onion', 120], ['x_pepper_red', 200], ['rice', 240], ['olive_oil', 15]],
    ['Podsmaż cebulę i paprykę, dodaj mięso.', 'Dodaj fasolę, kukurydzę i passatę, dopraw kuminem i chili, duś 15 min.', 'Podawaj z ryżem.']),
  R('chickpea_curry', 'Curry z ciecierzycy i tofu', 'lunch', 30, 4, [['chickpeas', 480], ['tofu', 360], ['x_spinach', 200], ['passata', 400], ['x_onion', 120], ['x_garlic', 10], ['olive_oil', 15], ['x_rice_basmati', 240]],
    ['Podsmaż cebulę i czosnek z curry w proszku.', 'Dodaj tofu w kostce, ciecierzycę i passatę, gotuj 10 min.', 'Na koniec szpinak.', 'Podawaj z ryżem.']),
  R('meatballs', 'Pulpety z indyka w sosie pomidorowym z makaronem', 'lunch', 40, 4, [['x_turkey_mince', 600], ['egg', 60], ['passata', 600], ['ww_pasta', 280], ['x_onion', 100]],
    ['Mięso wymieszaj z jajkiem i startą cebulą, dopraw, uformuj kulki.', 'Gotuj pulpety w passacie pod przykryciem 20 min.', 'Podawaj z makaronem.']),
  R('pork_stew', 'Gulasz wieprzowy z pieczarkami i pęczakiem', 'lunch', 50, 4, [['x_pork_loin', 600], ['x_onion', 200], ['x_pepper_red', 200], ['x_mushrooms', 300], ['passata', 300], ['x_barley', 240], ['olive_oil', 15]],
    ['Schab w kostce obsmaż z cebulą.', 'Dodaj paprykę, pieczarki, passatę i szklankę wody; duś 30 min.', 'Ugotuj pęczak i podawaj razem.']),
  R('cod_potatoes', 'Dorsz z ziemniakami i surówką z kapusty', 'lunch', 30, 2, [['x_cod', 400], ['potato', 600], ['x_cabbage', 300], ['x_carrot', 150], ['olive_oil', 15]],
    ['Ziemniaki ugotuj.', 'Dorsza dopraw i upiecz (15 min, 200°C) lub usmaż na łyżce oliwy.', 'Kapustę i marchew zetrzyj, wymieszaj z resztą oliwy, solą i sokiem z cytryny.']),
  R('tuna_pasta', 'Makaron z tuńczykiem i pomidorami', 'lunch', 20, 2, [['tuna', 240], ['ww_pasta', 200], ['passata', 300], ['x_olives', 40], ['x_onion', 80], ['olive_oil', 10]],
    ['Ugotuj makaron.', 'Podsmaż cebulę, dodaj passatę i oliwki, gotuj 5 min.', 'Dodaj tuńczyka i makaron, wymieszaj.']),
  // Kolacje
  R('tuna_salad', 'Sałatka z tuńczykiem i ciecierzycą', 'dinner', 10, 1, [['tuna', 120], ['chickpeas', 120], ['x_lettuce', 100], ['x_cucumber', 150], ['x_tomato', 150], ['olive_oil', 10]],
    ['Pokrój warzywa.', 'Dodaj tuńczyka i ciecierzycę, polej oliwą, dopraw.']),
  R('chicken_wrap', 'Tortilla z kurczakiem i warzywami', 'dinner', 10, 2, [['x_tortilla_ww', 120], ['chicken_cooked', 250], ['x_lettuce', 60], ['x_tomato', 150], ['x_pepper_red', 120], ['hummus', 60]],
    ['Posmaruj tortille hummusem.', 'Dodaj kurczaka i warzywa, zawiń.']),
  R('tomato_soup', 'Zupa pomidorowa z kurczakiem i ryżem', 'dinner', 40, 3, [['passata', 700], ['chicken_raw', 300], ['rice', 120], ['x_carrot', 150], ['x_onion', 100], ['x_celery', 80], ['olive_oil', 10]],
    ['Kurczaka i warzywa gotuj w 1 l wody 25 min.', 'Dodaj passatę, gotuj 5 min, dopraw.', 'Osobno ugotuj ryż i dodawaj do talerza.']),
  R('egg_sandwich', 'Kanapki z jajkiem i rzodkiewką', 'dinner', 12, 1, [['x_egg_boiled', 120], ['rye_bread', 90], ['x_radish', 80], ['x_lettuce', 30], ['hummus', 30]],
    ['Ugotuj jajka na twardo (9 min).', 'Chleb posmaruj hummusem, dodaj sałatę, jajko i rzodkiewkę.']),
  R('zucchini_fritters', 'Placki z cukinii', 'dinner', 25, 2, [['x_zucchini', 400], ['egg', 180], ['x_egg_white', 100], ['x_flour', 60], ['olive_oil', 15]],
    ['Cukinię zetrzyj, posól, po 10 min odciśnij.', 'Wymieszaj z jajkami, białkami i mąką.', 'Smaż małe placki na rozgrzanej oliwie po 2–3 min z każdej strony.']),
  // Przekąski
  R('apple_pb', 'Jabłko z masłem orzechowym', 'snack', 2, 1, [['apple', 180], ['peanut_butter', 20]], ['Pokrój jabłko, podawaj z masłem orzechowym.']),
  R('soy_yogurt', 'Jogurt sojowy z malinami i orzechami', 'snack', 3, 1, [['x_soy_yog', 200], ['x_raspberries', 100], ['walnuts', 15]], ['Wymieszaj jogurt z malinami, posyp orzechami.']),
  R('hummus_veg', 'Hummus z warzywami', 'snack', 5, 1, [['hummus', 80], ['x_carrot', 150], ['x_cucumber', 150], ['x_pepper_red', 100]], ['Pokrój warzywa w słupki, maczaj w hummusie.']),
];

export const MEAL_SLOT_PL: Record<MealSlot, string> = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąska' };

/** Pora posiłku z godziny (lokalnej). */
export function slotForHour(h: number): MealSlot {
  return h < 10.5 ? 'breakfast' : h < 15.5 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}
