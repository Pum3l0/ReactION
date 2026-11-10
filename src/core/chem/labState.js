import { computeMixture, checkShiftGoal } from './reactionEngine.js';
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
    this.gasSprites = new Map();   // vesselId -> tick
    this.steamTickers = new Map(); // vesselId -> tick
    this.heating = new Set();      // id сосудов, стоящих на горелке
    this.lastResult = null;
    this.lastVesselId = null;
  }

  get vessels() {
    return this.lab.vessels;
  }

  /** Налить реагент из склянки в сосуд. */
  pour(reagentId, vesselId, amount = 5) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel) return { ok: false, reason: 'Нет такого сосуда' };

    const free = vessel.capacity - vessel.volume;
    if (free <= 0) return { ok: false, reason: 'Сосуд полон' };

    const added = vessel.add(reagentId, amount);
    if (added <= 0) return { ok: false, reason: 'Сосуд полон' };

    this._refresh(vessel);
    return { ok: true, added, full: vessel.capacity - vessel.volume <= 0 };
  }

  /** Перелить из одного сосуда в другой. */
  decant(fromId, toId) {
    const from = this.lab.getVessel(fromId);
    const to = this.lab.getVessel(toId);
    if (!from || !to || from.isEmpty) return { ok: false };

    const added = to.add(from.reagentIds[0], from.volume);
    if (added <= 0) return { ok: false, reason: 'Сосуд полон' };
    from.clear();
    this._refresh(from);
    this._refresh(to);
    return { ok: true };
  }

  /** Полностью освободить сосуд. */
  empty(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel) return;
    vessel.clear();
    clearPrecipitate(vessel.group);
    clearSteam(vessel.group);
    this.stopHeating(vesselId);
    // Мгновенно прячем жидкость
    vessel.liquid.userData.level = 0;
    setLiquidLevel(vessel.liquid, 0, 0.2);
    tintLiquid(vessel.liquid, 0xdfe9f0, 0.2);
    this.lastResult = null;
  }

  reset() {
    for (const v of this.lab.vessels) this.empty(v.id);
  }

  /** Поставить сосуд на горелку: показываем пламя и/или пар. */
  startHeating(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'В сосуде пусто' };
    this.heating.add(vesselId);
    this.lab.flame.setOn(true);

    // Если есть жидкость — показываем пар
    if (this.steamTickers.has(vesselId)) return { ok: true };
    const { tick } = spawnSteam(vessel.group, (pts) => {
      pts.geometry.dispose();
      pts.material.dispose();
      vessel.group.remove(pts);
      this.steamTickers.delete(vesselId);
    });
    this.steamTickers.set(vesselId, tick);
    return { ok: true, hot: true };
  }

  stopHeating(vesselId) {
    this.heating.delete(vesselId);
    if (this.heating.size === 0) this.lab.flame.setOn(false);
    const vessel = this.lab.getVessel(vesselId);
    if (vessel) clearSteam(vessel.group);
    this.steamTickers.delete(vesselId);
  }

  _refresh(vessel) {
    setLiquidLevel(vessel.liquid, vessel.level);

    const result = computeMixture(vessel.reagentIds);
    this.lastResult = result;
    this.lastVesselId = vessel.id;

    if (result.solutionColor) tintLiquid(vessel.liquid, result.solutionColor);

    clearPrecipitate(vessel.group);
    const precip = result.reactions.find((r) => r.precipitate && r.color);
    if (precip) {
      spawnPrecipitate(vessel.group, precip.color, precip.precipitate === 'weak', vessel.liquid);
    }

    const gas = result.reactions.find((r) => r.gas);
    if (gas) this._startGas(vessel, gas.bubbles);
  }

  _startGas(vessel, color) {
    if (this.gasSprites.has(vessel.id)) return;
    const { mesh, tick } = spawnGas(vessel.group, color, vessel.liquid, (m) => {
      m.geometry.dispose();
      m.material.dispose();
      vessel.group.remove(m);
      this.gasSprites.delete(vessel.id);
    });
    this.gasSprites.set(vessel.id, tick);
  }

  /**
   * Фильтрование: отделяем осадок от жидкости.
   * В сосуде остаётся прозрачный раствор, осадок уходит на фильтр.
   */
  filter(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'Сосуд пуст' };

    const result = computeMixture(vessel.reagentIds);
    const precip = result.reactions.find((r) => r.precipitate && r.formula);
    if (!precip) return { ok: false, reason: 'В сосуде нет осадка для фильтрования' };

    // Осадок уходит на фильтр: убираем его визуально и осветляем раствор.
    clearPrecipitate(vessel.group);
    // Фильтрат — цвета оставшихся растворённых ионов (обычно бесцветный).
    const dissolved = vessel.contents
      .map((c) => REAGENTS[c.id])
      .find((r) => r?.color && !r.tags?.includes('metal'));
    tintLiquid(vessel.liquid, dissolved?.color ?? 0xe8f2ff);

    vessel.filtrate = precip.formula;
    return { ok: true, precipitate: precip.name ?? precip.formula };
  }

  /**
   * Магнит: вытягиваем железную стружку (или другой ферромагнитный металл)
   * из содержимого сосуда.
   */
  magnet(vesselId) {
    const vessel = this.lab.getVessel(vesselId);
    if (!vessel || vessel.isEmpty) return { ok: false, reason: 'Сосуд пуст' };

    const before = vessel.contents.length;
    const metalIds = ['fe', 'zn'];
    const hadMetal = vessel.contents.some((c) => metalIds.includes(c.id));
    vessel.contents = vessel.contents.filter((c) => !metalIds.includes(c.id));
    if (!hadMetal) return { ok: false, reason: 'Магниту тут нечего притягивать' };

    const removed = before - vessel.contents.length;
    // Пересчитываем состояние после извлечения металла
    if (vessel.contents.length) {
      this._refresh(vessel);
    } else {
      this.empty(vesselId);
    }
    return { ok: true, removed: removed * 6 };
  }

  update(dt, elapsed) {
    for (const tick of this.gasSprites.values()) tick(dt);
    for (const tick of this.steamTickers.values()) tick(dt);
    this.lab.flame.tick(dt, elapsed);
  }

  /** Проверить задание (если оно есть). */
  checkGoal() {
    if (!this.task) return { ok: null, reason: 'Режим-полигон: заданий нет.' };
    if (!this.lastResult) return { ok: false, reason: 'Пока ничего не произошло.' };
    return checkShiftGoal(this.task, this.lastResult);
  }
}

