import './styles/base.css';
import './styles/screens.css';

import { Renderer } from './core/renderer.js';
import { createLighting } from './core/lighting.js';
import { SceneManager } from './scenes/sceneManager.js';
import { ScreenManager, createEvents } from './core/screenManager.js';
import { Game } from './core/game.js';

import { menuScreen } from './screens/menu.js';
import { mapScreen } from './screens/map.js';
import { levelScreen } from './screens/level.js';

/* --------------------------------------------------------------------------
 * Точка входа ChemQuest.
 * Собирает рендерер, свет, менеджеры сцен/экранов и состояние игры,
 * затем показывает главное меню.
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

// Фон меню
scenes.show('menu');
screens.show('menu');

// Небольшой прогрев света в меню: лампа слегка «дышит»
renderer.onUpdate((_dt, elapsed) => {
  lighting.key.intensity = 55 + Math.sin(elapsed * 1.4) * 5;
});

// Для отладки из консоли
window.__chemquest = ctx;
