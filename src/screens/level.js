import { getLocation } from '../data/locations.js';
import {
  generateTask,
  PARAMETERS,
  PARAM_LABELS,
  PARAM_HINTS,
} from '../data/taskGenerator.js';
import { checkAnswer } from '../core/answerCheck.js';
import { WindowManager } from '../core/windowManager.js';

/**
 * Экран уровня.
 *
 * Раскладка:
 *  - Панорама рабочего места на весь экран (прозрачный UI поверх).
 *  - Слева — прикованная панель «Отчёт»: таблица, где места пропусков
 *    закрыты кляксами. Клик по кляксе превращает её в компактное поле
 *    ввода на своём месте.
 *  - Над отчётом — реплики Петровича и кнопка «Ответ».
 *  - Таблицы (Менделеева / растворимости) — перетаскиваемые окна.
 *  - По одному окну на тип, закрываются крестиком.
 */
export function levelScreen(container, ctx) {
  const location = getLocation(ctx.game.state.currentLocation) ?? getLocation('warehouse');
  let task = generateTask();
  let solvedThisVisit = false;

  container.id = 'screen-level';
  container.innerHTML = `
    <div class="level-stage">
      <img class="level-backdrop" src="${location.scene}" alt="" draggable="false">

      <!-- Маркеры предметов на столе -->
      <button class="marker marker--mendeleev" data-marker="mendeleev">
        <span class="marker-dot"></span>
        <span class="marker-caption">Таблица Менделеева</span>
      </button>
      <button class="marker marker--solubility" data-marker="solubility">
        <span class="marker-dot"></span>
        <span class="marker-caption">Таблица растворимости</span>
      </button>

      <!-- Прикованный отчёт слева -->
      <aside class="report-panel" data-report>
        <button class="report-collapse" data-action="collapse-report" aria-label="Свернуть отчёт">‹</button>

        <!-- Петрович говорит — все реплики сразу -->
        <div class="report-npc">
          <img class="report-portrait" src="${location.npc?.portrait ?? ''}" alt="Петрович">
          <div class="report-speech">
            <span class="report-npc-name">${location.npc?.name ?? ''}</span>
            <div class="report-lines">
              ${(location.npc?.lines ?? []).map((l) => `<p class="report-line">${l}</p>`).join('')}
            </div>
            <p class="report-status" data-npc-status></p>
          </div>
        </div>

        <!-- Лист-накладная -->
        <div class="report-sheet">
          <h3 class="report-title">Накладная склада</h3>
          <div class="report-table-wrap" data-table-wrap>
            <!-- таблица рендерится в renderTable() -->
          </div>
        </div>
      </aside>

      <button class="btn btn--ghost level-back" data-action="back">← Карта</button>
      <button class="btn btn--ghost level-other" data-action="other">⟳ Другое</button>

      <!-- Подсказка: предметы на столе -->
      <div class="scene-tip">
        На столе лежат книги и листы — таблицы можно открыть нажатием на них
      </div>

      <!-- Кнопка ответа -->
      <button class="btn btn--primary report-answer" data-action="answer">Ответ</button>

      <!-- Подсказка по формату — всплывает при вводе -->
      <div class="format-hint" data-format-hint hidden>
        <span class="format-hint-param" data-format-param></span>
        <span class="format-hint-text" data-format-text></span>
        <span class="format-hint-example" data-format-example></span>
      </div>
    </div>
  `;

  const windows = new WindowManager(container);
  ctx.windows = windows;

  // ------------------------------------------------------------------
  // Петрович: вступительные реплики показаны сразу (в разметке).
  // Строка `sayEl` ниже — живой комментарий по ходу работы.
  // ------------------------------------------------------------------
  const sayEl = container.querySelector('[data-npc-status]');
  const say = (text) => {
    if (sayEl) sayEl.textContent = text;
  };

  // ------------------------------------------------------------------
  // Рендер таблицы-накладной по текущей задаче
  // ------------------------------------------------------------------
  const tableWrap = container.querySelector('[data-table-wrap]');

  function renderTable() {
    tableWrap.innerHTML = `
      <table class="report-table">
        <thead>
          <tr><th>№</th>${PARAMETERS.map((p) => `<th>${PARAM_LABELS[p]}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${task.rows
            .map((row, i) => {
              const cells = PARAMETERS.map((p) => {
                if (row.isSample) {
                  return `<td class="cell-sample">${row.values[p]}</td>`;
                }
                if (row.gaps.includes(p)) {
                  return `
                    <td class="cell-gap" data-row="${i}" data-param="${p}">
                      <button class="blob" type="button" aria-label="Пропуск">
                        <img src="/textures/props/Coffee_mark.webp" alt="">
                      </button>
                      <input class="blob-input" data-row="${i}" data-param="${p}"
                        placeholder="${PARAM_HINTS[p].split(',')[0]}"
                        autocomplete="off" spellcheck="false" hidden>
                    </td>`;
                }
                return `<td class="cell-fixed">${row.values[p]}</td>`;
              }).join('');
              return `<tr><td class="cell-num">${i + 1}</td>${cells}</tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  /** Пересоздать задачу — новые вещества и новые пропуски. */
  function resetTask() {
    task = generateTask();
    solvedThisVisit = false;
    renderTable();
    say('');
    const btn = container.querySelector('.report-answer');
    if (btn) {
      btn.textContent = 'Ответ';
      btn.dataset.action = 'answer';
    }
    container.querySelector('.report-next')?.remove();
  }

  renderTable();

  // ------------------------------------------------------------------
  // Кляксы → поля ввода + подсказка формата
  // ------------------------------------------------------------------
  const hintEl = container.querySelector('[data-format-hint]');
  const hintParam = container.querySelector('[data-format-param]');
  const hintText = container.querySelector('[data-format-text]');
  const hintExample = container.querySelector('[data-format-example]');

  const EXAMPLE_VALUES = {
    formula: 'NaCl, H2SO4',
    name: 'хлорид натрия',
    cls: 'соль',
    bond: 'ковалентная полярная',
    valency: 'I',
    solubility: 'растворимо',
  };

  function showFormatHint(param) {
    hintParam.textContent = PARAM_LABELS[param];
    hintText.textContent = ` — ${PARAM_HINTS[param]}`;
    hintExample.textContent = `Пример: ${EXAMPLE_VALUES[param]}`;
    hintEl.hidden = false;
  }

  function hideFormatHint() {
    hintEl.hidden = true;
  }

  const onFocusIn = (event) => {
    const input = event.target.closest('.blob-input');
    if (!input) return;
    input.previousElementSibling?.classList.add('is-hidden');
    showFormatHint(input.dataset.param);
  };
  const onFocusOut = (event) => {
    const input = event.target.closest('.blob-input');
    if (!input) return;
    const blob = input.previousElementSibling;
    // Возвращаем кляксу, если поле пустое и не отмечено верным
    if (!input.value.trim() && blob && !input.classList.contains('is-correct')) {
      blob.classList.remove('is-hidden');
      input.hidden = true;
    }
    // Прячем подсказку, если фокус ушёл с полей
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || !active.classList?.contains('blob-input')) hideFormatHint();
    }, 0);
  };

  const onBlobClick = (event) => {
    const blob = event.target.closest('.blob');
    if (!blob) return;
    const input = blob.nextElementSibling;
    blob.classList.add('is-hidden');
    input.hidden = false;
    input.focus();
  };

  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('focusout', onFocusOut);

  // ------------------------------------------------------------------
  // Проверка ответов
  // ------------------------------------------------------------------
  function checkAnswers() {
    const inputs = [...container.querySelectorAll('.blob-input')];
    let correct = 0;

    for (const input of inputs) {
      const row = task.rows[Number(input.dataset.row)];
      const param = input.dataset.param;
      const ok = checkAnswer(param, input.value, row.values[param]);

      input.classList.toggle('is-correct', ok);
      input.classList.toggle('is-wrong', !ok && input.value.trim() !== '');

      // Верный ответ закрепляем на листе, вместо поля показываем текст
      if (ok) {
        input.hidden = true;
        const cell = input.closest('.cell-gap');
        let kept = cell.querySelector('.cell-kept');
        if (!kept) {
          kept = document.createElement('span');
          kept.className = 'cell-kept';
          cell.appendChild(kept);
        }
        kept.textContent = input.value;
        cell.classList.add('is-solved');
        cell.querySelector('.blob')?.remove();
        correct += 1;
      }
    }

    const total = task.totalGaps;
    if (correct === total) {
      solvedThisVisit = true;
      ctx.game.markSolved(location.id);
      say('Ну ты даёшь! Всё восстановил, накладная как новенькая. Спасибо, выручил!');
      const btn = container.querySelector('.report-answer');
      btn.textContent = 'На карту';
      btn.dataset.action = 'to-map';
      // Рядом — кнопка новой задачи
      if (!container.querySelector('.report-next')) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn--tonal report-next';
        nextBtn.dataset.action = 'other';
        nextBtn.textContent = 'Ещё задание';
        btn.after(nextBtn);
      }
    } else {
      say(`Так, тут ещё ${total - correct} ячеек не сходится. Красные — перепроверь.`);
    }
  }

  // ------------------------------------------------------------------
  // Обработчики
  // ------------------------------------------------------------------
  const onClick = (event) => {
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('map');
      return;
    }
    if (event.target.closest('[data-action="collapse-report"]')) {
      container.querySelector('[data-report]')?.classList.toggle('is-collapsed');
      return;
    }
    if (event.target.closest('[data-action="other"]')) {
      resetTask();
      return;
    }
    if (event.target.closest('[data-action="answer"]')) {
      checkAnswers();
      return;
    }
    if (event.target.closest('[data-action="to-map"]')) {
      ctx.screens.show('map');
      return;
    }

    if (event.target.closest('.blob')) {
      onBlobClick(event);
      return;
    }

    const marker = event.target.closest('[data-marker]');
    if (marker) {
      const kind = marker.dataset.marker;
      if (kind === 'mendeleev') {
        windows.openWindow('mendeleev', {
          title: 'Таблица Менделеева',
          content: `<img class="window-img" src="/textures/props/mendeleevtab.webp" alt="Таблица Менделеева">`,
          x: window.innerWidth * 0.52,
          y: 70,
        });
      } else if (kind === 'solubility') {
        windows.openWindow('solubility', {
          title: 'Таблица растворимости',
          content: `<img class="window-img" src="/textures/props/rastvortable.webp" alt="Таблица растворимости">`,
          x: window.innerWidth * 0.62,
          y: 150,
        });
      }
      return;
    }
  };

  container.addEventListener('click', onClick);

  return {
    /**
     * Вызывается при каждом показе экрана.
     * Если прошлую задачу решили — собираем новую: другие вещества
     * и другие пропуски. Так решённая накладная не повторяется.
     */
    onShow() {
      if (solvedThisVisit) {
        ctx.game.clearSolved(location.id);
        resetTask();
      }
      windows.closeAll();
    },
    dispose() {
      container.removeEventListener('click', onClick);
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
      windows.closeAll();
      ctx.windows = null;
    },
  };
}
