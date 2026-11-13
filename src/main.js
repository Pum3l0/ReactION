import './styles/fonts.css';
import './styles/base.css';
import './styles/menu.css';
import './styles/screens.css';
import './styles/orbital.css';
import './styles/lab.css';
import './styles/atomlab.css';
import './styles/responsive.css';

import { Renderer } from './core/renderer.js';
import { createLighting } from './core/lighting.js';
import { SceneManager } from './scenes/sceneManager.js';
import { ScreenManager, createEvents } from './core/screenManager.js';
import { Game } from './core/game.js';

import { initDeviceWatcher } from './core/device.js';

import { menuScreen } from './screens/menu.js';
import { mapScreen } from './screens/map.js';
import { levelScreen } from './screens/level.js';
import { orbitalScreen } from './screens/orbital.js';
import { labScreen } from './screens/lab.js';
import { atomLabScreen } from './screens/atomLab.js';

/* --------------------------------------------------------------------------
 * ReactION — точка входа.
 * Собирает рендерер, свет, менеджеры сцен/экранов и состояние игры.
 * ------------------------------------------------------------------------ */

const canvas = document.querySelector('#scene');
const ui = document.querySelector('#ui');

const renderer = new Renderer(canvas);
const lighting = createLighting(renderer.scene);

const scenes = new SceneManager(renderer, lighting);
const events = createEvents();
const game = new Game();

const ctx = { renderer, scenes, events, game };

const screens = new ScreenManager(ui, ctx);
ctx.screens = screens;

screens.register('menu', menuScreen);
screens.register('map', mapScreen);
screens.register('level', levelScreen);
screens.register('orbital', orbitalScreen);
// Орбитарий продублирован в раздел «Лаборатория» (тот же экран, другой id).
// Так тренажёр по строению атома живёт и в «Смене», и в лаборатории.
screens.register('orbital-lab', orbitalScreen);
// Экран лаборатории один, но работает в двух режимах (см. ctx.game.mode):
//  - 'lab-shift': задания от мастера (раздел «Смена»)
//  - 'lab':       свободный полигон (раздел «Лаборатория»)
screens.register('lab', labScreen);
screens.register('lab-shift', labScreen);
// Песочница атома: пишешь конфигурацию — игра угадывает элемент
screens.register('atom-lab', atomLabScreen);

// Экраны, владеющие собственной 3D-сценой и камерой: для них фоновую
// диораму меню/карты нужно спрятать, иначе она мелькает за столом.
const OWN_SCENE_SCREENS = new Set(['orbital', 'orbital-lab', 'lab', 'lab-shift', 'atom-lab']);

events.on('screen:changed', (id) => {
  if (OWN_SCENE_SCREENS.has(id)) {
    scenes.hide();
    return;
  }
  scenes.show(id);
});

// Фон меню (первый показ)
scenes.show('menu');
screens.show('menu');

// Лёгкое «дыхание» света в меню
renderer.onUpdate((_dt, elapsed) => {
  lighting.key.intensity = 55 + Math.sin(elapsed * 1.4) * 5;
});

// Следим за доступной высотой и ориентацией без блокировки портретного режима.
const deviceWatcher = initDeviceWatcher({
  onChange: ({ device, orientation }) => {
    ctx.events.emit('device:changed', { device, orientation });
  },
});
ctx.device = deviceWatcher;

// Доступ из консоли для отладки
window.__reactIon = ctx;
