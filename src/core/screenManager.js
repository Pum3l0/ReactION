/**
 * Менеджер экранов.
 *
 * Экраны — это DOM-узлы внутри #ui. Переключение = включить .is-active
 * у нужного и выключить у остальных. Каждый экран может быть функцией
 * mount(container, ctx), которая возвращает объект с dispose().
 */

export class ScreenManager {
  constructor(container, ctx) {
    this.container = container;
    this.ctx = ctx;
    this.screens = new Map();
    this.current = null;
  }

  /**
   * @param {string} id        уникальное имя экрана
   * @param {(container: HTMLElement, ctx: object) => ({dispose?: () => void}|void)} factory
   */
  register(id, factory) {
    const el = document.createElement('section');
    el.className = 'screen';
    el.id = `screen-${id}`;
    this.container.appendChild(el);
    this.screens.set(id, { el, factory, instance: null, mounted: false });
  }

  /** Показать экран по id. */
  show(id) {
    const next = this.screens.get(id);
    if (!next) {
      console.warn(`[ScreenManager] экран "${id}" не найден`);
      return;
    }
    if (this.current === id) return;

    if (this.current) {
      const prev = this.screens.get(this.current);
      prev.el.classList.remove('is-active');
      prev.instance?.onHide?.();
    }

    // Монтируем при первом показе
    if (!next.mounted) {
      next.instance = next.factory(next.el, this.ctx) || null;
      next.mounted = true;
    } else {
      // Экран уже смонтирован — даём ему шанс пересобраться
      next.instance?.onShow?.();
    }

    next.el.classList.add('is-active');
    this.current = id;
    this.ctx.events?.emit?.('screen:changed', id);
  }
}

/** Мини-эмиттер событий — связывает UI и сцену без прямых зависимостей. */
export function createEvents() {
  const handlers = new Map();
  return {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => handlers.get(name)?.delete(fn);
    },
    emit(name, payload) {
      handlers.get(name)?.forEach((fn) => fn(payload));
    },
  };
}
