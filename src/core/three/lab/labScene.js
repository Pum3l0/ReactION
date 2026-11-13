import * as THREE from 'three';
import {
  createVessel,
  createStand,
  createClamp,
  createBurner,
  createReagentBottle,
} from './geometry.js';
import {
  createFlame,
  createPourStream,
  createStrainer,
  createMagnet,
} from './effects.js';
import { REAGENTS } from '../../../data/reactions.js';

/**
 * 3D-мир лаборатории: рабочий стол, штатив, горелка, посуда, склянки.
 *
 * Стиль «средний» между тёмной палитрой проекта и учебным кабинетом:
 * тёплая лампа сверху, но холодный стеклянный и металлический стол.
 */

export class LabVessel {
  constructor({ group, liquid, solid, kind, shape, capacity, id }) {
    this.group = group;
    this.liquid = liquid;
    this.solid = solid;       // твёрдое вещество на дне (порошок/гранулы)
    this.kind = kind;
    this.shape = shape;       // профиль сосуда (radiusAt, height)
    this.capacity = capacity; // мл
    this.id = id;
    this.contents = [];       // [{ id, amount }]
    this.onBurner = false;
  }

  get volume() {
    return this.contents.reduce((s, c) => s + c.amount, 0);
  }

  get reagentIds() {
    return this.contents.map((c) => c.id);
  }

  get isEmpty() {
    return this.contents.length === 0;
  }

  /** Есть ли среди содержимого жидкость (для уровня жидкости). */
  get hasLiquid() {
    return this.contents.some((c) => c.phase === 'liquid');
  }

  /** Доля объёма только жидких реагентов. */
  get liquidVolume() {
    return this.contents.filter((c) => c.phase === 'liquid').reduce((s, c) => s + c.amount, 0);
  }

  /** Уровень жидкости 0..1 (только жидкая часть). */
  get level() {
    return Math.min(this.liquidVolume / this.capacity, 1);
  }

  /** Уровень твёрдого (для горки на дне). */
  get solidLevel() {
    const solidVol = this.contents.filter((c) => c.phase === 'solid').reduce((s, c) => s + c.amount, 0);
    return Math.min(solidVol / (this.capacity * 0.5), 1);
  }

  add(reagent, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const free = this.capacity - this.volume;
    const take = Math.max(0, Math.min(amount, free));
    if (take <= 0) return 0;
    // Сливаем одинаковые реагенты в одну запись
    const existing = this.contents.find((c) => c.id === reagent.id && !c.ions && !c.processed);
    if (existing) existing.amount += take;
    else this.contents.push({ id: reagent.id, amount: take, phase: reagent.phase ?? 'liquid' });
    return take;
  }

  clear() {
    this.contents = [];
  }
}

export function buildLab(scene) {
  const root = new THREE.Group();
  root.name = 'lab';

  // Свой свет лаборатории: «лампа над столом» + мягкий заполняющий.
  // Общий свет из lighting.js может оказаться недостаточным для стола,
  // поэтому лаборатория даёт свой свет, чтобы посуда читалась всегда.
  const labLight = new THREE.Group();
  labLight.name = 'lab-light';

  const ceiling = new THREE.DirectionalLight(0xfff2d8, 1.4);
  ceiling.position.set(2, 8, 4);
  ceiling.castShadow = true;
  ceiling.shadow.mapSize.set(1024, 1024);
  ceiling.shadow.camera.left = -8;
  ceiling.shadow.camera.right = 8;
  ceiling.shadow.camera.top = 6;
  ceiling.shadow.camera.bottom = -4;
  ceiling.shadow.bias = -0.001;
  labLight.add(ceiling);

  const lamp = new THREE.PointLight(0xffd9a0, 30, 14, 2);
  lamp.position.set(0, 5.5, 1.5);
  labLight.add(lamp);

  root.add(labLight);
  root.add(buildBench());
  root.add(buildBackWall());

  const stand = createStand();
  stand.position.set(-2.6, 0.12, -0.6);
  root.add(stand);

  const clampHi = createClamp(2.4);
  const clampLo = createClamp(1.5);
  clampHi.position.copy(stand.position);
  clampLo.position.copy(stand.position);
  root.add(clampHi, clampLo);

  // ГОРЕЛКА: справа на переднем крае, рядом с сосудами — чтобы было видно,
  // что́ именно ставят на огонь. Раньше она была сзади (z=-0.6), и пробирки
  // казались сбоку от неё.
  const BURNER_X = 3.2;
  const ROW_Z = 0.9; // передний ряд: на нём стоят сосуды и горелка
  const burnerGroup = createBurner();
  burnerGroup.position.set(BURNER_X, 0.12, ROW_Z);
  root.add(burnerGroup);

  const flame = createFlame();
  flame.group.position.set(BURNER_X, 0.95, ROW_Z);
  root.add(flame.group);

  // ВСЕ сосуды в один ряд на столе, на одной высоте. Их можно свободно
  // передвигать мышью и переливать содержимое друг в друга.
  const vessels = [];
  const vesselSpecs = [
    { kind: 'tube', pos: [-3.4, 0.12, ROW_Z], capacity: 30, id: 'tube-a' },
    { kind: 'tube', pos: [-2.6, 0.12, ROW_Z], capacity: 30, id: 'tube-b' },
    { kind: 'beaker', pos: [-1.2, 0.12, ROW_Z], capacity: 60, id: 'beaker' },
    { kind: 'flask', pos: [0.9, 0.12, ROW_Z], capacity: 100, id: 'flask' },
  ];
  for (const spec of vesselSpecs) {
    const { group, liquid, solid, kind, shape } = createVessel(spec.kind);
    group.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    root.add(group);
    const vessel = new LabVessel({ group, liquid, solid, kind, shape, capacity: spec.capacity, id: spec.id });
    vessel.homePos = group.position.clone();
    vessels.push(vessel);
  }

  scene.add(root);

  // Точка «на горелке» — ровно над пламенем, откуда хорошо видно сосуд
  const heatSpot = new THREE.Vector3(BURNER_X, 0.95, ROW_Z);

  // Дополнительные объекты на столе (фильтр с осадком, магнит) — скрыты,
  // появляются по ходу опыта на своих местах.
  const accessories = new THREE.Group();
  accessories.name = 'lab-accessories';
  root.add(accessories);

  const strainer = createStrainer();
  strainer.group.position.set(2.4, 0.12, ROW_Z - 1.4);
  accessories.add(strainer.group);

  const magnet = createMagnet();
  magnet.group.position.set(-2.0, 0.12, ROW_Z - 1.5);
  accessories.add(magnet.group);

  // Струйка при переливании (в мировых координатах)
  const pourStream = createPourStream(root);

  return {
    root,
    vessels,
    burner: burnerGroup,
    flame,
    heatSpot,
    accessories,
    strainer,
    magnet,
    pourStream,
    getVessel(id) {
      return vessels.find((v) => v.id === id);
    },
    dispose() {
      root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      scene.remove(root);
    },
  };
}

function buildBench() {
  const group = new THREE.Group();
  group.name = 'bench';

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.24, 5),
    new THREE.MeshStandardMaterial({ color: 0x3c4149, roughness: 0.55, metalness: 0.25 }),
  );
  top.receiveShadow = true;
  group.add(top);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.06, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.3, metalness: 0.6 }),
  );
  edge.position.set(0, 0.13, 2.5);
  group.add(edge);

  return group;
}

function buildBackWall() {
  const group = new THREE.Group();
  group.name = 'backwall';

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 9),
    new THREE.MeshStandardMaterial({ color: 0x1b2029, roughness: 0.95 }),
  );
  wall.position.set(0, 4, -4);
  group.add(wall);

  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.7, metalness: 0.15 });
  for (const y of [1.0, 2.0]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.7), shelfMat);
    shelf.position.set(0, y, -3.4);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);
  }

  return group;
}

export function placeReagents(scene, labRoot, reagentIds) {
  const group = new THREE.Group();
  group.name = 'reagents';
  const perRow = 4;

  reagentIds.forEach((id, i) => {
    const spec = REAGENTS[id];
    if (!spec) return;
    const bottle = createReagentBottle(spec.color);
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    bottle.position.set(-3 + col * 1.9, 1.05 + row * 1.0, -3.4);
    group.add(bottle);
  });

  labRoot.add(group);
  return {
    group,
    dispose() {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      labRoot.remove(group);
    },
  };
}
