import {
  SUBSTANCES,
  PARAMETERS,
  PARAM_LABELS,
  PARAM_HINTS,
} from './substances.js';

/**
 * Генератор случайной задачи-накладной.
 *
 * Алгоритм:
 *  1. Перемешать банк веществ и взять ROWS (10) штук.
 *  2. Первые SAMPLE_ROWS (4) — эталонные, показываются полностью
 *     (пример, чтобы игрок понял структуру таблицы).
 *  3. В остальных ROWS - SAMPLE_ROWS строках случайно выбрать
 *     GAPS (6) ячеек суммарно — это и есть пропуски.
 *
 * Возвращает объект задачи с полями строки/ячейки и метаданными.
 */

export const ROWS = 10;
export const SAMPLE_ROWS = 4;
export const GAPS = 6;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @returns {{
 *   id: string,
 *   rows: Array<{substanceKey: string, values: object, gaps: string[], isSample: boolean}>,
 *   totalGaps: number,
 * }}
 */
export function generateTask() {
  const picked = shuffle(SUBSTANCES).slice(0, ROWS);

  const rows = picked.map((sub, i) => ({
    substanceKey: sub.formula,
    values: { ...sub },
    isSample: i < SAMPLE_ROWS,
    gaps: [],
  }));

  // Строки-кандидаты на пропуски (не эталонные)
  const candidates = rows.filter((r) => !r.isSample);

  // Собрать все доступные ячейки (строка, параметр) и случайно выбрать GAPS
  const cells = [];
  for (const row of candidates) {
    for (const param of PARAMETERS) cells.push({ row, param });
  }
  const chosen = shuffle(cells).slice(0, GAPS);

  for (const { row, param } of chosen) {
    row.gaps.push(param);
  }

  return {
    id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    rows,
    totalGaps: chosen.length,
  };
}

/** Правильный ответ для ячейки. */
export function correctValue(row, param) {
  return row.values[param];
}

export { PARAMETERS, PARAM_LABELS, PARAM_HINTS };
