import { computeMixture, computeHeated, checkShiftGoal } from './reactionEngine.js';
import { transferContents, removeIons, extractIron } from './operations.js';
import { REAGENTS } from '../../data/reactions.js';
import {
  tintLiquid,
  setLiquidLevel,
  spawnPrecipitate,
  clearPrecipitate,
  spawnGas,
  spawnSteam,
  clearSteam,
} from '../three/lab/effects.js';
import { updateSolidGeometry } from '../three/lab/geometry.js';

/**
 * Состояние лабораторного стола.
 *
 * Связывает чистое состояние сосудов (labScene.LabVessel) с визуальными
 * эффектами и движком реакций. Экран lab.js говорит: «налей реагент в
 * сосуд», а этот модуль решает, что произойдёт и как это показать.
 */
export class LabState {
  constructor(lab, task) {
    this.lab = lab;
    this.task = task;              // может быть null (режим-полигон)
    this.gasMeshes = new Map();
    this.gasSprites = new Map();   // vesselId -> tick
    this.steamTickers = new Map(); // vesselId -> tick
    this.heating = new Set();      // id сосудов, стоящих на горелке
    this.lastResult = null;
    this.lastVesselId = null;
    this.log = [];                 // журнал опытов: выполненные реакции
  }

  /**
   * Записать реакцию в журнал (без дублей подряд).
   * Нужно, чтобы ученик в конце видел список своих опытов и уравнений.
   */
  _logReaction(vessel, result) {
    const key = vessel.reagentIds.join('+') + '|' + result.reactions.map((r) => r.formula ?? r.product ?? '').join(',');
    if (this._lastLogKey === key) return;
    this._lastLogKey = key;
    const reacted = result.reactions.filter((r) => r.precipitate || r.deposit || r.gas || r.neutral || r.thermal);
    if (!reacted.length) return;
    this.log.push({
      vessel: vessel.id,
      reagentIds: [...vessel.reagentIds],
      reactions: reacted.map((r) => ({
        kind: r.precipitate ? 'precipitate' : r.deposit ? 'deposit' : r.gas ? 'gas' : 'neutral',
        formula: r.equation ?? r.formula ?? r.toFormula,
        name: r.name,
        product: r.product,
      })),
      time: Date.now(),
    });
    if (this.log.length > 40) this.log.shift();
  }

  get vessels() {
    return this.lab.vessels;
  }

  /** Собрать «реагент» в том виде, в каком его принимает сосуд. */
  _reagent(id) {
    const r = REAGENTS[id] ?? {};
    // state: 'solid' в данных -> phase: 'solid'; иначе — жидкость.
    // Металлы (гранулы/стружка) — тоже твёрдые.
    const isSolid = r.state === 'solid' || r.tags?.includes('metal');
    return { id, phase: isSolid ? 'solid' : 'liquid' };
  }

  /** Налить реагент из склянки в сосуд. */
  pour(reagentId, vesselId, amount = 5) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel) return { ok: false, reason: 'Нет такого сосуда' };

    if (!REAGENTS[reagentId] || !Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'Недопустимый реагент или объём' };
    const free = vessel.capacity - vessel.volume;
    if (free <= 0) return { ok: false, reason: 'Сосуд полон' };

    const added = vessel.add(this._reagent(reagentId), amount);
    if (added <= 0) return { ok: false, reason: 'Сосуд полон' };

    this._refresh(vessel);
    return { ok: true, added, full: vessel.capacity - vessel.volume <= 0 };
  }

  /**
   * Перелить ВСЁ содержимое из одного сосуда в другой.
   * Переносятся все реагенты с их фазами (жидкость и твёрдые).
   */
  decant(fromId, toId) {
    const from = this.lab.getVessel(fromId);
    const to = this.lab.getVessel(toId);
    if (!from || !to || from.isEmpty) return { ok: false, reason: 'Сосуд пуст' };
    if (from.id === to.id) return { ok: false, reason: 'Это один и тот же сосуд' };

    const movedAny = transferContents(from, to);
    if (movedAny <= 0) return { ok: false, reason: 'В приёмнике нет места' };
    this._refresh(from);
    this._refresh(to);
    return { ok: true, moved: movedAny };
  }

  /** Полностью освободить сосуд. */
  empty(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel) return;
    vessel.clear();
    clearPrecipitate(vessel.group);
    clearSteam(vessel.group);
    this.stopHeating(vesselId);
    // Прячем и жидкость, и твёрдое
    vessel.liquid.userData.level = 0;
    setLiquidLevel(vessel.liquid, 0, 0.2);
    tintLiquid(vessel.liquid, 0xdfe9f0, 0.2);
    if (vessel.solid) updateSolidGeometry(vessel.solid, 0);
    this._stopGas(vesselId);
    vessel.result = null;
    vessel.heated = null;
    if (this.lastVesselId === vesselId) {
      this.lastResult = null;
      this.lastHeated = null;
      this.lastVesselId = null;
    }
  }

  /** Показать струйку перелива между двумя сосудами. */
  startPourStream(fromVessel, toVessel) {
    const stream = this.lab.pourStream;
    if (!stream) return;
    const f = fromVessel.group.position.clone();
    f.y += fromVessel.shape ? fromVessel.shape.height * 0.9 : 1.5;
    const t = toVessel.group.position.clone();
    t.y += 0.5;
    stream.start(f, t);
  }

  stopPourStream() {
    this.lab.pourStream?.stop();
  }

  reset() {
    for (const v of this.lab.vessels) this.empty(v.id);
    // Убираем со стола материальные следы (фильтр, магнит)
    this.lab.strainer?.clear();
    this.lab.magnet?.clear();
  }

  /**
   * Поставить сосуд на горелку: зажигаем пламя, показываем пар И
   * запускаем термические реакции (разложение осадков и пр.).
   */
  startHeating(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'В сосуде пусто' };
    this.heating.add(vesselId);
    this.lab.flame.setOn(true);

    // Пар, если есть жидкость
    if (vessel.hasLiquid && !this.steamTickers.has(vesselId)) {
      const { tick } = spawnSteam(vessel.group, (pts) => {
        pts.geometry.dispose();
        pts.material.dispose();
        vessel.group.remove(pts);
        this.steamTickers.delete(vesselId);
      });
      this.steamTickers.set(vesselId, tick);
    }

    // Химия нагрева: термическое разложение
    const thermal = this._applyHeat(vessel);

    return { ok: true, hot: true, reactions: thermal };
  }

  /**
   * Рассчитать и показать термические реакции в сосуде.
   * Возвращает список дескрипторов (для надписи сверху).
   */
  _applyHeat(vessel) {
    const heated = computeHeated(vessel.contents);
    this.lastHeated = null;
    vessel.heated = null;
    if (!heated.changed) return [];
    // Retain a qualitative transformed state instead of regenerating the
    // original precipitate on the next refresh.
    for (const r of heated.reactions) {
      if (r.pair) removeIons(vessel.contents, r.pair, REAGENTS);
      if (r.solidProduct) {
        for (const c of vessel.contents.filter((c) => r.reagents.includes(c.id))) { c.processed = true; c.ions = []; }
      }
      if (r.reagentId) {
        for (const c of vessel.contents.filter((c) => c.id === r.reagentId)) {
          c.processed = true; c.ions = [];
        }
      }
    }

    // Применяем ВСЕ найденные реакции (их обычно 1–2).
    // Берём самую наглядную для цвета/осадка, газ пускаем отдельно.
    const main = heated.reactions.find((r) => r.color || r.decomposes)
      ?? heated.reactions.find((r) => r.gas)
      ?? heated.reactions[0];

    if (main.decomposes || main.solidProduct) {
      // Осадок/твёрдое превратилось: убираем облако осадка, перекрашиваем
      clearPrecipitate(vessel.group);
      if (main.color) {
        tintLiquid(vessel.liquid, main.color, 1.2);
        if (vessel.solid) vessel.solid.material.color.setHex(main.color);
      }
      if (vessel.solid && vessel.contents.some((c) => c.phase === 'solid')) {
        updateSolidGeometry(vessel.solid, vessel.solidLevel, 'powder');
      }
    } else if (main.color) {
      tintLiquid(vessel.liquid, main.color, 1.2);
      if (vessel.solid) vessel.solid.material.color.setHex(main.color);
    }

    // Пузырьки газа: у CO2 — белые, у NH3 — почти невидимые/ слегка жёлтые,
    // у водяного пара — уже есть отдельный эффект пара.
    const gasRule = heated.reactions.find((r) => r.gas && r.gas !== 'H2O');
    if (gasRule) {
      const color = gasRule.gas === 'NH3' ? 0xeaf2ff : 0xffffff;
      this._startGas(vessel, color, true); // force: перезапускаем поток газа
    }

    vessel.heated = heated;
    vessel.result = { ...computeMixture(vessel.contents), reactions: heated.reactions };
    this.lastResult = vessel.result;
    this._logReaction(vessel, vessel.result);
    this.lastHeated = heated;
    this.lastVesselId = vessel.id;
    return heated.reactions;
  }

  stopHeating(vesselId) {
    this.heating.delete(vesselId);
    if (this.heating.size === 0) this.lab.flame.setOn(false);
    const vessel = this.lab.getVessel(vesselId);
    if (vessel) clearSteam(vessel.group);
    this.steamTickers.delete(vesselId);
  }

  _refresh(vessel) {
    // 1. Уровень жидкости (только жидкая часть содержимого)
    setLiquidLevel(vessel.liquid, vessel.level);

    // 2. Твёрдое на дне: горка из частиц (порошок/гранулы/стружка)
    const solids = vessel.contents.filter((c) => c.phase === 'solid');
    if (solids.length && vessel.solid) {
      // Цвет — от первого твёрдого (металл — серый, соли — их цвет)
      const first = REAGENTS[solids[0].id];
      vessel.solid.material.color.setHex(first?.color ?? 0xcfcfcf);
      const variant = first?.tags?.includes('metal') ? 'granule' : 'powder';
      updateSolidGeometry(vessel.solid, vessel.solidLevel, variant);
    } else if (vessel.solid) {
      updateSolidGeometry(vessel.solid, 0);
    }

    // 3. Химреакция по всему содержимому
    const result = computeMixture(vessel.contents);
    vessel.heated = null;
    this.lastHeated = null;
    vessel.result = result;
    this.lastResult = result;
    this.lastVesselId = vessel.id;

    tintLiquid(vessel.liquid, result.solutionColor);

    clearPrecipitate(vessel.group);
    const precip = result.reactions.find((r) => (r.precipitate || r.deposit) && r.color);
    if (precip) {
      spawnPrecipitate(vessel.group, precip.color, precip.precipitate === 'weak', vessel);
    }

    const gas = result.reactions.find((r) => r.gas);
    if (gas) this._startGas(vessel, gas.bubbles);
    else this._stopGas(vessel.id);

    // Пишем реакцию в журнал опытов
    this._logReaction(vessel, result);
  }

  _stopGas(vesselId) {
    const mesh = this.gasMeshes.get(vesselId);
    if (mesh) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.gasMeshes.delete(vesselId);
    this.gasSprites.delete(vesselId);
  }

  _startGas(vessel, color, force = false) {
    // Обычно один поток газа на сосуд, но принудительно (нагрев)
    // перезапускаем — иначе видимого изменения не будет.
    if (this.gasSprites.has(vessel.id) && !force) return;
    this._stopGas(vessel.id);
    const { mesh, tick } = spawnGas(vessel.group, color, vessel, (m) => {
      m.geometry.dispose();
      m.material.dispose();
      vessel.group.remove(m);
      this.gasSprites.delete(vessel.id);
      this.gasMeshes.delete(vessel.id);
    });
    this.gasMeshes.set(vessel.id, mesh);
    this.gasSprites.set(vessel.id, tick);
  }

  /**
   * Фильтрование: отделяем осадок от жидкости.
   * В сосуде остаётся прозрачный раствор, осадок уходит на фильтр.
   */
  filter(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'Сосуд пуст' };

    const result = computeMixture(vessel.contents);
    const precip = result.reactions.find((r) => r.precipitate && r.formula);
    const insoluble = vessel.contents.filter((c) => ['caco3', 'cuo', 'fe2o3'].includes(c.id) && !c.processed);
    if (!vessel.hasLiquid || (!precip && !insoluble.length)) return { ok: false, reason: 'Нужна суспензия: фильтр не отделяет растворённые соли от воды.' };
    if (insoluble.length && result.reactions.some((r) => r.neutral || r.gas)) {
      return { ok: false, reason: 'Разделение реагирующей смеси этой моделью не поддерживается.' };
    }
    const separated = precip ?? REAGENTS[insoluble[0].id];
    vessel.contents = vessel.contents.filter((c) => !insoluble.includes(c));

    // Complete removal of the modelled precipitates, including their ions.
    // This is a qualitative operation; no residual concentration is claimed.
    const precipitates = result.reactions.filter((r) => r.precipitate);
    removeIons(vessel.contents, precipitates.flatMap((r) => r.pair), REAGENTS);
    this._refresh(vessel);
    this.lab.strainer?.setPrecipitate(separated.color ?? 0xf2f2ee, separated.name ?? separated.formula);
    return { ok: true, precipitate: separated.name ?? separated.formula };
  }

  /**
   * Магнит: вытягиваем железную стружку (или другой ферромагнитный металл)
   * из содержимого сосуда.
   */
  magnet(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'Сосуд пуст' };

    const before = vessel.contents.length;
    const metalIds = ['fe'];
    const hadMetal = vessel.contents.some((c) => metalIds.includes(c.id) && !c.processed);
    vessel.contents = extractIron(vessel.contents);
    if (!hadMetal) return { ok: false, reason: 'Магниту тут нечего притягивать' };

    const removed = before - vessel.contents.length;
    // Материальный след: магнит с прилипшей стружкой лежит на столе.
    this.lab.magnet?.setFilings(true);
    // Пересчитываем состояние после извлечения металла
    if (vessel.contents.length) {
      this._refresh(vessel);
    } else {
      this.empty(vesselId);
    }
    return { ok: true, removed };
  }

  update(dt, elapsed) {
    for (const tick of this.gasSprites.values()) tick(dt);
    for (const tick of this.steamTickers.values()) tick(dt);
    this.lab.flame.tick(dt, elapsed);
  }

  /** Проверить задание (если оно есть). */
  checkGoal() {
    if (!this.task) return { ok: null, reason: 'Режим-полигон: заданий нет.' };
    const vessel = this.lab.getVessel(this.lastVesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'Сначала выполни опыт в сосуде.' };
    const result = this.task.goal?.kind === 'heat' ? vessel.heated : vessel.result;
    if (!result) return { ok: false, reason: 'В текущем сосуде нет результата нужного опыта.' };
    return checkShiftGoal(this.task, result);
  }
}

