import * as THREE from 'three';

/**
 * Освещение сцены в тёплой "ламповой" палитре.
 *
 * Схема (классическая для тёмных диорам — key / fill / rim):
 *  - key    : тёплая лампа сверху — основной свет, отбрасывает тени
 *  - fill   : холодноватый слабый заполняющий, чтобы тени не были чёрными
 *  - rim    : контровой сзади — отделяет силуэт от фона
 *  - ambient: минимальная общая подсветка тёплым
 *
 * Плюс точечные источники для "лампы над столом" и свечения реактивов.
 */

export function createLighting(scene) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const ambient = new THREE.AmbientLight(0xffd0a0, 0.28);
  group.add(ambient);

  // Полусферический подмес: тёплый верх, коричневый низ
  const hemi = new THREE.HemisphereLight(0xffc98a, 0x2a1a0d, 0.45);
  group.add(hemi);

  // --- Key light: тёплая лампа, даёт тени ---
  const key = new THREE.PointLight(0xffb44d, 55, 30, 2);
  key.position.set(-1.5, 6.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0012;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  group.add(key);

  // --- Fill light: холодный слабый справа ---
  const fill = new THREE.PointLight(0x6fa8ff, 12, 26, 2);
  fill.position.set(6, 2.5, 4);
  group.add(fill);

  // --- Rim light: контровой сзади ---
  const rim = new THREE.PointLight(0xff8a3d, 18, 24, 2);
  rim.position.set(2, 3.5, -5);
  group.add(rim);

  scene.add(group);

  return { group, ambient, hemi, key, fill, rim };
}
