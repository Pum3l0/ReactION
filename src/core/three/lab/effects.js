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

/** Радиус сосуда на уровне «верх жидкости» — для осадка и газа. */
function liquidRadius(liquid) {
  const s = liquid?.userData?.shape;
  if (!s) return 0.2;
  const top = (liquid.userData.level ?? 0.3) * s.height * 0.9;
  return Math.max(s.radiusAt(top), 0.05);
}

/** Высота уровня жидкости в 3D-единицах (для газа и осадка). */
function liquidTop(liquid) {
  const s = liquid?.userData?.shape;
  if (!s) return 0.6;
  return Math.max((liquid.userData.level ?? 0.3) * s.height * 0.94, 0.1);
}

/**
 * Осадок: облако частиц, оседающее на дно сосуда.
 * Радиус подобран под текущий сосуд — в колбе осадок шире, чем в пробирке.
 */
export function spawnPrecipitate(parent, color, weak = false, liquid = null) {
  const cfg = weak ? EFFECTS.weak : EFFECTS.precipitate;
  const n = cfg.particles;
  const R = liquidRadius(liquid) * 0.85;

  const positions = new Float32Array(n * 3);
  const starts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * R;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0.1 + Math.random() * Math.max(R * 1.5, 0.4);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    starts[i * 3] = x;
    starts[i * 3 + 1] = y;
    starts[i * 3 + 2] = z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color,
    size: weak ? 0.028 : 0.042,
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

  const proxy = { t: 0 };
  gsap.to(proxy, {
    t: 1,
    duration: cfg.settleTime,
    ease: 'power1.in',
    onUpdate() {
      const t = proxy.t;
      for (let i = 0; i < n; i++) {
        const base = starts[i * 3 + 1];
        attr.array[i * 3] = starts[i * 3] * (1 + t * 0.3);
        attr.array[i * 3 + 1] = 0.02 + (base - 0.02) * (1 - t);
        attr.array[i * 3 + 2] = starts[i * 3 + 2] * (1 + t * 0.3);
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
export function spawnGas(parent, color, liquid, onFinished) {
  const cfg = EFFECTS.gas;
  const count = cfg.bubbleCount;
  const R = liquidRadius(liquid) * 0.8;
  const topY = liquidTop(liquid);

  const geo = new THREE.SphereGeometry(Math.max(R * 0.14, 0.02), 8, 6);
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
