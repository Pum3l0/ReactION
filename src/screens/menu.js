/**
 * Экран главного меню (вход в игру).
 *
 * Пока это чистый DOM поверх 3D-сцены. Заголовок, подзаголовок и
 * кнопки. Логика вынесена через ctx(screenManager, events, game).
 */
export function menuScreen(container, ctx) {
  container.id = 'screen-menu';

  container.innerHTML = `
    <h1 class="menu-title">Chem<span class="accent">Quest</span></h1>
    <p class="menu-subtitle">Химия на смене</p>
    <div class="menu-buttons">
      <button class="btn btn--primary" data-action="start">Начать смену</button>
      <button class="btn" data-action="continue" disabled>Продолжить</button>
      <button class="btn" data-action="map">Карта локаций</button>
      <button class="btn btn--ghost" data-action="about">Об игре</button>
    </div>
    <p class="hint">Плейсхолдер-сцена · текстуры будут заменены</p>
  `;

  const onClick = (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;

    if (action === 'start' || action === 'map' || action === 'continue') {
      ctx.screens.show('map');
    } else if (action === 'about') {
      alert(
        'ChemQuest — игра, где ты работаешь химиком на производстве ' +
          'и решаешь реальные задачи вместо скучных тестов.',
      );
    }
  };

  container.addEventListener('click', onClick);

  return {
    dispose() {
      container.removeEventListener('click', onClick);
    },
  };
}
