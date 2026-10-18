import './styles/fonts.css';
import './styles/base.css';
import './styles/menu.css';
import './styles/screens.css';
import './styles/orbital.css';

import { Renderer } from './core/renderer.js';
import { createLighting } from './core/lighting.js';
import { SceneManager } from './scenes/sceneManager.js';
import { ScreenManager, createEvents } from './core/screenManager.js';
import { Game } from './core/game.js';

import { menuScreen } from './screens/menu.js';
import { mapScreen } from './screens/map.js';
import { levelScreen } from './screens/level.js';
import { orbitalScreen } from './screens/orbital.js';

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

// Сцена следует за активным экраном: меняется только 3D-фон меню/карты.
// Сами локации рисуются панорамой внутри экрана уровня.
events.on('screen:changed', (id) => {
  // Орбитарий владеет собственной 3D-сценой и камерой
  if (id === 'orbital') {
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

// Доступ из консоли для отладки
window.__reactIon = ctx;
