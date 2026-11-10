import * as THREE from 'three';

/**
 * Процедурная посуда и оборудование лаборатории.
 *
 * ВАЖНО: никаких .glb/.png. Всё строится из LatheGeometry / базовых фигур.
 * Лёгкий бандл, честно воспроизводимо, материалы реагируют на свет сцены.
 *
 * Ключевая идея: у каждого сосуда есть ФУНКЦИЯ ПРОФИЛЯ radiusAt(y) —
 * радиус стенки на высоте y, и MAX_HEIGHT — высота борта.
 * По этой функции строится и стекло, и жидкость. Поэтому жидкость всегда
 * внутри стекла, какой бы формы ни был сосуд (в т.ч. круглая колба).
 */

/* --------------------------------------------------------------------------
 * Профили: { radiusAt(y), height, maxVolume, points[] }
 * points — для LatheGeometry (половинный разрез снизу вверх).
 * ------------------------------------------------------------------------ */

/** Пробирка: цилиндр со скруглённым дном. */
function tubeShape() {
  const R = 0.2;
  const H = 2.2;
  const bottom = R; // высота скругления
  return {
    height: H,
    radiusAt(y) {
      if (y <= 0) return 0.001;
      if (y < bottom) {
        // полусфера дна
        const dy = bottom - y;
        return Math.sqrt(Math.max(R * R - dy * dy, 0.0001));
      }
      return R;
    },
    points: [
      new THREE.Vector2(0.001, 0),
      ...arc(R, bottom),
      new THREE.Vector2(R, H),
    ],
  };
}

/** Стакан: цилиндр с чуть скруглённым дном и отбортовкой. */
function beakerShape() {
  const R = 0.55;
  const H = 1.6;
  const bottom = 0.08;
  return {
    height: H,
    radiusAt(y) {
      if (y <= 0) return 0.001;
      if (y < bottom) {
        const dy = bottom - y;
        return Math.sqrt(Math.max(R * R - dy * dy, 0.0001));
      }
      return R;
    },
    points: [
      new THREE.Vector2(0.001, 0),
      ...arc(R, bottom),
      new THREE.Vector2(R, H),
      new THREE.Vector2(R * 1.02, H + 0.05),
    ],
  };
}

/** Круглая колба: сфера + горлышко. */
function flaskShape() {
  const R = 0.62;        // радиус сферы
  const CY = 0.62;       // центр сферы по высоте
  const NECK_R = 0.17;   // радиус горлышка
  const NECK_TOP = 1.55; // высота горлышка
  const TOP = Math.sqrt(Math.max(R * R - NECK_R * NECK_R, 0.0001)) + CY; // где сфера сужается до горлышка

  return {
    height: NECK_TOP,
    radiusAt(y) {
      if (y <= 0) return 0.001;
      if (y < CY) {
        // нижняя половина сферы
        const dy = CY - y;
        return Math.sqrt(Math.max(R * R - dy * dy, 0.0001));
      }
      if (y <= TOP) {
        // верхняя половина сферы — сужается к горлышку
        const dy = y - CY;
        return Math.sqrt(Math.max(R * R - dy * dy, NECK_R * NECK_R));
      }
      return NECK_R; // горлышко
    },
    points: [
      new THREE.Vector2(0.001, 0),
      ...sphere(R, CY),
      new THREE.Vector2(NECK_R, NECK_TOP),
      new THREE.Vector2(NECK_R * 1.08, NECK_TOP + 0.05),
    ],
  };
}

/** Дуга полусферы дна (радиус R, высота bottom). */
function arc(R, bottom) {
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R * Math.sin(a), bottom - bottom * Math.cos(a)));
  }
  return pts.slice(1); // первую (0,bottom) уже задали через центр
}

/** Полная сфера для колбы: нижняя половина до центра и верхняя до горлышка. */
function sphere(R, CY) {
  const pts = [];
  const steps = 16;
  // от 0 до PI — полная окружность профиля
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(a) * R, CY - Math.cos(a) * R));
  }
  return pts;
}

const SHAPES = {
  tube: tubeShape,
  beaker: beakerShape,
  flask: flaskShape,
};

/** Сколько мл «влезает» в каждый сосуд (условно, для геймплея). */
export const VESSEL_CAPACITY = { tube: 30, beaker: 60, flask: 100 };

/** Максимальная высота жидкости в 3D-единицах для сосуда. */
export function vesselHeight(kind) {
  return (SHAPES[kind] ?? tubeShape)().height;
}

export function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xdfe9f0,
    transparent: true,
    opacity: 0.22,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.4,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createVessel(kind = 'tube') {
  const group = new THREE.Group();
  group.name = 'vessel-' + kind;

  const shape = (SHAPES[kind] ?? tubeShape)();
  const geo = new THREE.LatheGeometry(shape.points, 32);
  const glass = new THREE.Mesh(geo, createGlassMaterial());
  glass.name = 'glass';
  glass.castShadow = true;
  group.add(glass);

  const liquid = createLiquidMesh(kind, shape);
  group.add(liquid);

  return { group, liquid, kind, shape };
}

/**
 * Жидкость: отдельный меш, который перестраивается под уровень.
 * Профиль жидкости повторяет форму стенки (radiusAt), чуть уже её,
 * поэтому в круглой колбе жидкость не выходит за стекло.
 */
export function createLiquidMesh(kind, shape) {
  const s = shape ?? (SHAPES[kind] ?? tubeShape)();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe9f0,
    transparent: true,
    opacity: 0.55,
    roughness: 0.12,
    transmission: 0.4,
    thickness: 0.6,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'liquid';
  mesh.visible = false;
  // Храним профиль для перестройки геометрии под уровень
  mesh.userData.shape = s;
  mesh.userData.kind = kind;
  return mesh;
}

/**
 * Перестроить геометрию жидкости под уровень 0..1.
 * Использует реальный профиль сосуда — жидкость никогда не выходит за стенки.
 */
export function updateLiquidGeometry(liquid, level) {
  if (!liquid) return;
  const s = liquid.userData.shape;
  if (!s) return;

  const clamped = Math.max(0, Math.min(level, 1));
  if (clamped < 0.004) {
    liquid.visible = false;
    return;
  }

  const top = clamped * s.height * 0.94; // чуть не до самого края
  const steps = 14;
  const pts = [new THREE.Vector2(0.001, 0)];
  for (let i = 1; i <= steps; i++) {
    const y = (i / steps) * top;
    // Жидкость чуть уже стенки (0.96), чтобы не пересекаться со стеклом
    pts.push(new THREE.Vector2(s.radiusAt(y) * 0.96, y));
  }
  pts.push(new THREE.Vector2(0.001, top)); // крышка сверху, чтобы не было полого

  const geo = new THREE.LatheGeometry(pts, 28);
  // Старую геометрию освобождаем, если она есть (первый вызов — geometry пустая)
  if (liquid.geometry && liquid.geometry !== geo) liquid.geometry.dispose();
  liquid.geometry = geo;
  liquid.visible = true;
}

export function createStand() {
  const group = new THREE.Group();
  group.name = 'stand';
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.35, metalness: 0.85 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.9), metal);
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 12), metal);
  rod.position.set(-0.6, 1.7, 0);
  rod.castShadow = true;
  group.add(rod);

  return group;
}

export function createClamp(y = 2.2) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.35, metalness: 0.85 });

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10), metal);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-0.25, y, 0);
  group.add(arm);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 20), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.1, y, 0);
  group.add(ring);

  return group;
}

export function createBurner() {
  const group = new THREE.Group();
  group.name = 'burner';
  const body = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.5, metalness: 0.6 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.16, 20), body);
  base.position.y = 0.08;
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 14), body);
  stem.position.y = 0.4;
  stem.castShadow = true;
  group.add(stem);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.22, 14), body);
  nozzle.position.y = 0.72;
  nozzle.castShadow = true;
  group.add(nozzle);

  return group;
}

export function createReagentBottle(color) {
  const group = new THREE.Group();
  group.name = 'reagent-bottle';

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfd8e0,
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    transmission: 0.8,
    thickness: 0.5,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.62, 18), glassMat);
  body.position.y = 0.31;
  body.castShadow = true;
  group.add(body);

  const liquidMat = new THREE.MeshPhysicalMaterial({
    color: color ?? 0xeaf2ff,
    transparent: true,
    opacity: color ? 0.85 : 0.25,
    roughness: 0.15,
    transmission: 0.3,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.4, 16), liquidMat);
  liquid.position.y = 0.24;
  group.add(liquid);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.12, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.8 }),
  );
  cap.position.y = 0.66;
  group.add(cap);

  return group;
}
