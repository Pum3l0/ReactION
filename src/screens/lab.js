import * as THREE from 'three';
import gsap from 'gsap';
import { buildLab, placeReagents } from '../core/three/lab/labScene.js';
import { LabState } from '../core/chem/labState.js';
import { pickShiftTask } from '../data/shiftTasks.js';
import { REAGENTS, allReagentIds } from '../data/reactions.js';
import { describeResult } from '../core/chem/reactionEngine.js';
import { createModeSwitch } from '../ui/modeSwitch.js';
import { WindowManager } from '../core/windowManager.js';
import { ReagentPanel } from '../ui/reagentPanel.js';
import { createOnboarding, isOnboarded } from '../ui/onboarding.js';
import { isPhone } from '../core/device.js';

/**
 * Экран «Лаборатория» — рабочий стол химика в 3D.
 *
 * Работает в ДВУХ режимах (по ctx.game.mode):
 *   'shift' — лабораторные задания от мастера: нужно провести опыт и сдать.
 *   'lab'   — полигон: все вещества, свободно смешивай и наблюдай реакции.
 *
 * Управление (простое и надёжное, без drag&drop):
 *   1. Открываешь панель «Реактивы» (слева) — с поиском и категориями.
 *   2. Кликаешь вещество — оно «в руке» (видно индикатор сверху).
 *   3. Кликаешь по посуде (на столе или кнопкой) — наливаешь.
 *
 * Наглядность: сверху всплывает надпись реакции; нагрев — сосуд перелетает
 * на горелку; фильтрование отделяет осадок; магнит вытягивает стружку.
 */

const VESSEL_LABELS = {
  'tube-a': 'Пробирка 1',
  'tube-b': 'Пробирка 2',
  beaker: 'Стакан',
  flask: 'Колба',
};

function vialColorVar(color) {
  if (!color) return 'rgba(200, 220, 255, 0.35)';
  return '#' + color.toString(16).padStart(6, '0');
}

export function labScreen(container, ctx) {
  container.id = 'screen-lab';

  const isSandbox = () => (ctx.game.mode ?? 'shift') === 'lab';
  let task = isSandbox() ? null : pickShiftTask(ctx.game.solvedShiftTasks());
  let lab = null;
  let state = null;
  let reagents = null;
  let stopUpdate = null;
  let picked = null;
  let solved = false;
  let windows = null;
  let panel = null;
  let onboarding = null;

  function currentReagentIds() {
    return isSandbox() ? allReagentIds() : task.reagents;
  }

  container.innerHTML =
    '<div class="lab-topbar">' +
      '<button class="btn btn--ghost lab-back" data-action="back">← Карта</button>' +
      '<div data-mode-switch></div>' +
      '<button class="btn btn--ghost" data-action="tables">📋 Таблицы</button>' +
      '<button class="btn btn--ghost" data-action="journal">📓 Журнал</button>' +
      '<button class="btn btn--ghost" data-action="reset">⟳ Слить всё</button>' +
    '</div>' +

    // Журнал опытов (панель справа, скрыта)
    '<aside class="lab-journal" data-journal hidden>' +
      '<div class="lab-journal-head">' +
        '<h3>Журнал опытов</h3>' +
        '<button class="lab-panel-close" data-action="journal-close">‹</button>' +
      '</div>' +
      '<div class="lab-journal-list" data-journal-list></div>' +
    '</aside>' +

    // Индикатор «в руке» + надпись результата
    '<div class="lab-hand" data-hand hidden></div>' +
    '<div class="lab-readout" data-readout hidden></div>' +

    '<aside class="lab-task" data-task>' +
      // На телефоне щиток можно свернуть, чтобы не закрывать стол
      '<button class="lab-task-collapse" data-action="fold-task" aria-label="Свернуть задание">–</button>' +
      '<h3 class="lab-task-title" data-task-title></h3>' +
      '<div class="lab-task-master" data-task-master>' +
        '<img class="lab-task-portrait" src="/textures/props/petrovich_head.webp" alt="Мастер">' +
        '<p class="lab-task-brief" data-task-brief></p>' +
      '</div>' +
      '<p class="lab-task-status" data-task-status></p>' +
      '<div class="lab-task-result" data-task-result hidden>' +
        '<p class="lab-eq" data-task-eq></p>' +
        '<p class="lab-obs" data-task-obs></p>' +
      '</div>' +
      '<div class="lab-task-actions" data-task-actions>' +
        '<button class="btn btn--primary" data-action="check">Проверить</button>' +
        '<button class="btn btn--tonal" data-action="next" hidden>Следующее</button>' +
      '</div>' +
    '</aside>' +

    // Панель посуды (налить / нагреть / отфильтровать / магнит)
    '<div class="lab-vessels" data-vessels></div>' +

    '<div class="lab-tip">' +
      '<strong>Как работать:</strong> открой «Реактивы» слева, выбери вещество, ' +
      'затем кликни посуду — нальётся. Кнопки на посуде: 🔥 нагрев, ⧗ фильтр, 🧲 магнит.' +
    '</div>' +

    // Мобильный быстрый выбор сосуда (появляется при выборе реактива)
    '<div class="lab-pour-picker" data-pour-picker hidden>' +
      '<div class="lab-pour-title" data-pour-title></div>' +
      '<div class="lab-pour-grid" data-pour-grid></div>' +
      '<button class="lab-pour-cancel" data-pour-cancel>Отмена</button>' +
    '</div>';

  const modeSwitch = createModeSwitch({
    mode: ctx.game.mode ?? 'shift',
    onMode: (id) => { ctx.game.setMode(id); ctx.screens.show('map'); },
  });
  container.querySelector('[data-mode-switch]').replaceWith(modeSwitch);

  const els = {
    hand: container.querySelector('[data-hand]'),
    readout: container.querySelector('[data-readout]'),
    task: container.querySelector('[data-task]'),
    title: container.querySelector('[data-task-title]'),
    master: container.querySelector('[data-task-master]'),
    brief: container.querySelector('[data-task-brief]'),
    status: container.querySelector('[data-task-status]'),
    result: container.querySelector('[data-task-result]'),
    eq: container.querySelector('[data-task-eq]'),
    obs: container.querySelector('[data-task-obs]'),
    actions: container.querySelector('[data-task-actions]'),
    vessels: container.querySelector('[data-vessels]'),
    journal: container.querySelector('[data-journal]'),
    journalList: container.querySelector('[data-journal-list]'),
    next: container.querySelector('[data-action="next"]'),
    check: container.querySelector('[data-action="check"]'),
    pourPicker: container.querySelector('[data-pour-picker]'),
    pourTitle: container.querySelector('[data-pour-title]'),
    pourGrid: container.querySelector('[data-pour-grid]'),
  };

  // На телефоне играем через крупные кнопки вместо точного 3D-клика
  const mobile = isPhone() || window.matchMedia('(max-width: 760px)').matches;
  if (mobile) container.classList.add('is-mobile');

  /** Крупный выбор сосуда, куда налить (мобильный режим). */
  function openPourPicker(reagentId) {
    const r = REAGENTS[reagentId];
    els.pourTitle.innerHTML =
      'Куда налить <b>' + (r?.formula ?? reagentId) + '</b>?';
    els.pourGrid.innerHTML = ['tube-a', 'tube-b', 'beaker', 'flask']
      .map((id) =>
        '<button class="lab-pour-vessel" data-pour="' + id + '">' +
          '<span class="lab-pour-vessel-name">' + VESSEL_LABELS[id] + '</span>' +
        '</button>')
      .join('');
    els.pourPicker.hidden = false;
    // Сворачиваем панель реактивов, чтобы не перекрывала пикер
    panel?.collapse?.();
  }

  function closePourPicker() {
    els.pourPicker.hidden = true;
  }

  /** Показать журнал выполненных опытов. */
  function renderJournal() {
    els.journal.hidden = false;
    const log = state?.log ?? [];
    if (!log.length) {
      els.journalList.innerHTML = '<p class="lab-journal-empty">Пока пусто. Смешай вещества, и реакции попадут сюда.</p>';
      return;
    }
    els.journalList.innerHTML = log.slice().reverse().map((entry, i) => {
      const left = entry.reagentIds.map((id) => REAGENTS[id]?.formula ?? id).join(' + ');
      const right = entry.reactions.map((r) => {
        const sym = r.kind === 'precipitate' ? '\u2193' : r.kind === 'gas' ? '\u2191' : '';
        return (r.formula ?? r.product ?? '') + sym;
      }).join(' + ');
      const note = entry.reactions.map((r) => r.name).filter(Boolean).join(', ');
      return '<div class="lab-journal-entry">' +
        '<span class="lab-journal-num">' + (log.length - i) + '</span>' +
        '<div class="lab-journal-body">' +
          '<span class="lab-journal-eq">' + left + ' \u2192 ' + right + '</span>' +
          '<span class="lab-journal-note">' + note + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ==================================================================
  // Панель реагентов (слева, с поиском и категориями)
  // ==================================================================
  function buildPanel() {
    panel?.destroy();
    const host = document.createElement('div');
    host.className = 'lab-panel-host';
    container.appendChild(host);
    panel = new ReagentPanel(host, {
      reagentIds: currentReagentIds(),
      onPick: (id) => pickReagent(id),
    });
  }

  // ==================================================================
  // 3D: стол
  // ==================================================================
  function setupScene() {
    ctx.renderer.scene.fog = new THREE.Fog(0x141a22, 11, 28);
    ctx.renderer.scene.background = new THREE.Color(0x141a22);
    // Камера отодвинута и центрирована: ряд сосудов + горелка справа
    // должны целиком попадать в кадр, включая фильтр и магнит на столе.
    ctx.renderer.camera.position.set(0, 4.0, 10.5);
    ctx.renderer.setLookTarget(0, 1.2, 0.4);
    ctx.renderer.setParallax(true);

    lab = buildLab(ctx.renderer.scene);
    state = new LabState(lab, task);
    // 3D-склянки на полке: в полигоне их много — ставим все
    reagents = placeReagents(ctx.renderer.scene, lab.root, currentReagentIds());

    stopUpdate = ctx.renderer.onUpdate((dt, elapsed) => state.update(dt, elapsed));
    renderVesselButtons();
  }

  function teardownScene() {
    stopUpdate?.(); stopUpdate = null;
    state?.reset();
    reagents?.dispose();
    lab?.dispose();
    reagents = null; lab = null; state = null;
  }

  function renderVesselButtons() {
    const ids = ['tube-a', 'tube-b', 'beaker', 'flask'];
    els.vessels.innerHTML = ids
      .map((id) =>
        '<div class="lab-vessel-row">' +
          '<button class="lab-vessel-btn" data-vessel="' + id + '">' + VESSEL_LABELS[id] + '</button>' +
          '<button class="lab-tool-btn" data-heat="' + id + '" title="Нагреть">🔥</button>' +
          '<button class="lab-tool-btn" data-filter="' + id + '" title="Отфильтровать осадок">⧗</button>' +
          '<button class="lab-tool-btn" data-magnet="' + id + '" title="Вытянуть стружку магнитом">🧲</button>' +
        '</div>')
      .join('');
  }

  // ==================================================================
  // Задание (режим «Смена»)
  // ==================================================================
  function renderTask() {
    if (isSandbox() || !task) {
      els.task.classList.add('is-sandbox');
      els.title.textContent = 'Свободный полигон';
      els.master.hidden = true;
      els.actions.hidden = true;
      els.brief.textContent = 'Открой «Реактивы» слева, выбирай любые вещества и смешивай — наблюдай, что происходит.';
      els.status.textContent = '';
      els.result.hidden = true;
      return;
    }
    els.task.classList.remove('is-sandbox');
    els.master.hidden = false;
    els.actions.hidden = false;
    els.title.textContent = task.title;
    els.brief.textContent = task.brief;
    els.status.textContent = '';
    els.status.className = 'lab-task-status';
    els.result.hidden = true;
    els.next.hidden = true;
    els.check.hidden = false;
    solved = false;
  }

  function nextTask() {
    task = pickShiftTask(ctx.game.solvedShiftTasks());
    teardownScene();
    setupScene();
    renderTask();
    buildPanel();
  }

  function check() {
    if (!state) return;
    const verdict = state.checkGoal();
    els.status.textContent = verdict.reason;
    els.status.className = 'lab-task-status ' + (verdict.ok ? 'is-ok' : 'is-fail');
    if (verdict.ok && !solved) {
      solved = true;
      ctx.game.markShiftTaskSolved(task.id);
      els.result.hidden = false;
      els.eq.textContent = task.equation;
      els.obs.textContent = task.observation;
      els.check.hidden = true;
      els.next.hidden = false;
      showReadout([{ kind: 'ok', text: 'Задание выполнено: ' + task.equation }], true);
    }
  }

  // ==================================================================
  // Взаимодействие
  // ==================================================================
  function pickReagent(id) {
    picked = picked === id ? null : id;
    panel?.setPicked(picked);
    if (picked) {
      const r = REAGENTS[picked];
      els.hand.hidden = false;
      els.hand.innerHTML =
        '<span class="lab-hand-vial" style="--vial-color:' + vialColorVar(r?.color) + '"></span>' +
        '<span class="lab-hand-text">В руке: <b>' + (r?.formula ?? id) + '</b> — кликни посуду</span>';
      setStatus('Взял ' + (r?.formula ?? id) + '. Кликни по посуде, чтобы налить.');
      // На телефоне сразу предлагаем крупный выбор сосуда
      if (mobile) openPourPicker(picked);
    } else {
      els.hand.hidden = true;
    }
  }

  function pourToVessel(vesselId) {
    if (!state) return;
    if (!picked) { setStatus('Сначала выбери вещество в панели слева.', 'fail'); return; }
    const reagentId = picked;
    const vessel = lab.getVessel(vesselId);
    const res = state.pour(reagentId, vesselId, 6);
    if (!res.ok) { setStatus(res.reason ?? 'Не получилось налить.', 'fail'); return; }
    // Короткое мигание сосуда — отклик на действие
    if (vessel) flashVessel(vessel);
    setStatus('Налил ' + (REAGENTS[reagentId]?.formula ?? reagentId) +
      '. Кликни сосуд ещё раз — нальётся порция, или выбери другое вещество.');
    updateReadout(vesselId);
    // Вещество остаётся «в руке»: можно наливать несколько порций подряд.
    // Чтобы взять другое — клик по другой карточке в панели; чтобы убрать —
    // повторный клик по той же карточке.
  }

  /** Нагрев: сосуд перелетает на горелку, идёт реакция разложения. */
  function heatVessel(vesselId) {
    if (!state) return;
    const v = lab.getVessel(vesselId);
    if (!v) return;
    if (v.onBurner) {
      state.stopHeating(vesselId);
      v.onBurner = false;
      gsap.to(v.group.position, { x: v.homePos.x, y: v.homePos.y, z: v.homePos.z, duration: 0.8, ease: 'power2.inOut' });
      setStatus(VESSEL_LABELS[vesselId] + ' снят с горелки.');
    } else {
      const r = state.startHeating(vesselId);
      if (!r.ok) { setStatus(r.reason, 'fail'); return; }
      v.onBurner = true;
      // Ставим РОВНО над пламенем горелки
      gsap.to(v.group.position, {
        x: lab.heatSpot.x, y: 0.92, z: lab.heatSpot.z,
        duration: 0.8, ease: 'power2.inOut',
      });

      // Показываем реакцию — та же функция, что и при перетаскивании
      announceHeat(vesselId, r.reactions);
    }
  }

  /** Фильтрование: отделяем осадок от жидкости в другой сосуд. */
  function filterVessel(vesselId) {
    if (!state) return;
    const res = state.filter(vesselId);
    if (!res.ok) { setStatus(res.reason, 'fail'); return; }
    setStatus('Осадок ' + (res.precipitate ?? '') + ' отделён на фильтре. Чистый раствор — в колбе.');
    showReadout([{ kind: 'neutral', text: '⧗ Осадок ' + (res.precipitate ?? '') + ' отделён фильтрованием' }]);
  }

  /** Магнит: вытягиваем железную стружку из смеси. */
  function magnetVessel(vesselId) {
    if (!state) return;
    const res = state.magnet(vesselId);
    if (!res.ok) { setStatus(res.reason, 'fail'); return; }
    setStatus('🧲 Железо ' + (res.removed ?? '') + ' мг притянуто магнитом.');
    showReadout([{ kind: 'neutral', text: '🧲 Железная стружка отделена магнитом' }]);
  }

  function showReadout(lines, sticky = false) {
    if (!lines || !lines.length) { els.readout.hidden = true; return; }
    els.readout.innerHTML = lines
      .map((l) => '<span class="lab-readout-line lab-readout--' + l.kind + '">' + l.text + '</span>')
      .join('');
    els.readout.hidden = false;
    gsap.fromTo(els.readout, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.35 });
    if (!sticky) {
      clearTimeout(els.readout._t);
      els.readout._t = setTimeout(() => { els.readout.hidden = true; }, 4500);
    }
  }

  function updateReadout(vesselId) {
    const vd = lab.vessels.find((v) => v.id === vesselId);
    if (!vd || !vd.contents.length) { els.readout.hidden = true; return; }
    const ids = vd.contents.map((c) => c.id);
    const result = state.lastResult;
    if (!result) return;
    const header = ids.map((id) => REAGENTS[id]?.formula ?? id).join(' + ');
    showReadout([{ kind: 'mix', text: header }].concat(describeResult(result, ids)));
  }

  function setStatus(text, kind = '') {
    els.status.textContent = text;
    els.status.className = 'lab-task-status' + (kind ? ' is-' + kind : '');
  }

  // --- Таблицы ---
  function ensureWindows() { if (!windows) windows = new WindowManager(container); return windows; }
  function openTables() {
    const w = ensureWindows();
    w.openWindow('mendeleev', {
      title: 'Таблица Менделеева',
      content: '<img class="window-img" src="/textures/props/mendeleevtab.webp" alt="Таблица Менделеева">',
      x: window.innerWidth * 0.40, y: 80,
    });
    w.openWindow('solubility', {
      title: 'Таблица растворимости',
      content: '<img class="window-img" src="/textures/props/rastvortable.webp" alt="Таблица растворимости">',
      x: window.innerWidth * 0.52, y: 150,
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Плоскость, по которой таскаем сосуды (на высоте стола)
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragPoint = new THREE.Vector3();
  const dragOffset = new THREE.Vector3();

  let drag = null;    // { vessel, moved } — перетаскивание сосуда
  let panelDrag = null; // { reagentId } — тянем реактив из панели в сосуд
  let downAt = null;  // { x, y } — где нажали (отличить клик от drag)

  function pickVesselAt(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, ctx.renderer.camera);
    const hits = raycaster.intersectObjects(lab.vessels.map((v) => v.group), true);
    if (!hits.length) return null;
    let obj = hits[0].object;
    while (obj && !lab.vessels.some((v) => v.group === obj)) obj = obj.parent;
    return lab.vessels.find((v) => v.group === obj) ?? null;
  }

  /** Точка пересечения луча с плоскостью стола. */
  function planePoint(event, out) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, ctx.renderer.camera);
    return raycaster.ray.intersectPlane(dragPlane, out);
  }

  /** Сосуд под курсором, с допуском (на телефоне палец крупный). */
  function vesselUnderPointer(event, tolerance = 0.35) {
    const v = pickVesselAt(event);
    if (v) return v;
    // Приблизительная проверка: ближайший сосуд в проекции экрана
    let best = null;
    let bestDist = Infinity;
    for (const vessel of lab.vessels) {
      const p = vessel.group.position.clone();
      p.y += 0.6;
      p.project(ctx.renderer.camera);
      const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(sx - event.clientX, sy - event.clientY);
      if (d < bestDist) { bestDist = d; best = vessel; }
    }
    return bestDist < 120 * tolerance / 0.35 ? best : null;
  }

  function onPointerDown(event) {
    if (!state) return;
    // Клик по интерфейсу — не наша забота
    if (event.target.closest('.lab-topbar, .lab-task, .lab-vessels, .lab-tip, .window, .lab-pour-picker')) return;

    // Начало drag реактива из панели
    const item = event.target.closest('.lab-item[data-id]');
    if (item) {
      const id = item.dataset.id;
      pickReagent(id);
      panelDrag = { reagentId: picked, started: false };
      downAt = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.target.closest('.lab-panel')) return;

    downAt = { x: event.clientX, y: event.clientY };
    const vessel = pickVesselAt(event);
    if (!vessel) return;

    // Реагент в руке: клик по сосуду = налить (не тащим сосуд)
    if (picked) {
      pourToVessel(vessel.id);
      downAt = null;
      return;
    }

    // Тащим сосуд — в том числе СНЯТЬ с горелки (нагрев выключится при движении)
    const hit = planePoint(event, dragPoint);
    if (!hit) return;
    drag = { vessel, moved: false, homePos: vessel.group.position.clone() };
    dragOffset.set(
      vessel.group.position.x - dragPoint.x,
      0,
      vessel.group.position.z - dragPoint.z,
    );
    document.body.style.cursor = 'grabbing';
  }

  function onPointerMove(event) {
    // Drag реактива из панели — показываем «носим»
    if (panelDrag && downAt) {
      const dist = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      if (dist > 6) panelDrag.started = true;
      const v = vesselUnderPointer(event);
      container.querySelectorAll('.lab-vessel-row').forEach((r) => r.classList.remove('is-target'));
      if (v && panelDrag.started) {
        const row = els.vessels.querySelector('[data-vessel="' + v.id + '"]')?.closest('.lab-vessel-row');
        row?.classList.add('is-target');
      }
      return;
    }
    if (!drag) return;
    if (!drag.moved && downAt) {
      const dist = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      if (dist > 4) drag.moved = true;
    }
    // Если начали двигать сосуд, который на горелке — снимаем его нагрев
    if (drag.moved && drag.vessel.onBurner) {
      state.stopHeating(drag.vessel.id);
      drag.vessel.onBurner = false;
    }
    const hit = planePoint(event, dragPoint);
    if (!hit) return;
    drag.vessel.group.position.x = dragPoint.x + dragOffset.x;
    drag.vessel.group.position.z = dragPoint.z + dragOffset.z;

    // Подсветка сосуда-цели: если тащим на другой сосуд, оба «загораются»
    if (drag.moved) {
      const other = vesselNear(drag.vessel, 1.1);
      lab.vessels.forEach((v) => highlightVessel(v, false));
      if (other) {
        highlightVessel(other, true, 'target');
        highlightVessel(drag.vessel, true, 'source');
      } else {
        // Подсветка горелки, если тащим туда
        const p = drag.vessel.group.position;
        const nearBurner = Math.hypot(p.x - lab.heatSpot.x, p.z - lab.heatSpot.z) < 1.3;
        highlightBurner(nearBurner);
      }
    }
  }

  /** Ближайший к данному сосуду другой сосуд в радиусе dist. */
  function vesselNear(main, dist) {
    let best = null, bestD = dist;
    for (const o of lab.vessels) {
      if (o === main) continue;
      const d = Math.hypot(
        main.group.position.x - o.group.position.x,
        main.group.position.z - o.group.position.z,
      );
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  /** Короткое мигание сосуда при наливании. */
  function flashVessel(vessel) {
    const glass = vessel.group.getObjectByName('glass');
    if (!glass?.material) return;
    if (!glass.material.emissive) glass.material.emissive = new THREE.Color(0x445566);
    const proxy = { v: 0.9 };
    gsap.to(proxy, {
      v: 0, duration: 0.6, ease: 'power2.out',
      onUpdate() { glass.material.emissiveIntensity = proxy.v; },
    });
  }

  /** Подсветить стекло сосуда (emissive-свечение). */
  function highlightVessel(vessel, on, mode = 'target') {
    const glass = vessel.group.getObjectByName('glass');
    if (!glass?.material) return;
    if (on) {
      glass.material.emissive = new THREE.Color(mode === 'source' ? 0x335533 : 0x665522);
      glass.material.emissiveIntensity = 0.9;
    } else {
      glass.material.emissiveIntensity = 0;
    }
  }

  function highlightBurner(on) {
    const nozz = lab.burner?.children?.[2];
    if (!nozz?.material) return;
    nozz.material.emissive = new THREE.Color(0xff8a3d);
    nozz.material.emissiveIntensity = on ? 0.8 : 0;
  }

  function onPointerUp(event) {
    // Окончание drag реактива из панели
    if (panelDrag && downAt) {
      const wasDrag = panelDrag.started;
      document.body.style.cursor = '';
      container.querySelectorAll('.lab-vessel-row').forEach((r) => r.classList.remove('is-target'));
      if (wasDrag && picked) {
        const v = vesselUnderPointer(event);
        if (v) pourToVessel(v.id);
      }
      // Если просто клик по карточке — реактив уже выбран (pickReagent выше)
      panelDrag = null;
      downAt = null;
      return;
    }

    if (!drag) { downAt = null; return; }
    const { vessel, moved } = drag;
    document.body.style.cursor = '';

    if (!moved) {
      // Клик по сосуду без движения
      if (picked) {
        drag = null; downAt = null;
        pourToVessel(vessel.id);
        return;
      }
      // Клик по сосуду с содержимым и без реагента — перелив в другой сосуд
      if (!vessel.isEmpty) {
        drag = null; downAt = null;
        setStatus('В ' + VESSEL_LABELS[vessel.id] + ' что-то есть. Потяни его к другому сосуду, чтобы перелить.');
        return;
      }
      setStatus('Это ' + (VESSEL_LABELS[vessel.id] ?? 'сосуд') + '. Выбери вещество слева и кликни.');
      drag = null; downAt = null;
      return;
    }

    // Сосуд БРОШЕН. Определяем, на что он попал (тот же радиус, что и подсветка):
    const droppedOn = vesselNear(vessel, 1.1);

    lab.vessels.forEach((v) => highlightVessel(v, false));
    highlightBurner(false);

    if (droppedOn) {
      // АНИМАЦИЯ ПЕРЕЛИВА: наклоняем сосуд к приёмнику, льём струйку.
      if (!vessel.isEmpty) {
        animatePour(vessel, droppedOn);
      } else {
        returnHome(vessel);
      }
      drag = null; downAt = null;
      return;
    }

    const p = vessel.group.position;
    const nearBurner = Math.hypot(p.x - lab.heatSpot.x, p.z - lab.heatSpot.z) < 1.15;

    if (nearBurner) {
      // Ставим на горелку — точно над пламенем
      gsap.to(vessel.group.position, {
        x: lab.heatSpot.x, y: 0.92, z: lab.heatSpot.z,
        duration: 0.45, ease: 'power2.out',
      });
      if (!vessel.onBurner) {
        const r = state.startHeating(vessel.id);
        if (r.ok) {
          vessel.onBurner = true;
          // Показываем надпись и реакцию — как при кнопке 🔥, а не только статус
          announceHeat(vessel.id, r.reactions);
        }
      }
    } else {
      returnHome(vessel);
    }
    drag = null;
    downAt = null;
  }

  /**
   * Единый показ результата нагрева: и при кнопке 🔥, и при перетаскивании
   * сосуда на горелку. Выводит уравнение и что выделилось (газ/пар).
   */
  function announceHeat(vesselId, reactions) {
    const label = VESSEL_LABELS[vesselId] ?? 'Сосуд';
    if (reactions && reactions.length) {
      const lines = reactions.map((x) => {
        const parts = ['🔥 ' + x.name];
        if (x.gas && x.gas !== 'H2O') {
          const g = x.gas === 'NH3' ? 'аммиак NH3'
            : x.gas === 'CO2' ? 'углекислый газ CO2' : x.gas;
          parts.push('↑ ' + g);
        } else if (x.gas === 'H2O') {
          parts.push('водяной пар');
        }
        return { kind: 'heat', text: parts.join(' · '), formula: x.equation ?? x.toFormula };
      });
      showReadout(lines);
      setStatus(label + ' на горелке: ' + reactions[0].name + '.');
    } else {
      setStatus(label + ' на горелке. Нагревается…');
    }
  }

  /** Вернуть сосуд на родное место (если он не на горелке). */
  function returnHome(vessel) {
    gsap.to(vessel.group.position, {
      x: vessel.homePos.x, y: vessel.homePos.y, z: vessel.homePos.z,
      duration: 0.4, ease: 'power2.out',
    });
  }

  /**
   * Анимация перелива: сосуд наклоняется к приёмнику, льётся струйка,
   * затем содержимое переходит и сосуд возвращается на место.
   */
  function animatePour(from, to) {
    const origRot = from.group.rotation.z;
    const tilt = to.group.position.x < from.group.position.x ? 0.7 : -0.7;

    // 1. Наклоняем к приёмнику
    gsap.to(from.group.rotation, { z: tilt, duration: 0.3, ease: 'power2.out' });

    // 2. Через мгновение показываем струйку
    setTimeout(() => {
      state.startPourStream(from, to);
      // Цвет струйки — цвет жидкости
      const c = from.liquid?.material?.color;
      if (c && lab.pourStream?.mesh?.material) lab.pourStream.mesh.material.color.copy(c);

      // 3. Наливаем постепенно (визуально уровень в приёмнике растёт)
      const res = state.decant(from.id, to.id);
      setStatus(res.ok
        ? 'Перелили ' + VESSEL_LABELS[from.id] + ' → ' + VESSEL_LABELS[to.id] + '.'
        : (res.reason ?? 'Не удалось перелить.'),
        res.ok ? '' : 'fail');
      updateReadout(to.id);
    }, 320);

    // 4. Убираем струйку и возвращаем сосуд
    setTimeout(() => {
      state.stopPourStream();
      gsap.to(from.group.rotation, { z: origRot, duration: 0.3, ease: 'power2.out' });
      returnHome(from);
    }, 1000);
  }

  const onClick = (event) => {
    if (event.target.closest('[data-action="back"]')) { ctx.screens.show('map'); return; }
    // Мобильный пикер сосуда
    const pourBtn = event.target.closest('[data-pour]');
    if (pourBtn) {
      closePourPicker();
      pourToVessel(pourBtn.dataset.pour);
      return;
    }
    if (event.target.closest('[data-pour-cancel]')) {
      closePourPicker();
      pickReagent(picked); // снять «руку»
      return;
    }
    if (event.target.closest('[data-action="tables"]')) { openTables(); return; }
    if (event.target.closest('[data-action="journal"]')) { renderJournal(); return; }
    if (event.target.closest('[data-action="journal-close"]')) { els.journal.hidden = true; return; }
    if (event.target.closest('[data-action="reset"]')) {
      state?.reset(); panel?.setPicked(null); picked = null; els.hand.hidden = true;
      els.readout.hidden = true; setStatus('Стол чист.'); return;
    }
    if (event.target.closest('[data-action="fold-task"]')) {
      const folded = els.task.classList.toggle('is-folded');
      const btn = els.task.querySelector('[data-action="fold-task"]');
      if (btn) btn.textContent = folded ? '+' : '–';
      return;
    }
    if (event.target.closest('[data-action="check"]')) { check(); return; }
    if (event.target.closest('[data-action="next"]')) { nextTask(); return; }
    const heat = event.target.closest('[data-heat]');
    if (heat) { heatVessel(heat.dataset.heat); return; }
    const filt = event.target.closest('[data-filter]');
    if (filt) { filterVessel(filt.dataset.filter); return; }
    const mag = event.target.closest('[data-magnet]');
    if (mag) { magnetVessel(mag.dataset.magnet); return; }
    const vesselBtn = event.target.closest('[data-vessel]');
    if (vesselBtn) { pourToVessel(vesselBtn.dataset.vessel); return; }
  };

  container.addEventListener('click', onClick);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  /** Онбординг: короткие подсказки при первом заходе в лабораторию. */
  function startOnboarding() {
    const key = isSandbox() ? 'lab-sandbox' : 'lab-shift';
    onboarding?.destroy();
    onboarding = createOnboarding(key, [
      { target: '.lab-panel-toggle', title: 'Шаг 1', text: 'Открой панель «Реактивы» — там все вещества.' },
      { target: '.lab-shelf, .lab-panel', title: 'Шаг 2', text: 'Выбери вещество (или перетащи его прямо на сосуд).' },
      { target: '.lab-vessels', title: 'Шаг 3', text: 'Кликни по сосуду, чтобы налить. 🔥 — нагрев, ⧗ — фильтр, 🧲 — магнит.' },
      { target: '.lab-task', title: 'Шаг 4', text: 'В разделе «Смена» здесь задание мастера — выполни его и нажми «Проверить».' },
    ], container);
    onboarding.start();
  }

  setupScene();
  renderTask();
  buildPanel();

  return {
    onShow() {
      modeSwitch.setMode(ctx.game.mode ?? 'shift');
      task = isSandbox() ? null : pickShiftTask(ctx.game.solvedShiftTasks());
      teardownScene();
      picked = null;
      setupScene();
      renderTask();
      buildPanel();
      closePourPicker();
      startOnboarding();
    },
    onHide() {
      teardownScene();
      windows?.closeAll();
      panel?.destroy();
      panel = null;
      ctx.renderer.scene.fog = new THREE.Fog(0x120d08, 12, 34);
      ctx.renderer.scene.background = new THREE.Color(0x120d08);
      ctx.renderer.setLookTarget(0, 1.4, 0);
      ctx.renderer.camera.position.set(0, 3.2, 9);
      ctx.renderer.setParallax(true);
    },
    dispose() {
      container.removeEventListener('click', onClick);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      modeSwitch.destroy();
      windows?.closeAll();
      panel?.destroy();
      onboarding?.destroy();
      teardownScene();
    },
  };
}
