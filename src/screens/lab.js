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

  function currentReagentIds() {
    return isSandbox() ? allReagentIds() : task.reagents;
  }

  container.innerHTML =
    '<div class="lab-topbar">' +
      '<button class="btn btn--ghost lab-back" data-action="back">← Карта</button>' +
      '<div data-mode-switch></div>' +
      '<button class="btn btn--ghost" data-action="tables">📋 Таблицы</button>' +
      '<button class="btn btn--ghost" data-action="reset">⟳ Слить всё</button>' +
    '</div>' +

    // Индикатор «в руке» + надпись результата
    '<div class="lab-hand" data-hand hidden></div>' +
    '<div class="lab-readout" data-readout hidden></div>' +

    '<aside class="lab-task" data-task>' +
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
    next: container.querySelector('[data-action="next"]'),
    check: container.querySelector('[data-action="check"]'),
  };

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
    ctx.renderer.scene.fog = new THREE.Fog(0x141a22, 9, 24);
    ctx.renderer.scene.background = new THREE.Color(0x141a22);
    ctx.renderer.camera.position.set(0, 3.4, 8.4);
    ctx.renderer.setLookTarget(0, 1.4, -0.4);
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
    } else {
      els.hand.hidden = true;
    }
  }

  function pourToVessel(vesselId) {
    if (!state) return;
    if (!picked) { setStatus('Сначала выбери вещество в панели слева.', 'fail'); return; }
    const reagentId = picked;
    const res = state.pour(reagentId, vesselId, 6);
    if (!res.ok) { setStatus(res.reason ?? 'Не получилось налить.', 'fail'); return; }
    setStatus('Налил ' + (REAGENTS[reagentId]?.formula ?? reagentId) +
      '. Кликни сосуд ещё раз — нальётся порция, или выбери другое вещество.');
    updateReadout(vesselId);
    // Вещество остаётся «в руке»: можно наливать несколько порций подряд.
    // Чтобы взять другое — клик по другой карточке в панели; чтобы убрать —
    // повторный клик по той же карточке.
  }

  /** Нагрев: сосуд перелетает на горелку и обратно. */
  function heatVessel(vesselId) {
    if (!state) return;
    const v = lab.getVessel(vesselId);
    if (!v) return;
    if (v.onBurner) {
      state.stopHeating(vesselId);
      v.onBurner = false;
      gsap.to(v.group.position, { x: v.homePos.x, y: v.homePos.y, z: v.homePos.z, duration: 0.8, ease: 'power2.inOut' });
      setStatus(VESSEL_LABELS[vesselId] + ' снята с горелки.');
    } else {
      const r = state.startHeating(vesselId);
      if (!r.ok) { setStatus(r.reason, 'fail'); return; }
      v.onBurner = true;
      gsap.to(v.group.position, { x: lab.heatSpot.x + 0.55, y: 1.55, z: lab.heatSpot.z + 0.4, duration: 0.8, ease: 'power2.inOut' });
      setStatus(VESSEL_LABELS[vesselId] + ' на горелке. Нагревается…');
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

  function onStageClick(event) {
    if (!state || !picked) return;
    if (event.target.closest('.lab-topbar, .lab-task, .lab-vessels, .lab-tip, .window, .lab-panel')) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, ctx.renderer.camera);
    const hits = raycaster.intersectObjects(lab.vessels.map((v) => v.group), true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !lab.vessels.some((v) => v.group === obj)) obj = obj.parent;
    const vessel = lab.vessels.find((v) => v.group === obj);
    if (vessel) pourToVessel(vessel.id);
  }

  const onClick = (event) => {
    if (event.target.closest('[data-action="back"]')) { ctx.screens.show('map'); return; }
    if (event.target.closest('[data-action="tables"]')) { openTables(); return; }
    if (event.target.closest('[data-action="reset"]')) {
      state?.reset(); panel?.setPicked(null); picked = null; els.hand.hidden = true;
      els.readout.hidden = true; setStatus('Стол чист.'); return;
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
  window.addEventListener('pointerdown', onStageClick);

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
      window.removeEventListener('pointerdown', onStageClick);
      modeSwitch.destroy();
      windows?.closeAll();
      panel?.destroy();
      teardownScene();
    },
  };
}
