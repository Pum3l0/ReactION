/**
 * Игровое состояние: текущая локация, прогресс, ответы игрока.
 * Сохраняется в localStorage, чтобы «Продолжить» работало.
 */
const STORAGE_KEY = 'reaction.save.v1';

export class Game {
  constructor() {
    this.state = this._load() ?? {
      currentLocation: null,
      solved: [],
    };
  }

  setLocation(id) {
    this.state.currentLocation = id;
    this.save();
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

  /**
   * Сбросить прогресс локации: следующая задача соберётся заново —
   * другие вещества и другие пропуски.
   */
  clearSolved(locationId) {
    this.state.solved = this.state.solved.filter((id) => id !== locationId);
    this.save();
  }

  reset() {
    this.state = { currentLocation: null, solved: [] };
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
