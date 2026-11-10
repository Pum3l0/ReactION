/**
 * Химия ReactION — база реагентов и реакций.
 *
 * В этом файле ТОЛЬКО данные — ни строчки Three.js.
 * Разделение как в substances.js: данные отдельно, логика отдельно.
 *
 * ИСТОЧНИК ИСТИНЫ — таблица растворимости из игры
 * (public/textures/props/rastvortable.webp). Значения Р / М / Н:
 *   Р — растворяется        -> реакции нет (вещество в растворе)
 *   М — малорастворимо      -> precipitate: 'weak'  (лёгкая муть)
 *   Н — не растворяется     -> precipitate: true    (осадок)
 *   — — разлагается в воде  -> decompose: true      (особый случай)
 *
 * Чтобы добавить реакцию — открой таблицу, найди клетку и допиши строку
 * в SOLUBILITY. Движок трогать не нужно.
 */

/* --------------------------------------------------------------------------
 * Ионы.
 * ------------------------------------------------------------------------ */
export const IONS = {
  // Катионы
  H:   { id: 'H',   charge: +1, label: 'H+' },
  Na:  { id: 'Na',  charge: +1, label: 'Na+' },
  K:   { id: 'K',   charge: +1, label: 'K+' },
  NH4: { id: 'NH4', charge: +1, label: 'NH4+' },
  Ba:  { id: 'Ba',  charge: +2, label: 'Ba2+' },
  Ca:  { id: 'Ca',  charge: +2, label: 'Ca2+' },
  Mg:  { id: 'Mg',  charge: +2, label: 'Mg2+' },
  Al:  { id: 'Al',  charge: +3, label: 'Al3+' },
  Zn:  { id: 'Zn',  charge: +2, label: 'Zn2+' },
  Cu:  { id: 'Cu',  charge: +2, label: 'Cu2+' },
  Fe2: { id: 'Fe2', charge: +2, label: 'Fe2+' },
  Fe3: { id: 'Fe3', charge: +3, label: 'Fe3+' },
  Ag:  { id: 'Ag',  charge: +1, label: 'Ag+' },
  Pb:  { id: 'Pb',  charge: +2, label: 'Pb2+' },
  // Анионы
  OH:  { id: 'OH',  charge: -1, label: 'OH-' },
  Cl:  { id: 'Cl',  charge: -1, label: 'Cl-' },
  Br:  { id: 'Br',  charge: -1, label: 'Br-' },
  I:   { id: 'I',   charge: -1, label: 'I-' },
  NO3: { id: 'NO3', charge: -1, label: 'NO3-' },
  SO4: { id: 'SO4', charge: -2, label: 'SO4(2-)' },
  CO3: { id: 'CO3', charge: -2, label: 'CO3(2-)' },
  PO4: { id: 'PO4', charge: -3, label: 'PO4(3-)' },
  S:   { id: 'S',   charge: -2, label: 'S2-' },
  SiO3:{ id: 'SiO3',charge: -2, label: 'SiO3(2-)' },
};

/* --------------------------------------------------------------------------
 * Реагенты (склянки на столе).
 *   color  — цвет раствора (0xRRGGBB) или null
 *   state  — 'liquid' | 'solid' (для режима полигона)
 *   tags   — метки: 'acid', 'base', 'salt', 'indicator', 'metal'
 * ------------------------------------------------------------------------ */
export const REAGENTS = {
  // --- Вода ---
  water:  { formula: 'H2O',    name: 'вода',                 color: null,     state: 'liquid', tags: [], ions: [] },

  // --- Кислоты ---
  hcl:    { formula: 'HCl',    name: 'соляная кислота',      color: null,     state: 'liquid', tags: ['acid'], ions: ['H', 'Cl'] },
  h2so4:  { formula: 'H2SO4',  name: 'серная кислота',       color: null,     state: 'liquid', tags: ['acid'], ions: ['H', 'SO4'] },
  hno3:   { formula: 'HNO3',   name: 'азотная кислота',      color: null,     state: 'liquid', tags: ['acid'], ions: ['H', 'NO3'] },
  h3po4:  { formula: 'H3PO4',  name: 'фосфорная кислота',    color: null,     state: 'liquid', tags: ['acid'], ions: ['H', 'PO4'] },

  // --- Основания ---
  naoh:   { formula: 'NaOH',   name: 'гидроксид натрия',     color: null,     state: 'liquid', tags: ['base'], ions: ['Na', 'OH'] },
  koh:    { formula: 'KOH',    name: 'гидроксид калия',      color: null,     state: 'liquid', tags: ['base'], ions: ['K', 'OH'] },
  caoh2:  { formula: 'Ca(OH)2',name: 'гидроксид кальция',    color: null,     state: 'liquid', tags: ['base'], ions: ['Ca', 'OH'] },
  baoh2:  { formula: 'Ba(OH)2',name: 'гидроксид бария',      color: null,     state: 'liquid', tags: ['base'], ions: ['Ba', 'OH'] },
  nh3:    { formula: 'NH3',    name: 'аммиак (р-р)',         color: null,     state: 'liquid', tags: ['base'], ions: ['NH4', 'OH'] },

  // --- Соли (растворимые) ---
  cuso4:  { formula: 'CuSO4',  name: 'сульфат меди (II)',    color: 0x2f8fd6, state: 'solid',  tags: ['salt'], ions: ['Cu', 'SO4'] },
  cucl2:  { formula: 'CuCl2',  name: 'хлорид меди (II)',     color: 0x3aa0d8, state: 'solid',  tags: ['salt'], ions: ['Cu', 'Cl'] },
  fecl3:  { formula: 'FeCl3',  name: 'хлорид железа (III)',  color: 0xb5651d, state: 'solid',  tags: ['salt'], ions: ['Fe3', 'Cl'] },
  fecl2:  { formula: 'FeCl2',  name: 'хлорид железа (II)',   color: 0x8fbf8f, state: 'solid',  tags: ['salt'], ions: ['Fe2', 'Cl'] },
  feso4:  { formula: 'FeSO4',  name: 'сульфат железа (II)',  color: 0x9bc49b, state: 'solid',  tags: ['salt'], ions: ['Fe2', 'SO4'] },
  na2co3: { formula: 'Na2CO3', name: 'карбонат натрия',      color: null,     state: 'solid',  tags: ['salt'], ions: ['Na', 'CO3'] },
  bacl2:  { formula: 'BaCl2',  name: 'хлорид бария',         color: null,     state: 'solid',  tags: ['salt'], ions: ['Ba', 'Cl'] },
  agno3:  { formula: 'AgNO3',  name: 'нитрат серебра',       color: null,     state: 'solid',  tags: ['salt'], ions: ['Ag', 'NO3'] },
  nacl:   { formula: 'NaCl',   name: 'хлорид натрия',        color: null,     state: 'solid',  tags: ['salt'], ions: ['Na', 'Cl'] },
  ki:     { formula: 'KI',     name: 'иодид калия',          color: null,     state: 'solid',  tags: ['salt'], ions: ['K', 'I'] },
  kbr:    { formula: 'KBr',    name: 'бромид калия',         color: null,     state: 'solid',  tags: ['salt'], ions: ['K', 'Br'] },
  pbno32: { formula: 'Pb(NO3)2',name:'нитрат свинца (II)',   color: null,     state: 'solid',  tags: ['salt'], ions: ['Pb', 'NO3'] },
  znso4:  { formula: 'ZnSO4',  name: 'сульфат цинка',        color: null,     state: 'solid',  tags: ['salt'], ions: ['Zn', 'SO4'] },
  mgso4:  { formula: 'MgSO4',  name: 'сульфат магния',       color: null,     state: 'solid',  tags: ['salt'], ions: ['Mg', 'SO4'] },
  na2sio3:{ formula: 'Na2SiO3',name: 'силикат натрия',       color: null,     state: 'liquid', tags: ['salt'], ions: ['Na', 'SiO3'] },

  // --- Индикаторы (тоже можно наливать в сосуд) ---
  phenolphthalein: { formula: 'ф/фтал', name: 'фенолфталеин',   color: null, state: 'liquid', tags: ['indicator'], ions: [] },
  litmus:          { formula: 'лакмус', name: 'лакмус',          color: null, state: 'liquid', tags: ['indicator'], ions: [] },
  methylorange:    { formula: 'мет.оранж', name: 'метилоранж',  color: 0xf2c14e, state: 'liquid', tags: ['indicator'], ions: [] },

  // --- Металлы (для будущей механики вытеснения) ---
  zn:     { formula: 'Zn',     name: 'цинк (гранулы)',       color: 0x8b939c, state: 'solid',  tags: ['metal'], ions: ['Zn'] },
  fe:     { formula: 'Fe',     name: 'железо (стружка)',     color: 0x6b6b6b, state: 'solid',  tags: ['metal'], ions: ['Fe2'] },
};

/* --------------------------------------------------------------------------
 * Индикаторы. Обрабатываются движком отдельно: меняют цвет по среде.
 * ------------------------------------------------------------------------ */
export const INDICATORS = {
  phenolphthalein: {
    formula: 'фенолфталеин',
    name: 'фенолфталеин',
    basicColor: 0xd6337f,   // малиновый в щёлочи
    acidColor: null,         // бесцветный в кислоте
  },
  litmus: {
    formula: 'лакмус',
    name: 'лакмус',
    basicColor: 0x2f4fd6,   // синий в щёлочи
    acidColor: 0xd63a2f,    // красный в кислоте
  },
  methylorange: {
    formula: 'метилоранж',
    name: 'метиловый оранжевый',
    basicColor: 0xf2c14e,   // жёлтый в щёлочи
    acidColor: 0xd6452f,    // красный в кислоте
  },
};

/* --------------------------------------------------------------------------
 * ТАБЛИЦА РАСТВОРИМОСТИ.
 * Ключ — пара ионов; порядок в ключе НЕ важен (движок проверяет оба).
 * ------------------------------------------------------------------------ */
export const SOLUBILITY = {
  // --- Гидроксиды (строка OH-) ---
  'OH|Cu':   { precipitate: true,   color: 0x2f8fd6, formula: 'Cu(OH)2', name: 'гидроксид меди (II)' },
  'OH|Fe3':  { precipitate: true,   color: 0x8b4a1e, formula: 'Fe(OH)3', name: 'гидроксид железа (III)' },
  'OH|Fe2':  { precipitate: 'weak', color: 0x6f9b6f, formula: 'Fe(OH)2', name: 'гидроксид железа (II)' },
  'OH|Mg':   { precipitate: true,   color: 0xf2f2ee, formula: 'Mg(OH)2', name: 'гидроксид магния' },
  'OH|Al':   { precipitate: true,   color: 0xf0f0ea, formula: 'Al(OH)3', name: 'гидроксид алюминия' },
  'OH|Zn':   { precipitate: true,   color: 0xf2f2ee, formula: 'Zn(OH)2', name: 'гидроксид цинка' },
  'OH|Pb':   { precipitate: true,   color: 0xf2f2ee, formula: 'Pb(OH)2', name: 'гидроксид свинца (II)' },
  'OH|Ca':   { precipitate: 'weak', color: 0xf0f0ea, formula: 'Ca(OH)2', name: 'гидроксид кальция' },
  'OH|Ba':   { precipitate: false,  color: null,     formula: null,      name: 'растворимо' },

  // --- Хлориды (строка Cl-) ---
  'Cl|Ag':   { precipitate: true, color: 0xf2f2ee, formula: 'AgCl', name: 'хлорид серебра' },
  'Cl|Pb':   { precipitate: true, color: 0xf2f2ee, formula: 'PbCl2', name: 'хлорид свинца (II)' },

  // --- Бромиды / иодиды ---
  'Br|Ag':   { precipitate: true, color: 0xf5f0e0, formula: 'AgBr', name: 'бромид серебра' },
  'I|Ag':    { precipitate: true, color: 0xf2e8a0, formula: 'AgI',  name: 'иодид серебра' },
  'I|Pb':    { precipitate: true, color: 0xf2d94e, formula: 'PbI2', name: 'иодид свинца (II)' },

  // --- Сульфаты (строка SO4) ---
  'SO4|Ba':  { precipitate: true,   color: 0xf2f2ee, formula: 'BaSO4', name: 'сульфат бария' },
  'SO4|Pb':  { precipitate: true,   color: 0xf2f2ee, formula: 'PbSO4', name: 'сульфат свинца (II)' },
  'SO4|Ca':  { precipitate: 'weak', color: 0xf0f0ea, formula: 'CaSO4', name: 'сульфат кальция' },

  // --- Карбонаты (строка CO3) ---
  'CO3|Cu':  { precipitate: true, color: 0x3f9ea8, formula: 'CuCO3', name: 'карбонат меди (II)' },
  'CO3|Ba':  { precipitate: true, color: 0xf2f2ee, formula: 'BaCO3', name: 'карбонат бария' },
  'CO3|Ca':  { precipitate: true, color: 0xf0f0ea, formula: 'CaCO3', name: 'карбонат кальция' },
  'CO3|Mg':  { precipitate: true, color: 0xf2f2ee, formula: 'MgCO3', name: 'карбонат магния' },
  'CO3|Zn':  { precipitate: true, color: 0xf2f2ee, formula: 'ZnCO3', name: 'карбонат цинка' },
  'CO3|Pb':  { precipitate: true, color: 0xf2f2ee, formula: 'PbCO3', name: 'карбонат свинца (II)' },
  'CO3|Ag':  { precipitate: true, color: 0xf2eeDa, formula: 'Ag2CO3', name: 'карбонат серебра' },

  // --- Фосфаты (строка PO4) ---
  'PO4|Cu':  { precipitate: true, color: 0x3f8ec8, formula: 'Cu3(PO4)2', name: 'фосфат меди (II)' },
  'PO4|Ca':  { precipitate: true, color: 0xf2f2ee, formula: 'Ca3(PO4)2', name: 'фосфат кальция' },
  'PO4|Ag':  { precipitate: true, color: 0xf2e8a0, formula: 'Ag3PO4', name: 'фосфат серебра' },
  'PO4|Ba':  { precipitate: true, color: 0xf2f2ee, formula: 'Ba3(PO4)2', name: 'фосфат бария' },

  // --- Силикаты (строка SiO3) ---
  'SiO3|Cu': { precipitate: true, color: 0x4aa6b0, formula: 'CuSiO3', name: 'силикат меди' },
  'SiO3|Ca': { precipitate: true, color: 0xf2f2ee, formula: 'CaSiO3', name: 'силикат кальция' },

  // --- Сульфиды (строка S) ---
  'S|Cu':  { precipitate: true, color: 0x2a2a2a, formula: 'CuS', name: 'сульфид меди (II)' },
  'S|Zn':  { precipitate: true, color: 0xf2f2ee, formula: 'ZnS', name: 'сульфид цинка' },
  'S|Pb':  { precipitate: true, color: 0x2a2a2a, formula: 'PbS', name: 'сульфид свинца (II)' },
  'S|Fe2': { precipitate: true, color: 0x2a2a2a, formula: 'FeS', name: 'сульфид железа (II)' },

  // --- Газ и нейтрализация (участвует H+) ---
  'CO3|H':  { gas: true, product: 'CO2', name: 'углекислый газ', bubbles: 0xffffff },
  'S|H':    { gas: true, product: 'H2S', name: 'сероводород', bubbles: 0xf5f0e0 },
  'OH|H':   { neutral: true, formula: 'H2O', name: 'нейтрализация (вода)' },
};

/* --------------------------------------------------------------------------
 * Настройки эффектов.
 * ------------------------------------------------------------------------ */
export const EFFECTS = {
  precipitate: { settleTime: 1.3, particles: 140, cloudAlpha: 0.9 },
  weak:        { settleTime: 1.8, particles: 70,  cloudAlpha: 0.5 },
  gas:         { bubbleCount: 26, riseSpeed: 0.35, lifetime: 2.6 },
  heat:        { boilAfter: 3, steamColor: 0xdfe9f0 },
};

/** Объём посуды, мл. */
export const CAPACITY = { tube: 30, beaker: 60, flask: 100 };

/** Объём склянки с реагентом. */
export const REAGENT_VOLUME = 250;

/* --------------------------------------------------------------------------
 * Помощники для интерфейса.
 * ------------------------------------------------------------------------ */

/** Реагенты по тегам (для группировки в панели). */
export function reagentsByTag(tag) {
  return Object.entries(REAGENTS)
    .filter(([, r]) => r.tags?.includes(tag))
    .map(([id, r]) => ({ id, ...r }));
}

/** Все id реагентов. */
export function allReagentIds() {
  return Object.keys(REAGENTS);
}
