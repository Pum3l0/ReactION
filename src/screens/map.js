import { LOCATIONS } from '../data/locations.js';

/**
 * Карта локаций — сетка карточек с превью.
 *
 * Превью:
 *  - склад: фон панорамы + маленький портрет Петровича;
 *  - Орбитарий: миниатюрный 3D-атом (CSS-имитация орбит);
 *  - неоткрытые: заглушка «скоро».
 */
export function mapScreen(container, ctx) {
  container.id = 'screen-map';

  container.innerHTML = `
    <div class="map-header">
      <h2 class="map-heading">Локации</h2>
      <button class="btn btn--ghost" data-action="back">← Меню</button>
    </div>

    <div class="map-grid">
      ${LOCATIONS.map((loc) => renderCard(loc)).join('')}
    </div>
  `;

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

    return `
      <button class="loc-card" data-location="${loc.id}">
        ${preview}
        <div class="loc-body">
          <h3 class="loc-title">${loc.title}</h3>
          <p class="loc-sub">${loc.subtitle}</p>
        </div>
      </button>`;
  }

  const onClick = (event) => {
    const card = event.target.closest('[data-location]');
    if (card) {
      const loc = LOCATIONS.find((l) => l.id === card.dataset.location);
      if (!loc?.screen) return;
      ctx.game.setLocation(loc.id);
      ctx.screens.show(loc.screen);
      return;
    }
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('menu');
    }
  };

  container.addEventListener('click', onClick);
  return { dispose: () => container.removeEventListener('click', onClick) };
}
