import { getLocationsByMode, getLocation, MODE_LABELS } from '../data/locations.js';
import { createModeSwitch } from '../ui/modeSwitch.js';
import { SHIFT_TASKS } from '../data/shiftTasks.js';

/**
 * Карта локаций — сетка карточек с превью.
 *
 * Сверху — переключатель «Смена / Лаборатория»: он меняет набор карточек.
 *
 * Превью:
 *  - склад: фон панорамы + маленький портрет Петровича;
 *  - Орбитарий / стол: миниатюрный 3D-атом (CSS-имитация орбит);
 *  - неоткрытые: заглушка «скоро».
 */
export function mapScreen(container, ctx) {
  container.id = 'screen-map';

  let mode = ctx.game.mode ?? 'shift';

  container.innerHTML = `
    <div class="map-header">
      <h2 class="map-heading" data-map-heading>Локации</h2>
      <div data-mode-switch></div>
      <button class="btn btn--ghost" data-action="back">← Меню</button>
    </div>

    <div class="map-grid" data-map-grid></div>
  `;

  const grid = container.querySelector('[data-map-grid]');
  const heading = container.querySelector('[data-map-heading]');

  const modeSwitch = createModeSwitch({
    mode,
    onMode: (id) => {
      mode = id;
      ctx.game.setMode(id);
      renderGrid();
    },
  });
  container.querySelector('[data-mode-switch]').replaceWith(modeSwitch);

  function renderGrid() {
    heading.textContent = MODE_LABELS[mode] ?? 'Локации';
    grid.innerHTML = getLocationsByMode(mode).map((loc) => renderCard(loc)).join('');
  }

  renderGrid();

  function renderCard(loc) {
    if (!loc.unlocked) {
      return `
        <article class="loc-card is-locked">
          <div class="loc-preview loc-preview--locked"><span>скоро</span></div>
          <div class="loc-body">
            <h3 class="loc-title">${loc.title}</h3>
            <p class="loc-sub">${loc.subtitle}</p>
          </div>
        </article>`;
    }

    const preview = loc.preview3d
      ? `<div class="loc-preview loc-preview--atom">
           <span class="atom-ring atom-ring--1"></span>
           <span class="atom-ring atom-ring--2"></span>
           <span class="atom-ring atom-ring--3"></span>
           <span class="atom-core"></span>
           <span class="atom-e atom-e--1"></span>
           <span class="atom-e atom-e--2"></span>
           <span class="atom-e atom-e--3"></span>
         </div>`
      : `<div class="loc-preview">
           <img class="loc-preview-img" src="${loc.preview}" alt="">
           ${loc.previewNpc ? `<img class="loc-preview-npc" src="${loc.previewNpc}" alt="">` : ''}
         </div>`;

    // Прогресс по заданиям — только для локации с заданиями («Архив»)
    let badge = '';
    if (loc.screen === 'lab-shift') {
      const done = ctx.game.solvedShiftTasks().length;
      const total = SHIFT_TASKS.length;
      badge = '<span class="loc-progress">' + done + ' / ' + total + '</span>';
    }

    return `
      <button class="loc-card" data-location="${loc.id}">
        ${preview}
        ${badge}
        <div class="loc-body">
          <h3 class="loc-title">${loc.title}</h3>
          <p class="loc-sub">${loc.subtitle}</p>
        </div>
      </button>`;
  }

  const onClick = (event) => {
    const card = event.target.closest('[data-location]');
    if (card) {
      const loc = getLocation(card.dataset.location);
      if (!loc?.screen) return;
      // Локация принадлежит разделу — синхронизируем режим, чтобы экран
      // лаборатории знал, работать с заданием или как полигон.
      if (loc.mode) ctx.game.setMode(loc.mode);
      ctx.game.setLocation(loc.id);
      ctx.screens.show(loc.screen);
      return;
    }
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('menu');
    }
  };

  container.addEventListener('click', onClick);
  return {
    onShow() {
      // Режим мог смениться с другого экрана — синхронизируем
      mode = ctx.game.mode ?? 'shift';
      modeSwitch.setMode(mode);
      renderGrid();
    },
    dispose() {
      container.removeEventListener('click', onClick);
      modeSwitch.destroy();
    },
  };
}
