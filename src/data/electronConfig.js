/**
 * Электронные конфигурации атомов — данные для Орбитария.
 *
 * Здесь собрано всё, что нужно для генерации задания «паспорт элемента»:
 *  - список подоболочек в порядке заполнения (правило Клечковского);
 *  - вместимость каждой подоболочки;
 *  - «проскоки» (аномалии) для Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, Pt, Au;
 *  - генератор задания по случайному элементу.
 *
 * Формат записи подоболочки: '1s', '2s', '2p', '3s', '3d' и т.д.
 */

/**
 * Порядок заполнения по правилу Клечковского (n + l, затем n).
 * Именно в таком порядке электроны «заселяют» атом.
 */
export const FILL_ORDER = [
  '1s',
  '2s',
  '2p',
  '3s',
  '3p',
  '4s',
  '3d',
  '4p',
  '5s',
  '4d',
  '5p',
  '6s',
  '4f',
  '5d',
  '6p',
  '7s',
  '5f',
  '6d',
  '7p',
];

/** Вместимость подоболочки: s — 2, p — 6, d — 10, f — 14. */
export const CAPACITY = { s: 2, p: 6, d: 10, f: 14 };

/** Сколько отдельных орбиталей (клеток) в подоболочке: s — 1, p — 3, d — 5, f — 7. */
export const ORBITALS = { s: 1, p: 3, d: 5, f: 7 };

/** Номера электронов, на которых заканчивается каждый период (для удобства). */
export const PERIOD_ENDS = [2, 10, 18, 36, 54, 86, 118];

/**
 * Элементы с «проскоком» электрона (провал/аномалия).
 * Значение — сколько электронов должно стоять на внешней s-орбитали
 * вместо положенных двух.
 *   Cr: 3d⁵4s¹ (вместо 3d⁴4s²)
 *   Cu: 3d¹⁰4s¹ (вместо 3d⁹4s²)
 *   и т.д. для тяжёлых элементов
 */
export const ANOMALIES = {
  Cr: { z: 24, symbol: 'Cr', name: 'Хром', shift: { from: '4s', to: '3d' } },
  Cu: { z: 29, symbol: 'Cu', name: 'Медь', shift: { from: '4s', to: '3d' } },
  Nb: { z: 41, symbol: 'Nb', name: 'Ниобий', shift: { from: '5s', to: '4d' } },
  Mo: { z: 42, symbol: 'Mo', name: 'Молибден', shift: { from: '5s', to: '4d' } },
  Ru: { z: 44, symbol: 'Ru', name: 'Рутений', shift: { from: '5s', to: '4d' } },
  Rh: { z: 45, symbol: 'Rh', name: 'Родий', shift: { from: '5s', to: '4d' } },
  Pd: { z: 46, symbol: 'Pd', name: 'Палладий', shift: { from: '5s', to: '4d' } },
  Ag: { z: 47, symbol: 'Ag', name: 'Серебро', shift: { from: '5s', to: '4d' } },
  Pt: { z: 78, symbol: 'Pt', name: 'Платина', shift: { from: '6s', to: '5d' } },
  Au: { z: 79, symbol: 'Au', name: 'Золото', shift: { from: '6s', to: '5d' } },
};

/** Элементы-референсы по номерам (символ, название) — для паспорта. */
export const ELEMENTS = {
  1: ['H', 'Водород'], 2: ['He', 'Гелий'],
  3: ['Li', 'Литий'], 4: ['Be', 'Бериллий'], 5: ['B', 'Бор'], 6: ['C', 'Углерод'],
  7: ['N', 'Азот'], 8: ['O', 'Кислород'], 9: ['F', 'Фтор'], 10: ['Ne', 'Неон'],
  11: ['Na', 'Натрий'], 12: ['Mg', 'Магний'], 13: ['Al', 'Алюминий'],
  14: ['Si', 'Кремний'], 15: ['P', 'Фосфор'], 16: ['S', 'Сера'],
  17: ['Cl', 'Хлор'], 18: ['Ar', 'Аргон'],
  19: ['K', 'Калий'], 20: ['Ca', 'Кальций'], 21: ['Sc', 'Скандий'],
  22: ['Ti', 'Титан'], 23: ['V', 'Ванадий'], 24: ['Cr', 'Хром'],
  25: ['Mn', 'Марганец'], 26: ['Fe', 'Железо'], 27: ['Co', 'Кобальт'],
  28: ['Ni', 'Никель'], 29: ['Cu', 'Медь'], 30: ['Zn', 'Цинк'],
  31: ['Ga', 'Галлий'], 32: ['Ge', 'Германий'], 33: ['As', 'Мышьяк'],
  34: ['Se', 'Селен'], 35: ['Br', 'Бром'], 36: ['Kr', 'Криптон'],
  37: ['Rb', 'Рубидий'], 38: ['Sr', 'Стронций'], 39: ['Y', 'Иттрий'],
  40: ['Zr', 'Цирконий'], 41: ['Nb', 'Ниобий'], 42: ['Mo', 'Молибден'],
  43: ['Tc', 'Технеций'], 44: ['Ru', 'Рутений'], 45: ['Rh', 'Родий'],
  46: ['Pd', 'Палладий'], 47: ['Ag', 'Серебро'], 48: ['Cd', 'Кадмий'],
  49: ['In', 'Индий'], 50: ['Sn', 'Олово'], 51: ['Sb', 'Сурьма'],
  52: ['Te', 'Теллур'], 53: ['I', 'Иод'], 54: ['Xe', 'Ксенон'],
};

/** Подоболочки, которые реально нужны для элемента с зарядом z. */
function shellsFor(z) {
  const shells = [];
  let remaining = z;
  for (const shell of FILL_ORDER) {
    if (remaining <= 0) break;
    const type = shell[1];
    shells.push({ shell, capacity: CAPACITY[type] });
    remaining -= CAPACITY[type];
  }
  return shells;
}

/**
 * Собрать эталонную конфигурацию элемента.
 * @returns {{
 *   z: number, symbol: string, name: string,
 *   shells: Array<{shell: string, electrons: number, cells: number}>,
 *   anomaly: object|null,
 * }}
 */
export function buildConfig(z) {
  const [symbol, name] = ELEMENTS[z] ?? ['?', 'Неизвестный'];
  const anomaly = Object.values(ANOMALIES).find((a) => a.z === z) ?? null;

  const shells = shellsFor(z).map(({ shell, capacity }) => ({
    shell,
    capacity,
    electrons: 0,
    cells: ORBITALS[shell[1]],
  }));

  let remaining = z;
  const byShell = new Map(shells.map((s) => [s.shell, s]));
  for (const shell of FILL_ORDER) {
    const rec = byShell.get(shell);
    if (!rec) continue;
    const put = Math.min(rec.capacity, remaining);
    rec.electrons = put;
    remaining -= put;
    if (remaining <= 0) break;
  }

  // Применяем «проскок»: один электрон с внешней s уходит на предвнешнюю d
  if (anomaly) {
    const from = byShell.get(anomaly.shift.from);
    const to = byShell.get(anomaly.shift.to);
    if (from && to && from.electrons > 1 && to.electrons < to.capacity) {
      from.electrons -= 1;
      to.electrons += 1;
    }
  }

  return { z, symbol, name, shells, anomaly };
}

/**
 * Разложить число электронов подоболочки по клеткам (орбиталям) по правилу Хунда.
 * Сначала по одному электрону в каждую клетку, затем спаривание.
 * @returns {Array<Array<'up'|'down'>>} массив клеток, в каждой — направления спинов
 */
export function distributeElectrons(electrons, cells) {
  const result = Array.from({ length: cells }, () => []);
  let left = electrons;
  // первый проход: по одному в каждую клетку
  for (let i = 0; i < cells && left > 0; i++) {
    result[i].push('up');
    left--;
  }
  // второй проход: спаривание
  for (let i = 0; i < cells && left > 0; i++) {
    if (result[i].length === 1) {
      result[i].push('down');
      left--;
    }
  }
  return result;
}

/** Правильно ли заполнена подоболочка игроком. */
export function isShellCorrect(shellRecord, playerCells) {
  const expected = distributeElectrons(shellRecord.electrons, shellRecord.cells);
  return expected.every(
    (cell, i) =>
      (playerCells[i] ?? []).length === cell.length,
  );
}

/**
 * Сгенерировать задание Орбитария.
 * @param {{withAnomaly?: boolean}} options
 */
/**
 * РАЗБОР КОНФИГУРАЦИИ, ВВЕДЁННОЙ ИГРОКОМ.
 * Нужен для режима «песочница атома»: игрок пишет конфигурацию,
 * а игра на лету угадывает элемент.
 *
 * Принимает строки вида: «1s2 2s2 2p6», «1s²2s²2p⁶» (надстрочные),
 * «1s2,2s2,2p6». Возвращает разобранные подоболочки или ошибку.
 */

export const SUP_TO_DIGIT = { '⁰':0,'¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8,'⁹':9 };

/** Привести строку к «нормальному» виду: надстрочные -> обычные цифры. */
export function normalizeConfigInput(raw) {
  return String(raw)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => String(SUP_TO_DIGIT[d]))
    .replace(/[,;|]/g, ' ')
    // «1s22s22p6» -> «1s2 2s2 2p6»: вставляем пробел перед новой подоболочкой
    .replace(/([spdf])(\d+)(?=[1-7][spdf])/gi, '$1$2 ')
    // «1s2 2s» без числа рядом — оставляем, обработаем как 0 электронов
    .trim();
}

/**
 * Разобрать конфигурацию.
 * @param {string} raw
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   shells: Array<{shell: string, electrons: number}>,
 *   totalElectrons: number,
 * }}
 */
export function parseConfig(raw) {
  const text = normalizeConfigInput(raw);
  if (!text) return { ok: false, error: 'Пусто — введи конфигурацию, например 1s2 2s2 2p6', shells: [], totalElectrons: 0 };

  const tokens = text.split(/\s+/).filter(Boolean);
  const shells = [];
  let total = 0;

  for (const tok of tokens) {
    // Поддерживаем и «1s2», и «1s», и «1s 2» (число отдельно)
    const m = tok.match(/^([1-7])([spdf])(\d{0,2})$/i);
    if (!m) {
      return { ok: false, error: `Не понимаю «${tok}». Формат: 1s2, 2s2, 2p6…`, shells: [], totalElectrons: 0 };
    }
    const shell = m[1] + m[2].toLowerCase();
    const electrons = m[3] ? parseInt(m[3], 10) : 0;
    const cap = CAPACITY[m[2].toLowerCase()];
    if (electrons > cap) {
      return { ok: false, error: `На ${shell} не может быть больше ${cap} электронов`, shells: [], totalElectrons: 0 };
    }
    shells.push({ shell, electrons });
    total += electrons;
  }

  return { ok: true, shells, totalElectrons: total };
}

/**
 * Угадать элемент по конфигурации.
 * Возвращает ближайший нейтральный атом, ион или null.
 * @returns {{
 *   match: 'atom'|'ion'|'none',
 *   z?: number, symbol?: string, name?: string,
 *   charge?: number, ionLabel?: string,
 *   expected?: string,
 *   config?: string,
 * }}
 */
export function identifyAtom(raw) {
  const parsed = parseConfig(raw);
  if (!parsed.ok) return { match: 'none', error: parsed.error };

  const z = parsed.totalElectrons;
  if (z === 0) return { match: 'none', error: 'Ноль электронов — так не бывает' };

  // Точное совпадение с нейтральным атомом (учитываем аномалии).
  // Сравниваем БЕЗ учёта порядка подоболочек — ученик может писать
  // 3d раньше 4s, это одна и та же конфигурация.
  if (z <= 118) {
    const ref = buildConfig(z);
    const refStr = configString(ref);
    const userStr = configString({ shells: parsed.shells });
    if (sameConfig(refStr, userStr)) {
      return {
        match: 'atom', z, symbol: ref.symbol, name: ref.name,
        config: refStr, expected: refStr,
      };
    }
    return {
      match: 'ion',
      z,
      symbol: ref.symbol, name: ref.name,
      config: userStr,
      expected: refStr,
      // По числу электронов ищем ближайший элемент в периодической таблице
      charge: estimateCharge(z),
      ionLabel: ionLabelFor(z),
    };
  }

  return { match: 'none', error: `Слишком много электронов: ${z}` };
}

/** Собрать каноничную строку конфигурации из подоболочек. */
export function configString({ shells }) {
  return shells
    .filter((s) => s.electrons > 0)
    .map((s) => s.shell + s.electrons)
    .join(' ');
}

/** Сравнить две конфигурации без учёта порядка подоболочек. */
function sameConfig(a, b) {
  const norm = (s) =>
    s.split(' ').filter(Boolean).sort().join(' ');
  return norm(a) === norm(b);
}

/** Простая оценка заряда иона по числу электронов (ближайший элемент). */
function estimateCharge(electrons) {
  // Ищем элемент, у которого Z ближе всего к числу электронов
  let best = null;
  for (const zStr of Object.keys(ELEMENTS)) {
    const z = Number(zStr);
    const diff = Math.abs(z - electrons);
    if (diff <= 3 && (!best || diff < best.diff)) best = { z, diff };
  }
  return best ? best.z - electrons : 0;
}

/** Подпись иона: «Cu2+», «Cl-» и т.п. */
function ionLabelFor(electrons) {
  let best = null;
  for (const zStr of Object.keys(ELEMENTS)) {
    const z = Number(zStr);
    const diff = Math.abs(z - electrons);
    if (diff <= 3 && (!best || diff < best.diff)) best = { z, diff };
  }
  if (!best) return null;
  const charge = best.z - electrons;
  if (charge === 0) return null;
  const [symbol] = ELEMENTS[best.z];
  const sign = charge > 0 ? '+' : '\u2013';
  const abs = Math.abs(charge);
  return symbol + (abs > 1 ? abs : '') + sign;
}

export function generateOrbitalTask(options = {}) {
  const { withAnomaly = true } = options;

  // Пул элементов: простые + иногда аномальные
  const simpleZ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const advancedZ = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

  const pool = withAnomaly && Math.random() < 0.35 ? advancedZ : simpleZ;
  const z = pool[Math.floor(Math.random() * pool.length)];

  return buildConfig(z);
}
