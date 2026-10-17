import { getLocation } from '../data/locations.js';
import { getTask } from '../data/tasks.js';

/** Нормализация ответа: нижний регистр, без пробелов и лишних знаков. */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[«»"'`.,]/g, '');
}

/**
 * Экран уровня — локация с сюжетной «запиской» и задачей.
 *
 * Пока UI-каркас: записка слева, рядом упоминание таблицы Менделеева
 * справа (подсказка). Ввод ответа текстом.
 */
export function levelScreen(container, ctx) {
  container.id = 'screen-level';

  const location = getLocation(ctx.game.state.currentLocation) ?? getLocation('warehouse');
  const task = getTask(location.tasks[0]);

  container.innerHTML = `
    <div class="level-topbar">
      <button class="btn btn--ghost" data-action="back">← Карта</button>
      <span class="level-location">${location.title}</span>
    </div>

    <div class="level-body">
      <!-- Записка с задачей -->
      <article class="note">
        <header class="note-head">
          <span class="note-from">Записка от ${task.from}</span>
          <span class="note-stain" aria-hidden="true"></span>
        </header>
        <p class="note-text">${task.note}</p>
      </article>

      <!-- Рабочая зона: задание + ввод -->
      <section class="task-panel">
        <p class="task-prompt">${task.prompt}</p>
        <div class="task-formula">${task.formula}</div>
        <form class="task-form" data-form>
          <input
            class="task-input"
            type="text"
            name="answer"
            placeholder="Название вещества…"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="btn btn--primary" type="submit">Проверить</button>
        </form>
        <p class="task-feedback" data-feedback data-state="idle">
          Подсказка: ${task.hint}
        </p>
      </section>

      <!-- Подсказка-таблица Менделеева (пока заглушка) -->
      <aside class="periodic-hint">
        <span class="periodic-title">Таблица Менделеева</span>
        <span class="periodic-placeholder">висела бы здесь</span>
      </aside>
    </div>
  `;

  const feedback = container.querySelector('[data-feedback]');
  const form = container.querySelector('[data-form]');
  const input = form.querySelector('input');

  const onSubmit = (event) => {
    event.preventDefault();
    const value = normalize(input.value);
    if (!value) return;

    const correct = task.answers.some((a) => normalize(a) === value);
    if (correct) {
      feedback.dataset.state = 'ok';
      feedback.textContent = `Верно! ${task.explain}`;
      input.disabled = true;
      form.querySelector('button').disabled = true;
      ctx.game.markSolved(task.id);
      ctx.events.emit('task:solved', task.id);
    } else {
      feedback.dataset.state = 'err';
      feedback.textContent = 'Не то. Посмотри на элементы в формуле и проверь класс соединения.';
    }
  };

  const onClick = (event) => {
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('map');
    }
  };

  form.addEventListener('submit', onSubmit);
  container.addEventListener('click', onClick);

  // Сцена этой локации
  ctx.scenes.show(location.id, location);

  return {
    dispose() {
      form.removeEventListener('submit', onSubmit);
      container.removeEventListener('click', onClick);
    },
  };
}
