/**
 * Проверка ответов игрока.
 *
 * Приводим и ответ, и эталон к каноничному виду, чтобы прощать
 * разумные варианты написания:
 *  - регистр и пробелы
 *  - нижние индексы в формулах:  H₂SO₄ → H2SO4
 *  - русская "х" и латинская "x" в формулах
 *  - дефис/тире в названиях
 */

const SUBSCRIPT_MAP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

export function normalize(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/[₀-₉]/g, (ch) => SUBSCRIPT_MAP[ch] ?? ch)
    .replace(/[«»"'`]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Для формул: убираем вообще все пробелы. */
function normalizeFormula(input) {
  return normalize(input).replace(/\s+/g, '');
}

/**
 * @param {string} param   параметр (formula / name / cls / ...)
 * @param {string} answer  ввод игрока
 * @param {string} correct эталон
 * @returns {boolean}
 */
export function checkAnswer(param, answer, correct) {
  const a = param === 'formula' ? normalizeFormula(answer) : normalize(answer);
  const c = param === 'formula' ? normalizeFormula(correct) : normalize(correct);
  if (!a) return false;
  if (a === c) return true;

  // Для класса/связи/растворимости допускаем ответ без уточнения в скобках
  if (param !== 'formula' && param !== 'name' && param !== 'valency') {
    const strip = (s) => s.replace(/\(.*?\)/g, '').trim();
    return strip(a) === strip(c);
  }
  return false;
}
