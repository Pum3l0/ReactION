/**
 * Оконный менеджер в стиле "как в винде".
 *
 * Каждое окно:
 *  - перетаскивается за заголовок мышью,
 *  - закрывается крестиком,
 *  - существует в единственном экземпляре на свой тип (нельзя наплодить),
 *  - поднимается наверх при клике.
 *
 * Окна живут в слое #ui поверх сцены. Слой прозрачный — фон не затемняется.
 */

let zCounter = 100;

export class WindowManager {
  constructor(container) {
    this.container = container;
    this.open = new Map(); // type -> { el, ... }
  }

  /**
   * @param {string} type  уникальный тип окна (mendeleev / solubility / ...)
   * @param {{title: string, content: HTMLElement|string, x?: number, y?: number}} options
   */
  openWindow(type, { title, content, x = 200, y = 120 }) {
    // Одно окно на тип: если открыто — просто поднять и вернуть
    if (this.open.has(type)) {
      this.bringToFront(this.open.get(type));
      return this.open.get(type);
    }

    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.type = type;
    const safeX = Math.max(8, Math.min(x, window.innerWidth - 320));
    const safeY = Math.max(8, Math.min(y, window.innerHeight - 120));
    el.style.left = `${safeX}px`;
    el.style.top = `${safeY}px`;
    el.style.zIndex = ++zCounter;

    el.innerHTML = `
      <header class="window-bar" data-drag>
        <span class="window-title">${title}</span>
        <span class="window-actions">
          <button class="window-max" data-max aria-label="На весь экран">⛶</button>
          <button class="window-close" data-close aria-label="Закрыть">✕</button>
        </span>
      </header>
      <div class="window-content"></div>
    `;

    const contentEl = el.querySelector('.window-content');
    if (typeof content === 'string') contentEl.innerHTML = content;
    else if (content) contentEl.appendChild(content);

    // --- Перетаскивание за заголовок ---
    const bar = el.querySelector('[data-drag]');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const onPointerDown = (event) => {
      if (event.target.closest('[data-close]') || event.target.closest('[data-max]')) return;
      // Развёрнутое окно не таскаем
      if (el.classList.contains('is-maximized')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = parseFloat(el.style.left) || 0;
      originY = parseFloat(el.style.top) || 0;
      this.bringToFront(this.open.get(type));
      bar.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      const nextX = originX + event.clientX - startX;
      const nextY = originY + event.clientY - startY;
      // Не даём утащить окно полностью за пределы экрана
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 40;
      el.style.left = `${Math.min(Math.max(nextX, -el.offsetWidth + 60), maxX)}px`;
      el.style.top = `${Math.min(Math.max(nextY, 0), maxY)}px`;
    };
    const onPointerUp = (event) => {
      dragging = false;
      if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
    };

    bar.addEventListener('pointerdown', onPointerDown);
    bar.addEventListener('pointermove', onPointerMove);
    bar.addEventListener('pointerup', onPointerUp);

    // --- Клик по телу окна поднимает его ---
    const onBodyDown = () => this.bringToFront(this.open.get(type));
    el.addEventListener('pointerdown', onBodyDown);

    // --- Закрытие ---
    el.querySelector('[data-close]').addEventListener('click', () => this.closeWindow(type));

    // --- Разворот на весь экран ---
    const maxBtn = el.querySelector('[data-max]');
    maxBtn.addEventListener('click', () => {
      const maximized = el.classList.toggle('is-maximized');
      maxBtn.setAttribute('aria-label', maximized ? 'Свернуть окно' : 'На весь экран');
      maxBtn.textContent = maximized ? '❐' : '⛶';
      maxBtn.title = maximized ? 'Свернуть окно' : 'На весь экран';
      if (maximized) {
        // Запоминаем положение, чтобы вернуть при восстановлении
        el.dataset.restoreLeft = el.style.left;
        el.dataset.restoreTop = el.style.top;
        el.style.left = '0';
        el.style.top = '0';
      } else {
        el.style.left = el.dataset.restoreLeft || '200px';
        el.style.top = el.dataset.restoreTop || '120px';
      }
      this.bringToFront(this.open.get(type));
    });

    this.container.appendChild(el);
    const record = { el };
    this.open.set(type, record);
    return record;
  }

  bringToFront(record) {
    if (record?.el) record.el.style.zIndex = ++zCounter;
  }

  closeWindow(type) {
    const record = this.open.get(type);
    if (!record) return;
    record.el.remove();
    this.open.delete(type);
  }

  isOpen(type) {
    return this.open.has(type);
  }

  closeAll() {
    for (const type of [...this.open.keys()]) this.closeWindow(type);
  }
}
