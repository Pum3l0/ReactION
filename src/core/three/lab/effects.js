import * as THREE from 'three';
import gsap from 'gsap';
import { EFFECTS } from '../../../data/reactions.js';
import { updateLiquidGeometry } from './geometry.js';

/**
 * Визуальные эффекты реакций.
 *
 * Здесь и только здесь трогаем свойства Mesh по результату из движка.
 * Движок посчитал — эти функции показали.
 *
 * Важно: жидкости перестраиваются по профилю сосуда (см. geometry.js),
 * поэтому в круглой колбе они не выходят за стекло.
 */

export function tintLiquid(liquid, hex, duration = 0.7) {
  if (!liquid) return;
  const target = new THREE.Color(hex ?? 0xdfe9f0);
  gsap.to(liquid.material.color, {
    r: target.r, g: target.g, b: target.b,
    duration, ease: 'power2.out',
  });
}

/**
 * Плавно задать уровень жидкости 0..1.
 * Геометрия перестраивается по профилю сосуда на каждом шаге анимации,
 * а не масштабируется — так жидкость всегда внутри стекла.
 */
export function setLiquidLevel(liquid, level, duration = 0.35) {
  if (!liquid) return;
  const proxy = { v: liquid.userData.level ?? 0 };
  gsap.to(proxy, {
    v: level,
    duration,
    ease: 'power2.out',
    onUpdate() {
      updateLiquidGeometry(liquid, proxy.v);
    },
    onComplete() {
      updateLiquidGeometry(liquid, level);
    },
  });
  liquid.userData.level = level;
}

/** Достать профиль сосуда (у меша или у самого сосуда). */
function shapeOf(vessel) {
  return vessel?.shape ?? vessel?.userData?.shape ?? null;
}

/** Радиус сосуда на данной высоте (с запасом внутрь, чтобы не вылезти). */
function radiusAtHeight(vessel, y) {
  const s = shapeOf(vessel);
  if (!s) return 0.2;
  return Math.max(s.radiusAt(y) * 0.92, 0.04);
}

/** Высота жидкости в 3D-единицах. */
function liquidTop(vessel) {
  const s = shapeOf(vessel);
  const liquid = vessel?.liquid ?? vessel;
  if (!s) return 0.6;
  const lvl = liquid?.userData?.level ?? vessel?.level ?? 0.3;
  return Math.max(lvl * s.height * 0.94, 0.02);
}

/**
 * Осадок: облако частиц, оседающее на дно сосуда.
 * Радиус подобран под текущий сосуд — в колбе осадок шире, чем в пробирке.
 */
export function spawnPrecipitate(parent, color, weak = false, vessel = null) {
  const cfg = weak ? EFFECTS.weak : EFFECTS.precipitate;
  const n = cfg.particles;
  const topY = liquidTop(vessel);

  // Старт: частицы распределены в толще раствора, но ВНУТРИ профиля сосуда.
  const positions = new Float32Array(n * 3);
  const starts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const y = 0.03 + Math.random() * Math.max(topY, 0.15);
    const rMax = radiusAtHeight(vessel, y) * 0.9;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * rMax;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    starts[i * 3] = x;
    starts[i * 3 + 1] = y;
    starts[i * 3 + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const baseSize = radiusAtHeight(vessel, 0.1);
  const mat = new THREE.PointsMaterial({
    color,
    size: weak ? baseSize * 0.16 : baseSize * 0.22,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'precipitate';
  parent.add(points);

  const attr = geo.attributes.position;
  gsap.to(mat, { opacity: cfg.cloudAlpha, duration: 0.45, ease: 'power2.out' });

  // Оседание: каждая частица идёт вниз, оставаясь внутри профиля (без разлёта).
  const proxy = { t: 0 };
  gsap.to(proxy, {
    t: 1,
    duration: cfg.settleTime,
    ease: 'power1.in',
    onUpdate() {
      const t = proxy.t;
      for (let i = 0; i < n; i++) {
        const startY = starts[i * 3 + 1];
        const y = 0.02 + (startY - 0.02) * (1 - t);
        // горизонтально НЕ разлетаемся; чуть подтягиваем к центру у дна
        const pull = 0.85 + 0.15 * (1 - t);
        attr.array[i * 3] = starts[i * 3] * pull;
        attr.array[i * 3 + 1] = y;
        attr.array[i * 3 + 2] = starts[i * 3 + 2] * pull;
      }
      attr.needsUpdate = true;
    },
  });

  return points;
}

export function clearPrecipitate(parent) {
  const old = parent.getObjectByName('precipitate');
  if (!old) return;
  old.geometry.dispose();
  old.material.dispose();
  parent.remove(old);
}

/**
 * Газ: пузырьки, всплывающие в жидкости. Возвращает { mesh, tick(dt) }.
 * Пузырьки появляются по всему сечению сосуда и всплывают до уровня жидкости.
 */
export function spawnGas(parent, color, vessel, onFinished) {
  const cfg = EFFECTS.gas;
  const count = cfg.bubbleCount;
  const topY = liquidTop(vessel);
  // Радиус на уровне дна, чтобы пузырьки не вылезали за стекло
  const R = radiusAtHeight(vessel, 0.1) * 0.8;

  const geo = new THREE.SphereGeometry(Math.max(R * 0.16, 0.02), 8, 6);
  const mat = new THREE.MeshPhysicalMaterial({
    color: color ?? 0xffffff,
    transparent: true,
    opacity: 0.5,
    roughness: 0,
    metalness: 0,
    transmission: 0.85,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'gas';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(mesh);

  const bubbles = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * R;
    bubbles.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      y: Math.random() * topY,
      speed: cfg.riseSpeed * (0.6 + Math.random() * 0.9),
      scale: 0.5 + Math.random() * 0.8,
    });
  }

  const dummy = new THREE.Object3D();
  let alive = 0;

  const tick = (dt) => {
    alive += dt;
    const fade = alive > cfg.lifetime ? Math.max(0, 1 - (alive - cfg.lifetime) / 0.6) : 1;
    for (let i = 0; i < count; i++) {
      const b = bubbles[i];
      b.y += b.speed * dt;
      if (b.y > topY) b.y = 0.02;
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.scale * fade);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = 0.5 * fade;
    if (alive > cfg.lifetime + 0.6) onFinished?.(mesh);
  };

  return { mesh, tick };
}

/**
 * Пар/испарение при нагреве: лёгкие струйки вверх над сосудом.
 * Возвращает { tick(dt) }.
 */
export function spawnSteam(parent, onFinished) {
  const count = 20;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.12;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(a) * r;
    velocities.push({ v: 0.25 + Math.random() * 0.35, drift: (Math.random() - 0.5) * 0.15 });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xdfe9f0,
    size: 0.09,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'steam';
  parent.add(points);

  const attr = geo.attributes.position;
  let alive = 0;

  const tick = (dt) => {
    alive += dt;
    for (let i = 0; i < count; i++) {
      attr.array[i * 3 + 1] += velocities[i].v * dt;
      attr.array[i * 3] += velocities[i].drift * dt;
      if (attr.array[i * 3 + 1] > 0.8) {
        attr.array[i * 3 + 1] = 0;
        attr.array[i * 3] = (Math.random() - 0.5) * 0.2;
        attr.array[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
      }
    }
    attr.needsUpdate = true;
    mat.opacity = 0.55 * Math.max(0, 1 - alive / 6);
    if (alive > 6) onFinished?.(points);
  };

  return { points, tick };
}

export function createFlame() {
  const group = new THREE.Group();
  group.name = 'flame';
  group.visible = false;

  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.5, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  inner.position.y = 0.25;
  group.add(inner);

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.8, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  outer.position.y = 0.4;
  group.add(outer);

  const light = new THREE.PointLight(0xffa64d, 0, 4, 2);
  light.position.y = 0.5;
  group.add(light);

  const tick = (dt, elapsed = 0) => {
    if (!group.visible) return;
    const flicker = 1 + Math.sin(elapsed * 14) * 0.08 + Math.sin(elapsed * 27) * 0.05;
    inner.scale.set(1, flicker, 1);
    outer.scale.set(flicker * 0.96, flicker * 1.05, flicker * 0.96);
    light.intensity = 6 * flicker;
  };

  return { group, tick, setOn(on) { group.visible = on; } };
}

/** Убрать пар (при сбросе). */
export function clearSteam(parent) {
  const old = parent.getObjectByName('steam');
  if (!old) return;
  old.geometry.dispose();
  old.material.dispose();
  parent.remove(old);
}

/* ==========================================================================
   Анимация перелива, фильтр и магнит — «материальные» следы процессов
   ========================================================================== */

/**
 * Струйка жидкости из носика носика (from) в приёмник (to).
 * Живёт в мировых координатах сцены, поэтому parent — корень лаборатории.
 * @returns {{ mesh, tick(dt), stop() }}
 */
export function createPourStream(parent, color) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: color ?? 0x9fd2f0,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
    transmission: 0.5,
    depthWrite: false,
  });

  // Струя — тонкий цилиндр, который будем растягивать между точками
  const geo = new THREE.CylinderGeometry(0.035, 0.025, 1, 8, 1, true);
  geo.translate(0, 0.5, 0); // точка отсчёта — низ
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'pour-stream';
  mesh.visible = false;
  parent.add(mesh);

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  let active = false;

  function update() {
    dir.subVectors(to, from);
    const len = dir.length();
    if (len < 0.001) return;
    mid.addVectors(from, to).multiplyScalar(0.5);
    mesh.position.copy(from);
    mesh.scale.set(1, len, 1);
    q.setFromUnitVectors(up, dir.clone().normalize());
    mesh.quaternion.copy(q);
  }

  return {
    mesh,
    start(fromV, toV) {
      from.copy(fromV); to.copy(toV);
      active = true;
      mesh.visible = true;
      update();
    },
    move(fromV, toV) {
      if (!active) return;
      from.copy(fromV); to.copy(toV);
      update();
    },
    stop() {
      active = false;
      mesh.visible = false;
    },
    get active() { return active; },
    dispose() {
      geo.dispose(); mat.dispose(); parent.remove(mesh);
    },
  };
}

/**
 * Фильтр (воронка с бумажным фильтром) — материальный след фильтрования.
 * Ставится на стол; на бумаге собирается осадок нужного цвета.
 * @returns {{ group, setPrecipitate(color, name), clear(), dispose() }}
 */
export function createStrainer() {
  const group = new THREE.Group();
  group.name = 'strainer';
  group.visible = false;

  // Стеклянная воронка — конус
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdfe9f0, transparent: true, opacity: 0.35,
    roughness: 0.1, transmission: 0.85, thickness: 0.4, side: THREE.DoubleSide,
  });
  const funnel = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.5, 20, 1, true), glass);
  funnel.position.y = 0.65;
  funnel.rotation.x = Math.PI; // носиком вниз
  group.add(funnel);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 12, 1, true), glass);
  neck.position.y = 0.22;
  group.add(neck);

  // Бумажный фильтр с осадком
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.9, side: THREE.DoubleSide });
  const paper = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.42, 18, 1, true), paperMat);
  paper.position.y = 0.68;
  paper.rotation.x = Math.PI;
  group.add(paper);

  // Слой осадка на фильтре
  const residueMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95, side: THREE.DoubleSide });
  const residue = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.2, 18, 1, true), residueMat);
  residue.position.y = 0.72;
  residue.rotation.x = Math.PI;
  residue.visible = false;
  group.add(residue);

  return {
    group,
    setPrecipitate(color, name) {
      residueMat.color.setHex(color ?? 0x888888);
      residue.visible = true;
      group.visible = true;
      group.userData.residueName = name;
    },
    show() { group.visible = true; },
    clear() {
      residue.visible = false;
      residueMat.color.setHex(0x888888);
      group.visible = false;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      group.parent?.remove(group);
    },
  };
}

/**
 * Магнит — материальный след магнитного отделения.
 * После «притягивания» на нём остаётся комок железной стружки.
 */
export function createMagnet() {
  const group = new THREE.Group();
  group.name = 'magnet';
  group.visible = false;

  // Подковообразный магнит: дуга + два полюса
  const metal = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4, metalness: 0.5 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 20, Math.PI), metal);
  arc.position.y = 0.3;
  group.add(arc);

  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 12), metal);
  leg1.position.set(-0.22, 0.18, 0);
  group.add(leg1);
  const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 12), metal);
  leg2.position.set(0.22, 0.18, 0);
  group.add(leg2);

  // Комок притянутой стружки
  const filings = new THREE.Group();
  filings.name = 'filings';
  for (let i = 0; i < 16; i++) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.09, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.7, metalness: 0.8 }),
    );
    f.position.set((Math.random() - 0.5) * 0.3, 0.05 + Math.random() * 0.14, (Math.random() - 0.5) * 0.2);
    f.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    filings.add(f);
  }
  filings.visible = false;
  group.add(filings);

  return {
    group,
    setFilings(on) {
      filings.visible = on;
      group.visible = on;
    },
    show() { group.visible = true; },
    clear() { filings.visible = false; group.visible = false; },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      group.parent?.remove(group);
    },
  };
}
