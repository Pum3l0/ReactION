import {
  REAGENTS, SOLUBILITY, INDICATORS,
  THERMAL, THERMAL_REAGENT, SUBSTANCE_REACTIONS, SUBSTANCE_THERMAL,
} from '../../data/reactions.js';

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
// Contents may carry an ion override after a separation operation. Amounts are
// capacity units, not moles: this engine deliberately makes qualitative claims.
function entries(input) {
  return input.map((c) => typeof c === 'string' ? { id: c } : c)
    .filter((c) => REAGENTS[c.id] && (c.amount === undefined || c.amount > 0));
}

export function computeMixture(input) {
  const contents = entries(input);
  const reagentIds = [...new Set(contents.map((c) => c.id))];
  const aqueous = contents.some((c) => REAGENTS[c.id].state === 'liquid');
  const ions = aqueous ? collectIons(contents) : [];
  const reactions = [];
  // A rule requires ions from different reagents, not the two ions of a
  // single reagent (limewater, chalk, etc.). Deduplicate repeated additions.
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      if (contents[i].id === contents[j].id || !aqueous) continue;
      for (const a of availableIons(contents[i])) {
        for (const b of availableIons(contents[j])) {
          const rule = lookup(a, b);
          // Competing acid/base conditions need concentrations; do not assert
          // a hydroxide/carbonate/phosphate precipitate in that mixture.
          const uncertain = rule?.precipitate && ions.includes('H') && ['OH', 'CO3', 'PO4', 'SiO3'].some((ion) => a === ion || b === ion);
          if (!uncertain && isReal(rule) && !reactions.some((r) => r.pair?.includes(a) && r.pair?.includes(b))) {
            reactions.push({ ...rule, pair: [a, b] });
          }
        }
      }
    }
  }
  if (reactions.some((r) => r.formula === 'Cu2(OH)2CO3')) {
    reactions.push({ gas: true, product: 'CO2', name: 'углекислый газ', bubbles: 0xffffff });
  }
  // Insoluble chalk and oxides react as substances, not as free cations.
  if (ions.includes('H')) {
    if (contents.some((c) => c.id === 'caco3' && !c.processed)) {
      reactions.push({ gas: true, product: 'CO2', name: 'углекислый газ', bubbles: 0xffffff });
    }
    for (const id of ['cuo', 'fe2o3', 'cao']) {
      if (contents.some((c) => c.id === id && !c.processed)) {
        reactions.push({ neutral: true, name: REAGENTS[id].name + ' реагирует с кислотой' });
      }
    }
  }
  if (aqueous) {
    for (const rule of SUBSTANCE_REACTIONS) {
      if (matchesSubstances(contents, rule)) reactions.push({ ...rule });
    }
  }
  const medium = detectMedium(ions);
  for (const id of reagentIds.filter((id) => INDICATORS[id])) {
    if (aqueous) reactions.push(computeIndicator(id, ions));
  }
  return {
    reactions, medium, aqueous, reagentIds,
    solutionColor: aqueous ? resolveSolutionColor(reagentIds.filter((id) => {
      const r = REAGENTS[id];
      if (!r.color || r.tags.includes('indicator')) return true;
      return contents.some((c) => c.id === id && availableIons(c).some((ion) => !['SO4', 'Cl', 'NO3'].includes(ion)));
    }), reactions, medium) : null,
    hasPrecipitate: reactions.some((r) => r.precipitate),
    hasGas: reactions.some((r) => r.gas),
  };
}

export function computeHeated(input) {
  const contents = entries(input);
  const mixture = computeMixture(contents);
  const found = [];
  // Heat existing precipitates, never hypothetical pairs of unreacted ions.
  for (const precipitate of mixture.reactions.filter((r) => r.precipitate)) {
    const [a, b] = precipitate.pair;
    const rule = THERMAL[a + '|' + b] ?? THERMAL[b + '|' + a];
    if (rule) found.push({ ...rule, thermal: true, pair: [a, b] });
  }
  for (const c of contents) {
    const rule = THERMAL_REAGENT[c.id];
    if (rule && !c.processed) found.push({ ...rule, thermal: true, reagentId: c.id });
  }
  for (const rule of SUBSTANCE_THERMAL) {
    if (matchesSubstances(contents, rule)) found.push({ ...rule });
  }
  found.sort((a, b) => priority(b) - priority(a));
  const reactions = found.slice(0, 1);
  return { reactions, reagentIds: mixture.reagentIds, changed: reactions.length > 0 };
}

function matchesSubstances(contents, rule) {
  if (rule.dry && contents.some((c) => REAGENTS[c.id].state === 'liquid')) return false;
  return rule.reagents.every((id) => contents.some((c) => c.id === id && !c.processed &&
    (!rule.requiredIons?.[id] || availableIons(c).includes(rule.requiredIons[id]))));
}

/** Вес наглядности термической реакции. */
function priority(r) {
  if (r.decomposes) return 3;
  if (r.gas) return 2;
  if (r.color) return 1;
  return 0;
}

/** Плоский список ионов из всех налитых реагентов. */
function availableIons(c) {
  const r = REAGENTS[c.id];
  // Metals and insoluble oxides are not dissolved metal cations. Their
  // reactions require separate reagent-specific rules, outside this model.
  if (!r || r.tags.includes('metal') || r.tags.includes('oxide') || c.id === 'caco3') return [];
  return c.ions ?? r.ions;
}

export function collectIons(input) {
  return [...new Set(entries(input).flatMap(availableIons))];
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
  if (hasOH && hasH) return 'unknown'; // No concentrations: do not claim equivalence.
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
  else if (medium === 'neutral') color = spec.neutralColor ?? null;
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
  if (medium === 'unknown' && reagentIds.some((id) => INDICATORS[id])) return null;
  const indicator = reactions.find((r) => r.indicator && r.form === 'solution' && r.color);
  if (indicator) return indicator.color;

  const precip = reactions.find((r) => r.precipitate && r.color);
  if (precip) return precip.color;

  // Цвет самого заметного реагента (например, CuSO4 — голубой)
  let last = null;
  for (const id of reagentIds) {
    const reagent = REAGENTS[id];
    if (reagent?.color && !reagent.tags.includes('metal') && !reagent.tags.includes('oxide') && id !== 'litmus') last = reagent.color;
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
      // Реакция от нагрева: показываем уравнение и что выделилось
      const parts = ['🔥 ' + r.name];
      if (r.gas && r.gas !== 'H2O') {
        const g = r.gas === 'NH3' ? 'аммиак NH3' : r.gas === 'CO2' ? 'углекислый газ CO2' : r.gas;
        parts.push('↑ выделяется газ: ' + g);
      } else if (r.gas === 'H2O') {
        parts.push('выделяется водяной пар');
      }
      lines.push({
        kind: 'heat',
        text: parts.join(' · '),
        formula: r.equation ?? r.toFormula,
      });
    } else if (r.precipitate && r.formula) {
      lines.push({
        kind: 'precipitate',
        text: r.name + ' — осадок',
        formula: r.formula,
        color: r.color,
      });
    } else if (r.deposit) {
      lines.push({ kind: 'deposit', text: r.name + '. ' + r.equation, formula: r.formula });
    } else if (r.gas) {
      lines.push({ kind: 'gas', text: r.name + (r.equation ? '. ' + r.equation : ' — газ'), formula: r.product });
    } else if (r.neutral) {
      lines.push({ kind: 'neutral', text: r.name });
    } else if (r.indicator) {
      lines.push({ kind: 'indicator', text: r.name + ': ' + ({ basic: 'щелочная среда', acid: 'кислая среда', neutral: 'нейтральная среда' }[r.medium] ?? 'среда не определена') });
    }
  }

  if (!lines.length && formulas.length) {
    lines.push({ kind: 'none', text: 'Для этих веществ и условий результат моделью не определён. Это не означает отсутствия реакции в действительности.' });
  }

  return lines;
}

/**
 * Сверить результат опыта с эталоном задания.
 */
export function checkShiftGoal(task, result) {
  if (!task) return { ok: null, reason: 'Заданий нет.' };
  const goal = task.goal;
  const rs = result.reactions ?? [];
  if (task.reagents.some((id) => !result.reagentIds?.includes(id))) {
    return { ok: false, reason: 'Собери все реагенты задания в одном сосуде.' };
  }

  switch (goal.kind) {
    case 'precipitate': {
      const hit = rs.find((r) => r.precipitate && r.formula === goal.product);
      return hit
        ? { ok: true, reason: 'Получен ' + hit.name + '.' }
        : { ok: false, reason: 'Осадок нужного состава не выпал.' };
    }
    case 'deposit': {
      const hit = rs.find((r) => r.deposit && r.formula === goal.product);
      return { ok: !!hit, reason: hit ? 'Получен металл: ' + hit.formula + '.' : 'Нужный металл не выделился.' };
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
        ? { ok: true, reason: 'Получен ожидаемый результат нагрева.' }
        : { ok: false, reason: 'При нагреве нужного превращения не произошло.' };
    }
    case 'color': {
      const ok = result.aqueous && result.solutionColor === goal.color;
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
