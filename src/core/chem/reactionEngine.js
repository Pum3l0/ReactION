import { REAGENTS, SOLUBILITY, INDICATORS, THERMAL, THERMAL_PRIORITY } from '../../data/reactions.js';

/**
 * Движок реакций — чистый расчёт. Здесь НЕТ Three.js.
 *
 * Логика:
 *   1. Смешать все ионы, налитые в сосуд.
 *   2. Для каждой пары катион/анион посмотреть в таблицу растворимости.
 *   3. Учесть индикаторы (меняют цвет по среде).
 *   4. Вернуть дескрипторы — что визуально должно произойти.
 *
 * Рендер читает дескрипторы и применяет к Mesh. Такое разделение
 * позволяет проверять химию без графики (см. тесты).
 */

/** Правило считается «настоящей реакцией», если даёт осадок/газ/нейтрализацию. */
function isReal(rule) {
  if (!rule) return false;
  if (rule.precipitate === false) return false;   // «растворимо» — не реакция
  if (rule.precipitate) return true;
  if (rule.gas) return true;
  if (rule.neutral) return true;
  return false;
}

/**
 * Смешать содержимое сосуда и посчитать результат.
 * @param {string[]} reagentIds — id реагентов в сосуде (в порядке добавления)
 */
export function computeMixture(reagentIds) {
  const ions = collectIons(reagentIds);
  const reactions = [];

  // Парный перебор ионов. Ионов единицы — перебор дешёвый.
  for (let i = 0; i < ions.length; i++) {
    for (let j = i + 1; j < ions.length; j++) {
      const rule = lookup(ions[i], ions[j]);
      if (isReal(rule)) reactions.push({ ...rule, pair: [ions[i], ions[j]] });
    }
  }

  // Индикаторы зависят не от пары ионов, а от среды раствора
  const indicators = reagentIds.filter((id) => INDICATORS[id]);
  for (const id of indicators) {
    const r = computeIndicator(id, ions);
    if (r) reactions.push(r);
  }

  const medium = detectMedium(ions);

  return {
    reactions,
    medium,
    solutionColor: resolveSolutionColor(reagentIds, reactions, medium),
    hasPrecipitate: reactions.some((r) => r.precipitate),
    hasGas: reactions.some((r) => r.gas),
  };
}

/**
 * Реакции, которые идут ТОЛЬКО при нагреве (термическое разложение).
 * @param {string[]} reagentIds — что сейчас в сосуде
 * @returns {{reactions: object[], changed: boolean}}
 */
export function computeHeated(reagentIds) {
  const ions = collectIons(reagentIds);
  const found = [];

  for (let i = 0; i < ions.length; i++) {
    for (let j = i + 1; j < ions.length; j++) {
      const rule = THERMAL[ions[i] + '|' + ions[j]] ?? THERMAL[ions[j] + '|' + ions[i]];
      if (rule) found.push({ ...rule, thermal: true, pair: [ions[i], ions[j]] });
    }
  }

  // Приоритет: разложение осадка важнее смены цвета. Берём самое наглядное.
  found.sort((a, b) => priority(b) - priority(a));
  const reactions = found.slice(0, 1);

  return { reactions, changed: reactions.length > 0 };
}

/** Вес наглядности термической реакции. */
function priority(r) {
  if (r.decomposes) return 3;
  if (r.gas) return 2;
  if (r.color) return 1;
  return 0;
}

/** Плоский список ионов из всех налитых реагентов. */
export function collectIons(reagentIds) {
  const out = [];
  for (const id of reagentIds) {
    const reagent = REAGENTS[id];
    if (reagent) out.push(...reagent.ions);
  }
  return out;
}

/** Найти правило для пары ионов. Порядок в ключе не важен. */
function lookup(a, b) {
  return SOLUBILITY[a + '|' + b] ?? SOLUBILITY[b + '|' + a] ?? null;
}

/** Среда раствора: 'basic' | 'acid' | 'neutral'. */
function detectMedium(ions) {
  const hasOH = ions.includes('OH');
  const hasH = ions.includes('H');
  if (hasOH && !hasH) return 'basic';
  if (hasH && !hasOH) return 'acid';
  if (hasOH && hasH) return 'neutral'; // нейтрализовались
  return 'neutral';
}

/**
 * Реакция индикатора в зависимости от среды.
 * form: 'paper' (лакмус) или 'solution' — разное поведение и отрисовка.
 */
function computeIndicator(id, ions) {
  const spec = INDICATORS[id];
  if (!spec) return null;
  const medium = detectMedium(ions);
  let color = null;
  if (medium === 'basic') color = spec.basicColor;
  else if (medium === 'acid') color = spec.acidColor;
  else color = spec.neutralColor ?? null;
  return {
    indicator: true,
    form: spec.form ?? 'solution',
    name: spec.name,
    medium,
    color,
  };
}

/**
 * Цвет раствора после смешивания.
 * Приоритет: индикатор -> осадок -> цвет исходного реагента.
 */
function resolveSolutionColor(reagentIds, reactions, medium) {
  const indicator = reactions.find((r) => r.indicator && r.color);
  if (indicator) return indicator.color;

  const precip = reactions.find((r) => r.precipitate && r.color);
  if (precip) return precip.color;

  // Цвет самого заметного реагента (например, CuSO4 — голубой)
  let last = null;
  for (const id of reagentIds) {
    const reagent = REAGENTS[id];
    if (reagent?.color) last = reagent.color;
  }
  if (last) return last;
  void medium;
  return null;
}

/**
 * Собрать текстовое описание результата — для надписи сверху в лаборатории.
 * Возвращает массив строк вида «CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄».
 */
export function describeResult(result, reagentIds) {
  const lines = [];
  const formulas = reagentIds.map((id) => REAGENTS[id]?.formula ?? id);

  for (const r of result.reactions) {
    if (r.thermal) {
      // Реакция от нагрева — со значком огня
      lines.push({ kind: 'heat', text: '🔥 ' + r.name, formula: r.toFormula });
    } else if (r.precipitate && r.formula) {
      lines.push({
        kind: 'precipitate',
        text: r.name + ' — осадок',
        formula: r.formula,
        color: r.color,
      });
    } else if (r.gas) {
      lines.push({ kind: 'gas', text: r.name + ' — газ', formula: r.product });
    } else if (r.neutral) {
      lines.push({ kind: 'neutral', text: 'нейтрализация, образовалась вода' });
    } else if (r.indicator && r.color) {
      lines.push({ kind: 'indicator', text: r.name + ': ' + (r.medium === 'basic' ? 'щелочная среда' : 'кислая среда') });
    }
  }

  if (!lines.length && formulas.length) {
    lines.push({ kind: 'none', text: 'Заметной реакции нет — вещества просто смешались.' });
  }

  return lines;
}

/**
 * Сверить результат опыта с эталоном задания.
 */
export function checkShiftGoal(task, result) {
  if (!task) return { ok: null, reason: 'Заданий нет.' };
  const goal = task.goal;
  const rs = result.reactions;

  switch (goal.kind) {
    case 'precipitate': {
      const hit = rs.find((r) => r.precipitate && r.formula === goal.product);
      return hit
        ? { ok: true, reason: 'Получен ' + hit.name + '.' }
        : { ok: false, reason: 'Осадок нужного состава не выпал.' };
    }
    case 'gas': {
      const hit = rs.find((r) => r.gas && r.product === goal.product);
      return hit
        ? { ok: true, reason: 'Газ выделяется — верно.' }
        : { ok: false, reason: 'Газ не выделился. Проверь реагенты.' };
    }
    case 'indicator': {
      const hit = rs.find((r) => r.indicator && r.color === goal.color);
      return hit
        ? { ok: true, reason: 'Индикатор показал верно.' }
        : { ok: false, reason: 'Индикатор не изменил цвет так, как нужно.' };
    }
    case 'neutral': {
      const hit = rs.find((r) => r.neutral);
      return hit
        ? { ok: true, reason: 'Реакция нейтрализации прошла.' }
        : { ok: false, reason: 'Нейтрализации не произошло.' };
    }
    case 'heat': {
      // Проверяется по результату нагрева (result.reactions c thermal),
      // а не по обычной смеси.
      const hit = (result.reactions ?? []).find(
        (r) => r.thermal && r.toFormula === goal.product,
      );
      return hit
        ? { ok: true, reason: 'Вещество разложилось при нагреве — верно.' }
        : { ok: false, reason: 'При нагреве нужного превращения не произошло.' };
    }
    case 'color': {
      const ok = result.solutionColor === goal.color;
      return ok
        ? { ok: true, reason: 'Раствор получился нужного цвета.' }
        : { ok: false, reason: 'Цвет раствора другой. Проверь реагенты.' };
    }
    default:
      return { ok: false, reason: 'Задание не распознано.' };
  }
}

export function reagentLabel(id) {
  return REAGENTS[id]?.formula ?? id;
}

export { REAGENTS, SOLUBILITY, INDICATORS, THERMAL };
