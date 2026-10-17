import * as THREE from 'three';

/**
 * Плейсхолдер-диорама склада реактивов.
 *
 * Собрана из примитивов Three.js: пол, две задние стены, стеллажи с
 * коробками, бочки, лампа над столом. Задача — дать представление о
 * композиции, масштабе и свете до появления сгенерированных текстур.
 *
 * Когда будут готовы картинки, этот модуль заменяется на один-два
 * PlaneGeometry с текстурой диорамы (или на них же + отдельные props).
 */

export function buildWarehouseScene(scene, palette = {}) {
  const group = new THREE.Group();
  group.name = 'warehouse';

  const floorColor = palette.floor ?? 0x3a2a18;
  const wallColor = palette.walls ?? 0x2b1d11;

  const mats = {
    floor: new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.95, metalness: 0.02 }),
    wall: new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.03 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.8, metalness: 0.05 }),
    crate: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85, metalness: 0.04 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x3f6b52, roughness: 0.55, metalness: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x6b6b70, roughness: 0.4, metalness: 0.7 }),
  };

  // --- Пол ---
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 16), mats.floor);
  floor.position.set(0, -0.2, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Задняя стена ---
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 0.4), mats.wall);
  backWall.position.set(0, 4.5, -7);
  backWall.receiveShadow = true;
  group.add(backWall);

  // --- Левая стена ---
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 16), mats.wall);
  leftWall.position.set(-9.8, 4.5, 0);
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // --- Стеллажи с коробками (вдоль задней стены) ---
  const shelfSpecs = [
    { x: -6.5, levels: 3, boxes: [3, 2, 1] },
    { x: -3.4, levels: 3, boxes: [2, 3, 2] },
    { x: 3.4, levels: 3, boxes: [3, 1, 2] },
    { x: 6.5, levels: 3, boxes: [2, 2, 3] },
  ];
  for (const spec of shelfSpecs) {
    group.add(makeShelf(spec, mats));
  }

  // --- Бочки у правой стены ---
  const barrelSpots = [
    { x: 7.6, z: 1.2 },
    { x: 8.4, z: 2.4 },
    { x: 7.9, z: 3.6 },
  ];
  for (const spot of barrelSpots) {
    group.add(makeBarrel(spot, mats));
  }

  // --- Рабочий стол с лампой (центр-передний план) ---
  group.add(makeWorkbench(mats));

  scene.add(group);
  return group;
}

function makeShelf({ x, levels, boxes }, mats) {
  const shelf = new THREE.Group();
  const width = 2.2;
  const height = 5.5;
  const depth = 1.1;

  // Вертикальные стойки
  const postGeo = new THREE.BoxGeometry(0.16, height, depth);
  for (const dx of [-width / 2, width / 2]) {
    for (const dz of [-depth / 2, depth / 2]) {
      const post = new THREE.Mesh(postGeo, mats.wood);
      post.position.set(dx, height / 2, dz);
      post.castShadow = true;
      shelf.add(post);
    }
  }

  // Полки + коробки на них
  for (let i = 0; i < levels; i++) {
    const y = 0.9 + i * 1.7;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), mats.wood);
    plank.position.set(0, y, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    shelf.add(plank);

    const count = boxes[i] ?? 0;
    for (let b = 0; b < count; b++) {
      const size = 0.55;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats.crate);
      const slot = count === 1 ? 0 : (b / (count - 1) - 0.5) * (width - size - 0.2);
      crate.position.set(slot, y + size / 2 + 0.06, 0);
      crate.rotation.y = (b * 0.4) % 0.5;
      crate.castShadow = true;
      crate.receiveShadow = true;
      shelf.add(crate);
    }
  }

  shelf.position.set(x, 0, -6.1);
  return shelf;
}

function makeBarrel({ x, z }, mats) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 1.4, 20),
    mats.barrel,
  );
  barrel.position.set(x, 0.7, z);
  barrel.castShadow = true;
  barrel.receiveShadow = true;

  const ringGeo = new THREE.TorusGeometry(0.51, 0.05, 8, 24);
  for (const y of [-0.35, 0.35]) {
    const ring = new THREE.Mesh(ringGeo, mats.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    barrel.add(ring);
  }
  return barrel;
}

function makeWorkbench(mats) {
  const bench = new THREE.Group();

  const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.6), mats.wood);
  top.position.y = 1.1;
  top.castShadow = true;
  top.receiveShadow = true;
  bench.add(top);

  const legGeo = new THREE.BoxGeometry(0.18, 1.1, 0.18);
  for (const dx of [-1.9, 1.9]) {
    for (const dz of [-0.65, 0.65]) {
      const leg = new THREE.Mesh(legGeo, mats.wood);
      leg.position.set(dx, 0.55, dz);
      leg.castShadow = true;
      bench.add(leg);
    }
  }

  // Колба на столе (намёк на химию)
  const flask = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 16),
    new THREE.MeshStandardMaterial({
      color: 0x7ee787,
      emissive: 0x2f6b3a,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    }),
  );
  flask.position.set(-1.2, 1.56, 0.1);
  flask.castShadow = true;
  bench.add(flask);

  // Небольшая тёплая подсветка колбы
  const flaskLight = new THREE.PointLight(0x7ee787, 6, 5, 2);
  flaskLight.position.set(-1.2, 2.1, 0.2);
  bench.add(flaskLight);

  bench.position.set(0, 0, 2.6);
  return bench;
}
