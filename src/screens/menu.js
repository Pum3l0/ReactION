/**
 * Главное меню ReactION.
 *
 * Логотип: "React" + "ION" в кружке-частице. По клику на ION по всему
 * экрану разлетаются маленькие минусы (см. styles/menu.css).
 * На фоне дрейфуют молекулы углеводородов (MoleculeField).
 */
import { MoleculeField } from '../ui/moleculeField.js';

export function menuScreen(container, ctx) {
  container.id = 'screen-menu';

  container.innerHTML = `
    <canvas class="molecule-bg" data-molecule-bg></canvas>
    <div class="menu-inner">
      <h1 class="menu-logo" aria-label="ReactION">
        <span class="menu-logo-react">React</span><span class="menu-logo-ion" data-ion>ION<i class="ion-minus"></i></span>
      </h1>
      <p class="menu-subtitle">Химия на смене</p>

      <div class="menu-buttons">
        <button class="btn btn--primary" data-action="start">Начать смену</button>
        <button class="btn btn--tonal" data-action="map">Карта локаций</button>
        <button class="btn btn--ghost" data-action="about">Об игре</button>
      </div>
    </div>

    <!-- Полноэкранный слой для разлетающихся минусов -->
    <div class="ion-field" data-ion-field></div>

    <!-- Подпись автора -->
    <span class="credit">by pumelo</span>

    <div class="menu-modal" data-modal hidden>
      <div class="modal-scrim" data-modal-close></div>
      <div class="modal-window menu-about">
        <h3>Об игре</h3>
        <p>
          ReactION — игра, где ты работаешь химиком на производстве.
          Вместо скучных тестов — настоящие рабочие ситуации: восстанови
          накладную, которую залил кофе, определи вещества по формуле и
          свойствам. Применяй школьную химию там, где она реально нужна.
        </p>
        <button class="btn btn--primary" data-modal-close>Понятно</button>
      </div>
    </div>
  `;

  const modal = container.querySelector('[data-modal]');
  const ionField = container.querySelector('[data-ion-field]');

  // Живой фон: молекулы углеводородов
  const moleculeField = new MoleculeField(container.querySelector('[data-molecule-bg]'));

  const onClick = (event) => {
    const ion = event.target.closest('[data-ion]');
    if (ion) {
      emitElectrons(ion);
      return;
    }

    const btn = event.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      if (action === 'start' || action === 'map') ctx.screens.show('map');
      if (action === 'about') modal.hidden = false;
      return;
    }

    if (event.target.closest('[data-modal-close]')) {
      modal.hidden = true;
    }
  };

  /**
   * Рассыпать минусы из центра ION по всему экрану.
   * Частицы живут в полноэкранном слое .ion-field, поэтому ничто
   * их не обрезает и они улетают до краёв экрана.
   */
  function emitElectrons(ion) {
    const rect = ion.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const count = 16;
    const reach = Math.max(window.innerWidth, window.innerHeight);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * reach * 0.55;

      const minus = document.createElement('i');
      minus.className = 'ion-minus-particle';
      minus.style.setProperty('--x', `${cx}px`);
      minus.style.setProperty('--y', `${cy}px`);
      minus.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      minus.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      minus.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
      minus.style.animationDelay = `${i * 22}ms`;

      ionField.appendChild(minus);
      setTimeout(() => minus.remove(), 1600);
    }
  }

  container.addEventListener('click', onClick);
  return {
    dispose() {
      container.removeEventListener('click', onClick);
      moleculeField.destroy();
    },
  };
}
