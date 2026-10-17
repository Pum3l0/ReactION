/**
 * Банк веществ для таблицы-накладной.
 *
 * Каждое вещество описывается по 6 параметрам. Поля:
 *  formula     — химическая формула (латиницей)
 *  name        — название (по-русски)
 *  cls         — класс соединения
 *  bond        — тип химической связи
 *  valency     — валентность (металла / кислотообразующего элемента)
 *  solubility  — растворимость в воде
 *
 * Из банка случайно выбираются 10 веществ на задачу. Несколько из них
 * показываются заполненными как образец, в остальных часть ячеек —
 * пропуски, которые восстанавливает игрок.
 */

export const PARAMETERS = ['formula', 'name', 'cls', 'bond', 'valency', 'solubility'];

export const PARAM_LABELS = {
  formula: 'Формула',
  name: 'Название',
  cls: 'Класс',
  bond: 'Тип связи',
  valency: 'Валентность',
  solubility: 'Растворимость',
};

/** Подсказки, в каком формате вводить каждый параметр. */
export const PARAM_HINTS = {
  formula: 'латиницей, напр. NaCl, H2SO4',
  name: 'по-русски, напр. хлорид натрия',
  cls: 'оксид / основание / кислота / соль',
  bond: 'ионная / ковалентная полярная / ковалентная неполярная / металлическая',
  valency: 'римской цифрой, напр. I, II, III',
  solubility: 'растворимо / малорастворимо / нерастворимо',
};

export const SUBSTANCES = [
  { formula: 'NaCl', name: 'хлорид натрия', cls: 'соль', bond: 'ионная', valency: 'I', solubility: 'растворимо' },
  { formula: 'HCl', name: 'соляная кислота', cls: 'кислота', bond: 'ковалентная полярная', valency: 'I', solubility: 'растворимо' },
  { formula: 'H2SO4', name: 'серная кислота', cls: 'кислота', bond: 'ковалентная полярная', valency: 'VI', solubility: 'растворимо' },
  { formula: 'NaOH', name: 'гидроксид натрия', cls: 'основание', bond: 'ионная', valency: 'I', solubility: 'растворимо' },
  { formula: 'Ca(OH)2', name: 'гидроксид кальция', cls: 'основание', bond: 'ионная', valency: 'II', solubility: 'малорастворимо' },
  { formula: 'CaO', name: 'оксид кальция', cls: 'оксид', bond: 'ионная', valency: 'II', solubility: 'растворимо' },
  { formula: 'CO2', name: 'оксид углерода (IV)', cls: 'оксид', bond: 'ковалентная полярная', valency: 'IV', solubility: 'растворимо' },
  { formula: 'H2O', name: 'вода', cls: 'оксид', bond: 'ковалентная полярная', valency: 'I', solubility: 'растворимо' },
  { formula: 'CuSO4', name: 'сульфат меди (II)', cls: 'соль', bond: 'ионная', valency: 'II', solubility: 'растворимо' },
  { formula: 'AgNO3', name: 'нитрат серебра', cls: 'соль', bond: 'ионная', valency: 'I', solubility: 'растворимо' },
  { formula: 'BaSO4', name: 'сульфат бария', cls: 'соль', bond: 'ионная', valency: 'II', solubility: 'нерастворимо' },
  { formula: 'Fe2O3', name: 'оксид железа (III)', cls: 'оксид', bond: 'ионная', valency: 'III', solubility: 'нерастворимо' },
  { formula: 'MgCl2', name: 'хлорид магния', cls: 'соль', bond: 'ионная', valency: 'II', solubility: 'растворимо' },
  { formula: 'HNO3', name: 'азотная кислота', cls: 'кислота', bond: 'ковалентная полярная', valency: 'V', solubility: 'растворимо' },
  { formula: 'KOH', name: 'гидроксид калия', cls: 'основание', bond: 'ионная', valency: 'I', solubility: 'растворимо' },
  { formula: 'N2', name: 'азот', cls: 'простое вещество', bond: 'ковалентная неполярная', valency: 'III', solubility: 'нерастворимо' },
  { formula: 'Fe', name: 'железо', cls: 'простое вещество', bond: 'металлическая', valency: 'II', solubility: 'нерастворимо' },
  { formula: 'SO2', name: 'оксид серы (IV)', cls: 'оксид', bond: 'ковалентная полярная', valency: 'IV', solubility: 'растворимо' },
  { formula: 'Al2O3', name: 'оксид алюминия', cls: 'оксид', bond: 'ионная', valency: 'III', solubility: 'нерастворимо' },
  { formula: 'H3PO4', name: 'фосфорная кислота', cls: 'кислота', bond: 'ковалентная полярная', valency: 'V', solubility: 'растворимо' },
];
