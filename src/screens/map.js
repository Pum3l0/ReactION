import { LOCATIONS } from '../data/locations.js';

/**
 * Экран карты локаций. Пока кнопки-локации; позже — карта с узлами
 * поверх 3D-фона.
 */
export function mapScreen(container, ctx) {
  container.id = 'screen-map';

  container.innerHTML = `
    <div class="map-panel">
      <h2 class="map-heading">Локации</h2>
      <ul class="map-list">
        ${LOCATIONS.map(
          (loc) => `
          <li>
            <button class="btn map-item" data-location="${loc.id}" ${loc.unlocked ? '' : 'disabled'}>
              <span class="map-item-title">${loc.title}</span>
              <span class="map-item-sub">${loc.subtitle}</span>
            </button>
          </li>`,
        ).join('')}
      </ul>
      <button class="btn btn--ghost" data-action="back">← Назад в меню</button>
    </div>
  `;

  const onClick = (event) => {
    const item = event.target.closest('[data-location]');
    if (item) {
      ctx.game.setLocation(item.dataset.location);
      ctx.screens.show('level');
      return;
    }
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('menu');
    }
  };

  container.addEventListener('click', onClick);
  return { dispose: () => container.removeEventListener('click', onClick) };
}
