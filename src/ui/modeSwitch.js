/**
 * Переключатель режимов «Смена / Лаборатория».
 *
 * Переключает весь раздел игры:
 *   Смена       — история: работа химика на производстве.
 *   Лаборатория — учёба: тренажёр лабораторных для школ без реактивов.
 */

export const MODES = [
  { id: 'shift', label: 'Смена', hint: 'Работа химика на производстве' },
  { id: 'lab', label: 'Лаборатория', hint: 'Тренажёр опытов для школ' },
];

export function createModeSwitch({ mode = 'shift', onMode } = {}) {
  const el = document.createElement('div');
  el.className = 'mode-switch';
  el.setAttribute('role', 'tablist');
  el.dataset.modeActive = mode;

  el.innerHTML =
    '<span class="mode-switch-thumb" aria-hidden="true"></span>' +
    MODES.map(
      (m) =>
        '<button class="mode-switch-tab" role="tab" data-mode="' + m.id +
        '" title="' + m.hint + '" aria-selected="' + (m.id === mode) + '">' +
        m.label + '</button>',
    ).join('');

  const tabs = [...el.querySelectorAll('.mode-switch-tab')];
  const thumb = el.querySelector('.mode-switch-thumb');

  function placeThumb() {
    const active = el.querySelector('.mode-switch-tab[aria-selected="true"]');
    if (!active || !thumb) return;
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (active.offsetLeft - 4) + 'px)';
  }

  const onClick = (event) => {
    const tab = event.target.closest('[data-mode]');
    if (!tab || !el.contains(tab)) return;
    if (tab.dataset.mode === el.dataset.modeActive) return;
    event.stopPropagation();
    const id = tab.dataset.mode;
    el.dataset.modeActive = id;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === id)));
    placeThumb();
    // Ошибку в обработчике показываем явно, а не глотаем молча
    try {
      onMode?.(id);
    } catch (err) {
      console.error('[modeSwitch] onMode упал:', err);
    }
  };

  el.addEventListener('click', onClick);
  requestAnimationFrame(placeThumb);

  const observer = new ResizeObserver(placeThumb);
  observer.observe(el);

  el.setMode = (id) => {
    el.dataset.modeActive = id;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === id)));
    placeThumb();
  };
  el.destroy = () => {
    el.removeEventListener('click', onClick);
    observer.disconnect();
  };

  return el;
}
