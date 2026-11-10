import * as THREE from 'three';
import { AtomModel } from '../scenes/atomModel.js';
import { identifyAtom, ORBITALS, ELEMENTS, buildConfig } from '../data/electronConfig.js';
import { createModeSwitch } from '../ui/modeSwitch.js';
import { WindowManager } from '../core/windowManager.js';

/**
 * Песочница «Строение атома» (раздел «Лаборатория»).
 *
 * Игрок пишет электронную конфигурацию — например «1s2 2s2 2p6 3s1».
 * Игра НА ЛЕТУ распознаёт элемент и показывает 3D-атом, который
 * перестраивается с каждым введённым символом. Кнопка «Готово» закрепляет
 * результат: крупный итоговый атом и подпись, что за элемент/ион получился.
 *
 * Это тренажёр-песочница: без заданий, свободно экспериментируешь.
 */

const EXAMPLES = [
  { cfg: '1s2 2s1', hint: 'литий' },
  { cfg: '1s2 2s2 2p6 3s1', hint: 'натрий' },
  { cfg: '1s2 2s2 2p6 3s2 3p6 3d10 4s1', hint: 'медь (аномалия)' },
];

export function atomLabScreen(container, ctx) {
  container.id = 'screen-atom-lab';

  let atom = null;
  let stopUpdate = null;
  let confirmed = false;
  let windows = null;

  container.innerHTML =
    '<div class="lab-topbar">' +
      '<button class="btn btn--ghost lab-back" data-action="back">← Карта</button>' +
      '<div data-mode-switch></div>' +
      '<button class="btn btn--ghost" data-action="tables">📋 Таблица Менделеева</button>' +
      '<button class="btn btn--ghost" data-action="clear">⟳ Очистить</button>' +
    '</div>' +

    '<aside class="atom-panel">' +
      '<h3 class="atom-panel-title">Собери атом</h3>' +
      '<p class="atom-panel-hint">Пиши электронную конфигурацию — игра угадает элемент.</p>' +

      '<input class="atom-input" data-input type="text" spellcheck="false" autocomplete="off" ' +
        'placeholder="например: 1s2 2s2 2p6 3s1">' +

      '<div class="atom-chips" data-chips></div>' +

      '<div class="atom-recognized" data-recognized>' +
        '<span class="atom-recog-symbol" data-recog-symbol>?</span>' +
        '<span class="atom-recog-text" data-recog-text>Начни вводить конфигурацию…</span>' +
      '</div>' +

      '<div class="atom-actions">' +
        '<button class="btn btn--primary" data-action="ready">Готово</button>' +
      '</div>' +

      '<div class="atom-examples" data-examples>' +
        '<span class="atom-examples-label">Примеры:</span>' +
        EXAMPLES.map((e) =>
          '<button class="atom-example" data-example="' + e.cfg + '">' + e.cfg + '</button>'
        ).join('') +
      '</div>' +
    '</aside>' +

    // Крупный результат после «Готово»
    '<div class="atom-result" data-result hidden></div>';

  const modeSwitch = createModeSwitch({
    mode: 'lab',
    onMode: (id) => { ctx.game.setMode(id); ctx.screens.show('map'); },
  });
  container.querySelector('[data-mode-switch]').replaceWith(modeSwitch);

  const els = {
    input: container.querySelector('[data-input]'),
    chips: container.querySelector('[data-chips]'),
    recognized: container.querySelector('[data-recognized]'),
    recogSymbol: container.querySelector('[data-recog-symbol]'),
    recogText: container.querySelector('[data-recog-text]'),
    result: container.querySelector('[data-result]'),
  };

  // ------------------------------------------------------------------
  // Быстрые кнопки-подоболочки (удобно на телефоне)
  // ------------------------------------------------------------------
  const QUICK_SHELLS = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p'];
  els.chips.innerHTML = QUICK_SHELLS.map(
    (s) => '<button class="atom-chip" data-shell="' + s + '">' + s + '</button>',
  ).join('');

  // ------------------------------------------------------------------
  // 3D-атом
  // ------------------------------------------------------------------
  function setupScene() {
    ctx.renderer.scene.fog = null;
    ctx.renderer.scene.background = new THREE.Color(0x0b0e13);
    ctx.renderer.camera.position.set(0, 0.5, 16);
    ctx.renderer.setLookTarget(0, 0, 0);
    ctx.renderer.setParallax(false);

    atom = new AtomModel(ctx.renderer.scene);
    stopUpdate = ctx.renderer.onUpdate((dt) => {
      if (!atom) return;
      atom.update(dt);
      const cam = ctx.renderer.camera;
      // Камера подстраивается под РАЗМЕР атома: чем больше слоёв,
      // тем дальше отъезжаем, чтобы всё было видно целиком.
      const outer = 3.5 + (atom.shells.length || 1) * 1.9;
      const targetZ = outer * (confirmed ? 2.4 : 2.1);
      cam.position.z += (targetZ - cam.position.z) * Math.min(dt * 1.8, 1);
      cam.position.y += (0.5 - cam.position.y) * Math.min(dt * 1.8, 1);
      cam.lookAt(0, 0, 0);
    });
  }

  function teardownScene() {
    stopUpdate?.();
    stopUpdate = null;
    atom?.destroy();
    atom = null;
  }

  /** Перестроить атом по введённой конфигурации. */
  function refreshAtom() {
    if (!atom) return;
    const info = identifyAtom(els.input.value);
    if (!info.match || !info.z || !info.config) {
      atom.build([]);
      return;
    }
    // rebuild по «канонической» конфигурации элемента (или введённой для иона)
    const z = info.z;
    const shells = shellsFromConfig(info.config, z);
    atom.build(shells);
    // В песочнице показываем ВЕСЬ атом сразу, а не одну активную подоболочку
    atom.showAll();
  }

  /** Собрать оболочки из строки конфигурации для AtomModel. */
  function shellsFromConfig(configStr, z) {
    const tokens = configStr.split(' ').filter(Boolean);
    return tokens.map((tok) => {
      const m = tok.match(/^([1-7])([spdf])(\d+)$/i);
      if (!m) return null;
      const shell = m[1] + m[2].toLowerCase();
      const electrons = parseInt(m[3], 10);
      return { shell, electrons, cells: ORBITALS[m[2].toLowerCase()] };
    }).filter(Boolean);
  }

  // ------------------------------------------------------------------
  // Живое распознавание
  // ------------------------------------------------------------------
  function updateRecognition() {
    const info = identifyAtom(els.input.value);
    const val = els.input.value.trim();
    if (!val) {
      els.recognized.className = 'atom-recognized';
      els.recogSymbol.textContent = '?';
      els.recogText.textContent = 'Начни вводить конфигурацию…';
      refreshAtom();
      return;
    }
    if (info.match === 'none') {
      els.recognized.className = 'atom-recognized is-error';
      els.recogSymbol.textContent = '?';
      els.recogText.textContent = info.error ?? 'Не распознано';
      refreshAtom();
      return;
    }
    if (info.match === 'atom') {
      els.recognized.className = 'atom-recognized is-ok';
      els.recogSymbol.textContent = info.symbol;
      els.recogText.textContent = info.name + ' · Z = ' + info.z + ' · это нейтральный атом';
    } else {
      els.recognized.className = 'atom-recognized is-ion';
      els.recogSymbol.textContent = info.symbol;
      els.recogText.textContent =
        info.name + ' · ' + info.z + ' e\u207b — похоже на ион ' + (info.ionLabel ?? '');
    }
    refreshAtom();
  }

  // ------------------------------------------------------------------
  // «Готово»: закрепляем результат
  // ------------------------------------------------------------------
  function confirm() {
    const info = identifyAtom(els.input.value);
    if (info.match === 'none') {
      els.recognized.className = 'atom-recognized is-error';
      els.recogText.textContent = info.error ?? 'Не распознано';
      return;
    }
    confirmed = true;
    finalLook = 0;
    els.input.blur();

    const ref = info.match === 'atom' ? buildConfig(info.z) : null;
    const shells = ref ? ref.shells : shellsFromConfig(info.config, info.z);

    els.result.hidden = false;
    els.result.innerHTML =
      '<div class="atom-result-symbol">' + (info.symbol ?? '?') + '</div>' +
      '<div class="atom-result-name">' + (info.name ?? '') + '</div>' +
      '<div class="atom-result-config">' + (info.config ?? '') + '</div>' +
      '<div class="atom-result-note">' +
        (info.match === 'atom'
          ? 'Нейтральный атом. Простое вещество — ' + simpleSubstance(info.symbol)
          : 'Ион ' + (info.ionLabel ?? '') + '. Входит в состав солей и растворов.') +
      '</div>';

    // Рисуем итоговый атом целиком
    atom?.build(shells);
    atom?.showAll();
  }

  function clearAll() {
    els.input.value = '';
    confirmed = false;
    els.result.hidden = true;
    updateRecognition();
  }

  container.addEventListener('input', (e) => {
    if (e.target.closest('[data-input]')) { confirmed = false; els.result.hidden = true; updateRecognition(); }
  });

  function openPeriodic() {
    if (!windows) windows = new WindowManager(container);
    windows.openWindow('mendeleev', {
      title: 'Таблица Менделеева',
      content: '<img class="window-img" src="/textures/props/mendeleevtab.webp" alt="Таблица Менделеева">',
      x: window.innerWidth * 0.32,
      y: 70,
    });
  }

  container.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="back"]')) { ctx.screens.show('map'); return; }
    if (event.target.closest('[data-action="tables"]')) { openPeriodic(); return; }
    if (event.target.closest('[data-action="clear"]')) { clearAll(); return; }
    if (event.target.closest('[data-action="ready"]')) { confirm(); return; }
    const chip = event.target.closest('[data-shell]');
    if (chip) {
      const cur = els.input.value.trim();
      els.input.value = (cur ? cur + ' ' : '') + chip.dataset.shell;
      els.input.focus();
      updateRecognition();
      return;
    }
    const ex = event.target.closest('[data-example]');
    if (ex) { els.input.value = ex.dataset.example; updateRecognition(); }
  });

  setupScene();
  updateRecognition();

  return {
    onShow() {
      modeSwitch.setMode('lab');
      if (!atom) setupScene();
      updateRecognition();
    },
    onHide() {
      teardownScene();
      windows?.closeAll();
      ctx.renderer.scene.background = new THREE.Color(0x120d08);
      ctx.renderer.scene.fog = new THREE.Fog(0x120d08, 12, 34);
      ctx.renderer.setLookTarget(0, 1.4, 0);
      ctx.renderer.camera.position.set(0, 3.2, 9);
      ctx.renderer.setParallax(true);
    },
    dispose() {
      modeSwitch.destroy();
      windows?.closeAll();
      teardownScene();
    },
  };
}

/** Простое вещество для элемента (грубая, но наглядная подсказка). */
function simpleSubstance(symbol) {
  const map = {
    H: 'H2 (водород)', He: 'He (гелий)', Li: 'Li (металл)', C: 'C (графит/алмаз)',
    N: 'N2 (азот)', O: 'O2 (кислород)', F: 'F2 (фтор)', Na: 'Na (металл)',
    Mg: 'Mg (металл)', Al: 'Al (металл)', Si: 'Si (кремний)', P: 'P4 (фосфор)',
    S: 'S8 (сера)', Cl: 'Cl2 (хлор)', K: 'K (металл)', Ca: 'Ca (металл)',
    Fe: 'Fe (железо)', Cu: 'Cu (медь)', Zn: 'Zn (цинк)', Ag: 'Ag (серебро)',
    Ar: 'Ar (аргон)', Ne: 'Ne (неон)',
  };
  return map[symbol] ?? symbol;
}
