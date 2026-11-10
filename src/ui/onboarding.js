/**
 * Онбординг локаций — короткие подсказки при первом заходе.
 *
 * Хранит пройденные шаги в localStorage, чтобы не показывать одно и то же
 * дважды. Один шаг = подсветка элемента + текст.
 *
 * Использование:
 *   const ob = createOnboarding('lab', [
 *     { target: '.lab-panel-toggle', text: 'Открой панель реактивов' },
 *   ]);
 *   ob.start();
 */
const STORAGE_KEY = 'reaction.onboarding.v1';

function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function markSeen(key) {
  try {
    const seen = loadSeen();
    seen[key] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

export function isOnboarded(key) {
  return !!loadSeen()[key];
}

/**
 * @param {string} key — уникальный ключ локации
 * @param {Array<{target: string, text: string, title?: string}>} steps
 * @param {HTMLElement} host — куда вставлять оверлей
 */
export function createOnboarding(key, steps, host) {
  if (isOnboarded(key) || !steps?.length) {
    return { start() {}, destroy() {}, skip() {} };
  }

  let index = 0;
  const overlay = document.createElement('div');
  overlay.className = 'onboarding';
  overlay.innerHTML =
    '<div class="onboarding-tip" data-tip>' +
      '<div class="onboarding-title" data-title></div>' +
      '<div class="onboarding-text" data-text></div>' +
      '<div class="onboarding-actions">' +
        '<button class="onboarding-skip" data-skip>Пропустить</button>' +
        '<button class="btn btn--primary onboarding-next" data-next>Далее</button>' +
      '</div>' +
    '</div>' +
    '<div class="onboarding-spot" data-spot></div>';

  host.appendChild(overlay);
  const tip = overlay.querySelector('[data-tip]');
  const spot = overlay.querySelector('[data-spot]');
  const titleEl = overlay.querySelector('[data-title]');
  const textEl = overlay.querySelector('[data-text]');
  const nextBtn = overlay.querySelector('[data-next]');

  function show() {
    const step = steps[index];
    const target = host.querySelector(step.target);
    if (!target) { next(); return; }

    const r = target.getBoundingClientRect();
    spot.style.left = r.left - 8 + 'px';
    spot.style.top = r.top - 8 + 'px';
    spot.style.width = r.width + 16 + 'px';
    spot.style.height = r.height + 16 + 'px';

    titleEl.textContent = step.title ?? ('Шаг ' + (index + 1) + ' из ' + steps.length);
    textEl.textContent = step.text;
    nextBtn.textContent = index === steps.length - 1 ? 'Понятно' : 'Далее';

    // Позиция подсказки: справа или слева от цели
    const tipW = 300;
    let left = r.right + 20;
    if (left + tipW > window.innerWidth) left = r.left - tipW - 20;
    if (left < 10) left = Math.max(10, (window.innerWidth - tipW) / 2);
    tip.style.left = left + 'px';
    tip.style.top = Math.min(Math.max(r.top, 10), window.innerHeight - 200) + 'px';
  }

  function next() {
    index += 1;
    if (index >= steps.length) { finish(); return; }
    show();
  }

  function finish() {
    markSeen(key);
    overlay.remove();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) next();
    else if (e.target.closest('[data-skip]')) finish();
  });

  window.addEventListener('resize', show);

  return {
    start() { index = 0; show(); },
    skip() { finish(); },
    destroy() { window.removeEventListener('resize', show); overlay.remove(); },
  };
}
