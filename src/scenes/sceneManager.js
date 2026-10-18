import * as THREE from 'three';

/**
 * SceneManager — держит «текущий» 3D-фон поверх общих света/настроек.
 *
 * Локации теперь рисуются как панорамные картинки внутри DOM-экранов,
 * поэтому 3D-склад-плейсхолдер больше не нужен: он лишь мелькал за
 * панорамой при переходе на уровень. Здесь остаётся только амбиентный
 * фон для меню и карты (даёт лёгкий параллакс камерой).
 */
export class SceneManager {
  constructor(renderer, lighting) {
    this.renderer = renderer;
    this.lighting = lighting;
    this.current = null;
    this.currentId = null;
  }

  /** Показать 3D-фон. Локации переключают только подсветку, не геометрию. */
  show(id) {
    // Контент фона не зависит от экрана — не пересоздаём его без нужды.
    if (!this.current) {
      this.current = buildAmbientBackdrop(this.renderer.scene);
      this.renderer.scene.add(this.current);
    }
    this.current.visible = true;
    this.currentId = id;
  }

  /** Спрятать фон, не уничтожая его (у экранов вроде Орбитария свой 3D). */
  hide() {
    if (this.current) this.current.visible = false;
  }

  /** Полностью убрать фон (если понадобится). */
  clear() {
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

  return group;
}
