/**
 * Смена — рабочие задания химика.
 *
 * Каждое задание — это лабораторная по школьной программе, поданная как
 * рабочая задача на производстве. Мастер выдаёт задание, игрок выполняет
 * опыт на столе, игра сверяет результат с эталоном.
 *
 * level отражает место в школьной программе:
 *   1 — наблюдение (растворение, цвет)
 *   2 — реакции обмена (осадки, газ)
 *   3 — качественные реакции и индикаторы
 *
 * В полигоне (режим «Лаборатория») заданий нет — там свободный стол
 * и все 30 реагентов, плюс инструменты: нагрев, фильтрование, магнит.
 */

export const SHIFT_TASKS = [
  {
    id: 'dissolve',
    title: 'Задание 1 — Рабочий раствор',
    brief:
      'Начнём с простого. Возьми пробирку и раствори в воде сульфат меди — ' +
      'нам нужен рабочий раствор. Посмотри, какого он получится цвета.',
    goal: { kind: 'color', color: 0x2f8fd6 },
    reagents: ['water', 'cuso4'],
    equation: 'CuSO4 + H2O -> CuSO4 (р-р)',
    observation: 'Раствор сульфата меди — голубого цвета.',
    level: 1,
  },
  {
    id: 'cu-oh',
    title: 'Задание 2 — Проверка щёлочью',
    brief:
      'Теперь качественная проверка. К раствору сульфата меди прилей ' +
      'гидроксид натрия. По осадку мы поймём, что за соль в партии.',
    goal: { kind: 'precipitate', product: 'Cu(OH)2' },
    reagents: ['cuso4', 'naoh'],
    equation: 'CuSO4 + 2NaOH -> Cu(OH)2 (осадок) + Na2SO4',
    observation: 'Выпадает синий осадок гидроксида меди (II).',
    level: 2,
  },
  {
    id: 'fe-oh3',
    title: 'Задание 3 — Железо в партии (III)',
    brief:
      'В новой партии, похоже, примесь железа. Добавь к хлориду железа ' +
      'щёлочь и посмотри на осадок — он подскажет валентность железа.',
    goal: { kind: 'precipitate', product: 'Fe(OH)3' },
    reagents: ['fecl3', 'naoh'],
    equation: 'FeCl3 + 3NaOH -> Fe(OH)3 (осадок) + 3NaCl',
    observation: 'Бурый осадок гидроксида железа (III).',
    level: 2,
  },
  {
    id: 'fe-oh2',
    title: 'Задание — Железо в партии (II)',
    brief:
      'Пришла другая партия. Проверь хлорид железа щёлочью и определи, ' +
      'какая это соль — с железом (II) или (III).',
    goal: { kind: 'precipitate', product: 'Fe(OH)2' },
    reagents: ['fecl2', 'naoh'],
    equation: 'FeCl2 + 2NaOH -> Fe(OH)2 (осадок) + 2NaCl',
    observation: 'Серо-зелёный осадок гидроксида железа (II).',
    level: 2,
  },
  {
    id: 'ag-cl',
    title: 'Задание 4 — Проба на хлориды',
    brief:
      'Проверь соляную кислоту на хлориды: капни нитрат серебра. ' +
      'Если есть хлорид-ион — увидишь характерный осадок.',
    goal: { kind: 'precipitate', product: 'AgCl' },
    reagents: ['hcl', 'agno3'],
    equation: 'HCl + AgNO3 -> AgCl (осадок) + HNO3',
    observation: 'Белый творожистый осадок хлорида серебра.',
    level: 3,
  },
  {
    id: 'ba-so4',
    title: 'Задание 5 — Проба на сульфаты',
    brief:
      'А теперь проверь серную кислоту на сульфат-ион хлоридом бария. ' +
      'Осадок будет белым, но совсем другой структуры, чем в прошлый раз.',
    goal: { kind: 'precipitate', product: 'BaSO4' },
    reagents: ['h2so4', 'bacl2'],
    equation: 'H2SO4 + BaCl2 -> BaSO4 (осадок) + 2HCl',
    observation: 'Белый мелкокристаллический осадок сульфата бария.',
    level: 3,
  },
  {
    id: 'co2-gas',
    title: 'Задание 6 — Шипучая партия',
    brief:
      'Соду залило кислотой, и она шипит. Разберись, что за газ выделяется: ' +
      'слей карбонат натрия с соляной кислотой.',
    goal: { kind: 'gas', product: 'CO2' },
    reagents: ['na2co3', 'hcl'],
    equation: 'Na2CO3 + 2HCl -> 2NaCl + H2O + CO2 (газ)',
    observation: 'Бурное выделение пузырьков — углекислый газ.',
    level: 2,
  },
  {
    id: 'phenol',
    title: 'Задание 7 — Кислое или щелочное',
    brief:
      'Нужно понять среду в баке, не пробуя на вкус. Капни индикатор ' +
      'фенолфталеин в гидроксид натрия — и запомни, что он покажет.',
    goal: { kind: 'indicator', color: 0xd6337f },
    reagents: ['naoh', 'phenolphthalein'],
    equation: 'фенолфталеин в щёлочи -> малиновый',
    observation: 'В щелочной среде фенолфталеин становится малиновым.',
    level: 3,
  },
  {
    id: 'pb-i2',
    title: 'Задание 8 — Жёлтый осадок',
    brief:
      'В пробу добавляют нитрат свинца. Если есть иодид — выпадет яркий ' +
      'жёлтый осадок. Проверь иодид калия.',
    goal: { kind: 'precipitate', product: 'PbI2' },
    reagents: ['pbno32', 'ki'],
    equation: 'Pb(NO3)2 + 2KI -> PbI2 (осадок) + 2KNO3',
    observation: 'Ярко-жёлтый осадок иодида свинца (II).',
    level: 3,
  },
  {
    id: 'cu-carbonate',
    title: 'Задание 9 — Зелёный осадок',
    brief:
      'Соду добавляют к раствору медной соли. Посмотри, какого цвета ' +
      'выпадет осадок — это и будет карбонат меди.',
    goal: { kind: 'precipitate', product: 'CuCO3' },
    reagents: ['cuso4', 'na2co3'],
    equation: 'CuSO4 + Na2CO3 -> CuCO3 (осадок) + Na2SO4',
    observation: 'Сине-зелёный осадок карбоната меди (II).',
    level: 2,
  },
  {
    id: 'fe-so4',
    title: 'Задание 10 — Барий в сульфате',
    brief:
      'Проверь сульфат железа на сульфат-ион хлоридом бария. ' +
      'Белый осадок подтвердит сульфат.',
    goal: { kind: 'precipitate', product: 'BaSO4' },
    reagents: ['feso4', 'bacl2'],
    equation: 'FeSO4 + BaCl2 -> BaSO4 (осадок) + FeCl2',
    observation: 'Белый осадок сульфата бария.',
    level: 3,
  },
  {
    id: 'heat-cuoh',
    title: 'Задание 11 — Прокаливание осадка',
    brief:
      'Получи осадок гидроксида меди (щёлочь + раствор меди), затем поставь ' +
      'пробирку на горелку. Что произойдёт с цветом осадка?',
    goal: { kind: 'heat', product: 'CuO' },
    reagents: ['cuso4', 'naoh'],
    equation: 'Cu(OH)2 (t°) -> CuO + H2O',
    observation: 'Синий осадок при нагреве чернеет — образуется оксид меди (II).',
    level: 3,
  },
  {
    id: 'heat-caco3',
    title: 'Задание 12 — Обжиг известняка',
    brief:
      'Насыпь карбонат кальция (мел) в пробирку и сильно нагрей. ' +
      'Ты увидишь, что происходит с известью при обжиге.',
    goal: { kind: 'heat', product: 'CaO' },
    reagents: ['caco3'],
    equation: 'CaCO3 (t°) -> CaO + CO2 (газ)',
    observation: 'При прокаливании выделяется CO2, остаётся оксид кальция.',
    level: 3,
  },
  {
    id: 'heat-nh3',
    title: 'Задание 13 — Аммиак из бочки',
    brief:
      'В бочке аммиачная вода. Если её нагреть, пойдёт резкий газ. ' +
      'Проверь: налей аммиак и поставь на горелку.',
    goal: { kind: 'heat', product: 'NH3' },
    reagents: ['nh3'],
    equation: 'NH4OH (t°) -> NH3 (газ) + H2O',
    observation: 'При нагреве аммиачной воды выделяется газ аммиак NH3.',
    level: 3,
  },
];

/**
 * Случайное задание — не повторяем уже решённые, пока не исчерпаем набор.
 */
export function pickShiftTask(excludeIds = [], maxLevel = 3) {
  const pool = SHIFT_TASKS.filter(
    (t) => t.level <= maxLevel && !excludeIds.includes(t.id),
  );
  const source = pool.length ? pool : SHIFT_TASKS.filter((t) => t.level <= maxLevel);
  return source[Math.floor(Math.random() * source.length)];
}

export function getShiftTask(id) {
  return SHIFT_TASKS.find((t) => t.id === id);
}
