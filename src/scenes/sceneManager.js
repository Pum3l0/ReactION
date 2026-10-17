import * as THREE from 'three';
import { buildWarehouseScene } from './warehouse.js';

/**
 * SceneManager — держит "текущую" игровую сцену поверх общих света/фона.
 *
 * Свет и настройки рендерера живут в Renderer и Lighting и не пересоздаются.
 * SceneManager только подчищает и подставляет геометрию конкретной локации.
 */
export class SceneManager {
  constructor(renderer, lighting) {
    this.renderer = renderer;
    this.lighting = lighting;
    this.current = null;
    this.currentId = null;
  }

  /** Показать сцену-плейсхолдер для конкретного контекста. */
  show(id, location = null) {
    this._clear();

    if (id === 'warehouse') {
      this.current = buildWarehouseScene(this.renderer.scene, location?.palette);
    } else {
      // Меню и карта: лёгкая "подложка" — пара плоскостей для параллакса
      this.current = buildAmbientBackdrop(this.renderer.scene);
    }

    this.currentId = id;
  }

  _clear() {
    if (!this.current) return;
    this.renderer.scene.remove(this.current);
    this.current.traverse?.((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.current = null;
  }
}

/**
 * Фон для меню: несколько разнесённых по глубине плоскостей-«дощечек»,
 * чтобы параллакс камерой был заметен сразу.
 */
function buildAmbientBackdrop(scene) {
  const group = new THREE.Group();
  group.name = 'backdrop';

  const layerColors = [0x1a120b, 0x241810, 0x2f2013, 0x3a2a18];
  layerColors.forEach((color, i) => {
    const depth = -8 - i * 4;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 24),
      new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }),
    );
    plane.position.set(0, 4, depth);
    group.add(plane);
  });

  // Пол
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.4, 18),
    new THREE.MeshStandardMaterial({ color: 0x2b1d11, roughness: 0.95 }),
  );
  floor.position.set(0, -0.2, 0);
  floor.receiveShadow = true;
  group.add(floor);

  scene.add(group);
  return group;
}
