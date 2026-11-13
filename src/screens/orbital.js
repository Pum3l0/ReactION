import { generateOrbitalTask, distributeElectrons } from '../data/electronConfig.js';
import { AtomModel } from '../scenes/atomModel.js';
import * as THREE from 'three';

/**
 * Экран «Орбитарий» — паспорт элемента.
 *
 * Петля для каждой орбитали:
 *   1. Игрок видит дугу с бегающими электронами и подписью «сколько здесь».
 *   2. Вводит обозначение: буква (s/p/d/f) + число электронов.
 *   3. Раскидывает стрелочки ↑↓ по клеткам.
 *   4. «Готово» → фрагмент улетает вверх и собирает схему.
 *   5. Все готовы → атом отдаляется, показывается отчёт.
 */
export function orbitalScreen(container, ctx) {
  container.id = 'screen-orbital';

  let task = generateOrbitalTask({ withAnomaly: true });
  let shellIndex = 0;
  let finished = false;
  let playerCells = {};
  let playerLabels = {};   // shell -> { layer: number, letter: string }
  let solvedMap = {};      // shell -> boolean

  container.innerHTML = `
    <div class="orbital-stage" data-orbital-stage>
      <canvas class="orbital-canvas" data-orbital-canvas></canvas>

      <!-- Собираемая сверху схема -->
      <div class="config-strip" data-config-strip></div>

      <!-- Верхняя панель -->
      <div class="orbital-topbar">
        <button class="btn btn--ghost" data-action="back">← Карта</button>
        <button class="btn btn--ghost" data-action="other">⟳ Другое</button>
        <button class="btn btn--ghost" data-action="periodic">Таблица Менделеева</button>
        <span class="orbital-element" data-element></span>
      </div>

      <!-- Окошко орбитали -->
      <div class="orbital-panel" data-panel>
        <div class="orbital-panel-head">
          <span class="orbital-step" data-step></span>
          <button class="orbital-hint-link" data-hint-link title="Подсказка">?</button>
        </div>

        <!-- Снизу дуги: сколько электронов здесь -->
        <p class="orbital-count" data-count-hint></p>

        <!-- Обозначение: буква + цифра -->
        <div class="orbital-label-row">
          <span class="label-caption">Обозначение</span>
          <div class="label-inputs">
            <select class="label-select" data-letter-select>
              <option value="">—</option>
              <option value="s">s</option>
              <option value="p">p</option>
              <option value="d">d</option>
              <option value="f">f</option>
            </select>
            <span class="label-layer" data-layer>1</span>
          </div>
        </div>

        <!-- Стрелочки в клетках -->
        <div class="orbital-cells" data-cells></div>

        <div class="orbital-actions">
          <button class="btn btn--ghost" data-action="nav-prev">‹ Назад</button>
          <button class="btn btn--primary" data-action="done">Готово</button>
          <button class="btn btn--ghost" data-action="nav-next">Дальше ›</button>
        </div>
        <p class="orbital-status" data-status></p>
      </div>

      <!-- Подсказка -->
      <div class="orbital-hint" data-hint hidden>
        <button class="orbital-hint-close" data-hint-close aria-label="Закрыть">✕</button>
        <div class="orbital-hint-content" data-hint-content></div>
      </div>

      <!-- Таблица Менделеева -->
      <div class="orbital-periodic" data-periodic-modal hidden>
        <div class="orbital-periodic-scrim" data-periodic-close></div>
        <img class="orbital-periodic-img" src="/textures/props/mendeleevtab.webp" alt="Таблица Менделеева">
        <button class="btn btn--primary orbital-periodic-close" data-periodic-close>Закрыть</button>
      </div>

      <!-- Отчёт -->
      <div class="orbital-report" data-report hidden></div>
    </div>
  `;

  const stage = container.querySelector('[data-orbital-stage]');
  const panel = container.querySelector('[data-panel]');
  const cellsEl = container.querySelector('[data-cells]');
  const statusEl = container.querySelector('[data-status]');
  const elementEl = container.querySelector('[data-element]');
  const countHint = container.querySelector('[data-count-hint]');
  const stepEl = container.querySelector('[data-step]');
  const layerEl = container.querySelector('[data-layer]');
  const letterSelect = container.querySelector('[data-letter-select]');
  const configStrip = container.querySelector('[data-config-strip]');
  const hintEl = container.querySelector('[data-hint]');
  const hintContent = container.querySelector('[data-hint-content]');
  const reportEl = container.querySelector('[data-report]');

  // ==================================================================
  // 3D
  // ==================================================================
  ctx.renderer.setParallax(false);
  // Туман меню гасит атом на расстоянии — в Орбитарии не нужен
  ctx.renderer.scene.fog = null;
  ctx.renderer.scene.background = new THREE.Color(0x0b0e13);
  ctx.renderer.camera.position.set(2, 0, 13);
  ctx.renderer.camera.lookAt(0.5, 0, 0);

  let atom = null;
  let stopUpdate = null;
  let finalLook = 0; // 0..1 плавный переход к финальному ракурсу
  let zoomBoost = 1; // ручной зум колёсиком (1 = авто)

  function setupAtom() {
    stopUpdate?.();
    atom?.destroy();
    finalLook = 0;
    zoomBoost = 1;
    atom = new AtomModel(ctx.renderer.scene);
    stopUpdate = ctx.renderer.onUpdate((dt) => {
      atom.update(dt);

      const cam = ctx.renderer.camera;
      finalLook += ((atom.expanded ? 1 : 0) - finalLook) * Math.min(dt * 2, 1);

      // При работе — камера близко, смотрит на рабочую дугу справа от протона.
      // В финале — отъезжает настолько, чтобы влезли все кольца целиком.
      const outer = 4 + atom.shells.length * 1.45;
      const finalZ = outer * 2.4;
      const targetZ =
        (13 + atom.activeIndex * 0.5 + finalLook * (finalZ - 13)) * zoomBoost * Math.max(1, 1 / cam.aspect);

      const lookX = -1.5 + finalLook * 2.4;
      const lookY = 0;

      cam.position.z += (targetZ - cam.position.z) * Math.min(dt * 1.8, 1);
      cam.position.x += ((finalLook * 0.2) - cam.position.x) * Math.min(dt * 1.8, 1);

      cam.lookAt(lookX, lookY, 0);
    });
  }

  // ==================================================================
  // Состояние
  // ==================================================================
  function resetState() {
    playerCells = {};
    playerLabels = {};
    solvedMap = {};
    for (const s of task.shells) {
      playerCells[s.shell] = Array.from({ length: s.cells }, () => []);
      playerLabels[s.shell] = { letter: '', layer: s.shell.match(/\d/)?.[0] ?? '1' };
      solvedMap[s.shell] = false;
    }
  }

  function beginTask() {
    shellIndex = 0;
    finished = false;
    resetState();
    setupAtom();
    atom.build(task.shells);
    container.querySelector('.orbital-finish-bar')?.remove();
    elementEl.textContent = `${task.symbol} · ${task.name} · Z = ${task.z}`;
    reportEl.hidden = true;
    renderStrip();
    renderPanel();
  }

  // ==================================================================
  // Схема сверху
  // ==================================================================
  function renderStrip() {
    configStrip.innerHTML = task.shells
      .map((s) => {
        const solved = solvedMap[s.shell];
        const label = playerLabels[s.shell];
        const text = `${label.layer}${label.letter || '?'}`;
        return `<span class="strip-item ${solved ? 'is-solved' : ''}">
          ${solved ? `${text}${solvedSuperscript(s)}` : text}
        </span>`;
      })
      .join('');
  }

  function solvedSuperscript(s) {
    return `<sup>${s.electrons}</sup>`;
  }

  // ==================================================================
  // Панель текущей орбитали
  // ==================================================================
  function renderPanel() {
    if (finished) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    const shell = task.shells[shellIndex];
    const cells = playerCells[shell.shell];
    const label = playerLabels[shell.shell];

    stepEl.textContent = `Орбиталь ${shellIndex + 1} из ${task.shells.length}`;
    countHint.textContent = `На этой дуге электронов: ${shell.electrons}`;
    layerEl.textContent = label.layer;
    letterSelect.value = label.letter;

    cellsEl.innerHTML = cells
      .map((spins, i) => {
        const up = spins.includes('up') ? '↑' : '';
        const down = spins.includes('down') ? '↓' : '';
        return `
          <button class="q-cell ${spins.length ? 'has-electron' : ''}"
                  data-cell="${i}" type="button">
            <span class="q-cell-arrows">${up}${down}</span>
          </button>`;
      })
      .join('');

    const have = cells.reduce((a, c) => a + c.length, 0);
    statusEl.textContent = `Стрелочек расставлено: ${have} / ${shell.electrons}`;
    statusEl.dataset.state = have === shell.electrons ? 'ready' : 'filling';
    renderStrip();
  }

  function currentLetter() {
    const shell = task.shells[shellIndex];
    return shell.shell[1];
  }

  function onLetterChange() {
    const shell = task.shells[shellIndex];
    playerLabels[shell.shell].letter = letterSelect.value;
    renderStrip();
  }

  function onCellClick(cellIndex) {
    const shell = task.shells[shellIndex];
    if (solvedMap[shell.shell]) return;
    const cell = playerCells[shell.shell][cellIndex];

    if (cell.length === 0) cell.push('up');
    else if (cell.length === 1) cell.push('down');
    else cell.length = 0;

    atom.setShellElectrons(shellIndex, playerCells[shell.shell]);
    renderPanel();
  }

  // ==================================================================
  // Готово
  // ==================================================================
  function markDone() {
    const shell = task.shells[shellIndex];
    const label = playerLabels[shell.shell];
    const cells = playerCells[shell.shell];

    // Проверка обозначения: буква должна совпасть с настоящей
    if (label.letter !== currentLetter()) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Обозначение неверно: посмотри на порядок заполнения (?)';
      return;
    }

    // Проверка стрелочек
    const expected = distributeElectrons(shell.electrons, shell.cells);
    const cellsOk = expected.every((c, i) => (cells[i] ?? []).length === c.length);
    if (!cellsOk) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = 'Стрелочки расставлены неверно. Подсказка: сначала по одному, потом парами.';
      return;
    }

    solvedMap[shell.shell] = true;
    atom.markSolved(shellIndex);
    statusEl.dataset.state = 'ok';
    statusEl.textContent = 'Верно!';
    renderStrip();

    // Ищем следующую нерешённую
    const next = task.shells.findIndex((s) => !solvedMap[s.shell]);
    if (next === -1) {
      finish();
    } else {
      shellIndex = next;
      atom.setActive(next);
      setTimeout(renderPanel, 350);
    }
  }

  function finish() {
    finished = true;
    panel.hidden = true;
    atom.expand();

    // Даём полюбоваться готовым атомом: вращение мышью + кнопка отчёта
    const finishBar = document.createElement('div');
    finishBar.className = 'orbital-finish-bar';
    finishBar.innerHTML = `
      <div class="orbital-legend">
        ${task.shells
          .map((s) => {
            const color = { s: '#ffd166', p: '#7fc4ff', d: '#a6e88f', f: '#e8a6e0' }[s.shell[1]] ?? '#fff';
            return `<span class="legend-item"><i style="background:${color}"></i>${s.shell}<sup>${s.electrons}</sup></span>`;
          })
          .join('')}
      </div>
      <p class="orbital-finish-tip">Готово! <b>Крути мышью</b>, <b>колесо</b> — приблизить/отдалить.</p>
      <button class="btn btn--primary" data-action="show-report">Показать паспорт →</button>
    `;
    stage.appendChild(finishBar);
  }

  // --- Вращение модели мышью (доступно всегда, особенно нужно в финале) ---
  let rotating = false;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (event) => {
    if (!atom) return;
    // Клики по любому UI (панели, окна, таблица) не должны вращать атом
    if (event.target.closest('.orbital-panel, .orbital-topbar, .config-strip, .orbital-finish-bar, .orbital-hint, .orbital-report, .orbital-periodic')) return;
    rotating = true;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!rotating || !atom) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    atom.group.rotation.y += dx * 0.006;
    atom.group.rotation.x += dy * 0.004;
  };

  const onPointerUp = (event) => {
    rotating = false;
    if (stage.hasPointerCapture?.(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
  };

  /** Зум колесом мыши: приблизить или отдалить. */
  const onWheel = (event) => {
    if (!atom) return;
    event.preventDefault();
    const delta = Math.sign(event.deltaY) * 0.09;
    zoomBoost = Math.min(Math.max(zoomBoost + delta, 0.3), 3);
  };

  function showReport() {
    reportEl.hidden = false;
    reportEl.innerHTML = `
      <div class="orbital-report-card">
        <h3>Паспорт элемента</h3>
        <div class="report-element">
          <span class="report-symbol">${task.symbol}</span>
          <span class="report-name">${task.name}</span>
          <span class="report-z">Z = ${task.z}</span>
        </div>
        <div class="report-config">
          ${task.shells
            .map((s) => {
              const cells = distributeElectrons(s.electrons, s.cells);
              const arrows = cells
                .map((c) => `[${c.map((d) => (d === 'up' ? '↑' : '↓')).join('') || ' '}]`)
                .join(' ');
              return `<div class="report-row">
                <span class="report-shell">${s.shell}</span>
                <span class="report-cells">${arrows}</span>
                <span class="report-sup">${s.electrons}</span>
              </div>`;
            })
            .join('')}
        </div>
        ${task.shells.map((s) => '').join('')}
        ${task.anomaly
          ? `<p class="report-anomaly">⚠ Проскок электрона: ${task.anomaly.shift.from} → ${task.anomaly.shift.to}</p>`
          : ''}
        <div class="report-actions">
          <button class="btn btn--tonal" data-action="back">На карту</button>
          <button class="btn btn--primary" data-action="other">Ещё задание</button>
        </div>
      </div>`;
  }

  // ==================================================================
  // Навигация
  // ==================================================================
  function goTo(index) {
    if (index < 0 || index >= task.shells.length) return;
    shellIndex = index;
    atom.setActive(index);
    renderPanel();
  }

  // ==================================================================
  // Подсказки
  // ==================================================================
  function openHint() {
    hintEl.hidden = false;
    const isAnomaly = Boolean(task.anomaly);
    hintContent.innerHTML = `
      <h4>${isAnomaly ? 'Проскок электрона' : 'Порядок заполнения (Клечковского)'}</h4>
      <p>Орбитали заполняются по сумме <b>n + l</b>, а не по номеру слоя.
      Поэтому <b>4s</b> идёт раньше <b>3d</b>.</p>
      <div class="hint-diagram">1s → 2s → 2p → 3s → 3p → 4s → 3d → 4p</div>
      ${isAnomaly
        ? `<p>У ${task.name} один электрон «перескакивает» с внешней s на
           предвнешнюю d: <b>${task.anomaly.shift.from} → ${task.anomaly.shift.to}</b>.</p>`
        : ''}
      <p class="hint-note">Модель упрощена: электроны — облака вероятности, а не шарики.</p>`;
  }

  // ==================================================================
  // Обработчики
  // ==================================================================
  const onClick = (event) => {
    if (event.target.closest('[data-action="back"]')) {
      ctx.screens.show('map');
      return;
    }
    if (event.target.closest('[data-action="show-report"]')) {
      showReport();
      return;
    }
    if (event.target.closest('[data-action="other"]')) {
      task = generateOrbitalTask({ withAnomaly: true });
      beginTask();
      return;
    }
    if (event.target.closest('[data-action="periodic"]')) {
      container.querySelector('[data-periodic-modal]').hidden = false;
      return;
    }
    if (event.target.closest('[data-periodic-close]')) {
      container.querySelector('[data-periodic-modal]').hidden = true;
      return;
    }
    if (event.target.closest('[data-hint-link]')) {
      openHint();
      return;
    }
    if (event.target.closest('[data-hint-close]')) {
      hintEl.hidden = true;
      return;
    }
    if (event.target.closest('[data-action="nav-prev"]')) {
      goTo(shellIndex - 1);
      return;
    }
    if (event.target.closest('[data-action="nav-next"]')) {
      goTo(shellIndex + 1);
      return;
    }
    if (event.target.closest('[data-action="done"]')) {
      markDone();
      return;
    }
    const cell = event.target.closest('[data-cell]');
    if (cell) onCellClick(Number(cell.dataset.cell));
  };

  const onChange = (event) => {
    if (event.target.closest('[data-letter-select]')) onLetterChange();
  };

  /** Esc закрывает таблицу Менделеева. */
  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    const modal = container.querySelector('[data-periodic-modal]');
    if (modal && !modal.hidden) modal.hidden = true;
  };

  container.addEventListener('click', onClick);
  container.addEventListener('change', onChange);
  document.addEventListener('keydown', onKeyDown);

  // Прямой обработчик на кнопке закрытия — не зависит от делегирования
  // и перехвата pointer-событий сценой.
  const periodicModal = container.querySelector('[data-periodic-modal]');
  const closePeriodic = () => {
    periodicModal.hidden = true;
  };
  periodicModal.querySelector('.orbital-periodic-close').addEventListener('click', closePeriodic);
  periodicModal.querySelector('.orbital-periodic-scrim').addEventListener('click', closePeriodic);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('wheel', onWheel, { passive: false });

  beginTask();

  return {
    onShow() {
      ctx.renderer.setParallax(false);
      // Туман из фона меню гасит атом вдали — в Орбитарии он не нужен
      ctx.renderer.scene.fog = null;
      if (finished) task = generateOrbitalTask({ withAnomaly: true });
      beginTask();
    },
    onHide() {
      stopUpdate?.();
      atom?.destroy();
      atom = null;
      // Возвращаем туман для остальных экранов
      ctx.renderer.scene.fog = new THREE.Fog(0x120d08, 12, 34);
      ctx.renderer.setParallax(true);
      ctx.renderer.camera.position.set(0, 3.2, 9);
      ctx.renderer.camera.lookAt(0, 1.4, 0);
    },
    dispose() {
      container.removeEventListener('click', onClick);
      container.removeEventListener('change', onChange);
      document.removeEventListener('keydown', onKeyDown);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
    },
  };
}
