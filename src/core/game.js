/**
 * Игровое состояние: текущая локация, прогресс, ответы игрока.
 * Сохраняется в localStorage, чтобы «Продолжить» работало.
 */
const STORAGE_KEY = 'reaction.save.v2';

export class Game {
  constructor() {
    this.state = this._load() ?? {
      currentLocation: null,
      solved: [],
      mode: 'shift',       // 'shift' | 'lab' — активный раздел
      shiftSolved: [],      // id выполненных заданий смены
      labSolved: [],        // id выполненных лабораторных опытов
    };
    // Мягкая миграция со старого сейва
    this.state.mode ??= 'shift';
    this.state.shiftSolved ??= [];
    this.state.labSolved ??= [];
  }

  setLocation(id) {
    this.state.currentLocation = id;
    this.save();
  }

  /** Активный раздел: смена (история) или лаборатория (учёба). */
  setMode(mode) {
    this.state.mode = mode;
    this.save();
  }

  get mode() {
    return this.state.mode;
  }

  markSolved(taskId) {
    if (!this.state.solved.includes(taskId)) {
      this.state.solved.push(taskId);
      this.save();
    }
  }

  isSolved(taskId) {
    return this.state.solved.includes(taskId);
  }

  // --- Прогресс смены ---

  markShiftTaskSolved(id) {
    if (!this.state.shiftSolved.includes(id)) {
      this.state.shiftSolved.push(id);
      this.save();
    }
  }

  solvedShiftTasks() {
    return [...this.state.shiftSolved];
  }

  // --- Прогресс лаборатории ---

  markLabTaskSolved(id) {
    if (!this.state.labSolved.includes(id)) {
      this.state.labSolved.push(id);
      this.save();
    }
  }

  solvedLabTasks() {
    return [...this.state.labSolved];
  }

  clearSolved(locationId) {
    this.state.solved = this.state.solved.filter((id) => id !== locationId);
    this.save();
  }

  reset() {
    this.state = {
      currentLocation: null,
      solved: [],
      mode: 'shift',
      shiftSolved: [],
      labSolved: [],
    };
    this.save();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* localStorage может быть недоступен — игнорируем */
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
