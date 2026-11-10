import * as THREE from 'three';
import { distributeElectrons } from '../data/electronConfig.js';

/**
 * 3D-модель атома для Орбитария.
 *
 * Композиция (по требованию):
 *  - крупный протон СЛЕВА, за пределами кадра;
 *  - от него уходят ДУГИ орбиталей вправо — видны лишь фрагменты,
 *    потому что модель крупнее экрана;
 *  - по дугам бегают электроны, их видно и можно «снимать»;
 *  - одновременно в кадре предыдущая, текущая и следующая орбитали;
 *  - при завершении атом отдаляется — видно целиком.
 *
 * Модель упрощённая: электроны здесь шарики, а не облака вероятности.
 */

const PALETTE = {
  proton: 0xffe6a8,
  protonDim: 0xffb24d,
  shell: 0x5a5040,
  shellActive: 0xffd166,
  shellSolved: 0xa6e88f,
  electronUp: 0xfff6cc,
  electronDown: 0xa8ccff,
};

/** Цвета подоболочек — чтобы сразу видеть, где чьи электроны. */
const SUBSHELL_COLORS = {
  s: 0xffd166, // золотой
  p: 0x7fc4ff, // голубой
  d: 0xa6e88f, // зелёный
  f: 0xe8a6e0, // розовый
};

/** Радиусы орбиталей в мировых единицах. */
const PROTON_RADIUS = 1.2;
const PROTON_X = -2.2;
const SHELL_BASE = 2.2;
/** Шаг между электронными СЛОЯМИ (n). */
const LAYER_STEP = 1.45;
/** Зазор между подоболочками (s, p, d) одного слоя. */
const SUBSHELL_GAP = 0.42;

export class AtomModel {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'atom';
    scene.add(this.group);

    this.shells = [];
    this.activeIndex = 0;
    this.expanded = false;
    this._time = 0;

    this._buildProton();
  }

  // ----------------------------------------------------------------
  // Протон
  // ----------------------------------------------------------------
  _buildProton() {
    const geo = new THREE.SphereGeometry(PROTON_RADIUS, 48, 36);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.proton,
      emissive: PALETTE.protonDim,
      emissiveIntensity: 1.9,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.proton = new THREE.Mesh(geo, mat);
    this.proton.position.set(PROTON_X, 0, 0);
    this.group.add(this.proton);

    // Двухслойный ореол — имитация свечения без пост-обработки
    for (const [scale, opacity] of [
      [1.22, 0.28],
      [1.55, 0.14],
      [1.95, 0.06],
    ]) {
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(PROTON_RADIUS * scale, 32, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffc973,
          transparent: true,
          opacity,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      this.proton.add(halo);
    }

    // Свет от протона
    const glow = new THREE.PointLight(0xffc36b, 260, 60, 2);
    this.proton.add(glow);
    this.protonLight = glow;
  }

  // ----------------------------------------------------------------
  // Орбитали
  // ----------------------------------------------------------------
  /**
   * Построить дуги по конфигурации.
   * @param {Array<{shell:string, electrons:number, cells:number}>} config
   */
  build(config) {
    this.clearShells();
    this.config = config;
    this.expanded = false;

    // Главное квантовое число n = номер электронного слоя.
    // Подоболочки 2s и 2p живут на ОДНОМ слое n=2 — значит один радиус.
    const layerNumbers = [...new Set(config.map((c) => Number(c.shell[0])))];

    config.forEach((rec, index) => {
      const n = Number(rec.shell[0]);
      const layerPos = layerNumbers.indexOf(n);

      // Подоболочки ОДНОГО слоя получают свой под-радиус,
      // чтобы 2s и 2p не легли друг на друга, но остались виден слой
      const siblings = config.filter((c) => Number(c.shell[0]) === n);
      const sibIndex = siblings.findIndex((c) => c.shell === rec.shell);

      const radius =
        SHELL_BASE +
        layerPos * LAYER_STEP +
        sibIndex * SUBSHELL_GAP;

      const group = new THREE.Group();
      group.position.copy(this.proton.position);

      const orbitalCount = rec.cells;

      // ОДНО кольцо на подоболочку: 2p — это одна орбиталь с 6 электронами,
      // а не три отдельных кольца. Клетки — лишь способ расставить стрелки.
      const ring = this._makeRing(radius, index, rec.cells);
      group.add(ring);

      this.group.add(group);

      this.shells.push({
        ...rec,
        index,
        n,
        radius,
        group,
        electronMeshes: [],
        solved: false,
        visible: index <= 1,
        electronsTotal: rec.electrons,
      });
    });

    this.setActive(0);
  }

  /**
   * Кольцо — полная окружность в плоскости XY.
   * Одна подоболочка — одно кольцо. Радиус фиксирован на момент создания
   * и не меняется: кольцо остаётся там, где появилось.
   *
   * cellsCount — сколько клеток в подоболочке (для раскладки электронов).
   */
  _makeRing(radius, index, cellsCount) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(200);
    const geo = new THREE.BufferGeometry().setFromPoints(points);

    const type = this.config?.[index]?.shell?.[1] ?? 's';
    const color = SUBSHELL_COLORS[type] ?? PALETTE.shell;

    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
    });

    const line = new THREE.Line(geo, mat);
    line.userData = {
      radius,
      index,
      cellsCount,
      startAngle: -Math.PI * 0.42,
      arcLength: Math.PI * 0.84,
      type,
    };
    return line;
  }

  clearShells() {
    for (const s of this.shells) {
      this.group.remove(s.group);
      s.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      for (const e of s.electronMeshes) {
        this.group.remove(e.mesh);
        e.mesh.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
      }
    }
    this.shells = [];
    this.activeIndex = 0;
  }

  // ----------------------------------------------------------------
  // Активная орбиталь + видимость соседей
  // ----------------------------------------------------------------
  setActive(index) {
    this.activeIndex = index;

      // Показываем электроны на активной дуге сразу — игрок их считает
    const active = this.shells[index];
    if (active && !active.solved && active.electronMeshes.length === 0) {
      const total = active.electronsTotal ?? 0;
      const cells = Array.from({ length: active.cells }, () => []);
      let remaining = total;
      for (let i = 0; i < cells.length && remaining > 0; i++) {
        cells[i].push('up');
        remaining--;
      }
      for (let i = 0; i < cells.length && remaining > 0; i++) {
        cells[i].push('down');
        remaining--;
      }
      this.setShellElectrons(index, cells);
    }

    this.shells.forEach((s, i) => {
      const show = i >= index - 1 && i <= index + 2; // прошлая, текущая, две следующие
      s.visible = show;
      s.group.visible = show;

      s.group.traverse((o) => {
        if (!o.material || !o.userData?.radius) return;
        if (s.solved) {
          o.material.color.setHex(PALETTE.shellSolved);
          o.material.opacity = 0.55;
        } else if (i === index) {
          o.material.color.setHex(PALETTE.shellActive);
          o.material.opacity = 0.95;
        } else {
          o.material.color.setHex(PALETTE.shell);
          o.material.opacity = 0.18;
        }
      });
    });

  }

  /**
   * ПОКАЗАТЬ ВЕСЬ АТОМ СРАЗУ (для режима-песочницы).
   * Все подоболочки видны, все электроны стоят на местах по правилу Хунда,
   * кольца раскрашены по типу (s/p/d/f). Активной (яркой) подоболочки нет.
   */
  showAll() {
    // Собираем все подоболочки в один общий радиус — чтобы слои не
    // наезжали друг на друга, но и были компактны.
    this.shells.forEach((s, i) => {
      s.visible = true;
      s.solved = false;
      s.group.visible = true;

      const type = s.shell[1];
      const color = SUBSHELL_COLORS[type] ?? PALETTE.shellActive;
      s.group.traverse((o) => {
        if (!o.material || !o.userData?.radius) return;
        o.material.color.setHex(color);
        o.material.opacity = 0.7;
      });

      // Заполняем электронами всю подоболочку по правилу Хунда
      const cells = distributeElectrons(s.electronsTotal, s.cells);
      this.setShellElectrons(i, cells);
      // И растягиваем их ПО ВСЕМУ кольцу, а не по короткой дуге
      for (const e of s.electronMeshes) {
        e.t = (e.t - 0.06) / 0.88; // из диапазона дуги в 0..1
        e.fullRing = true;
      }
    });
    this.expanded = true;
  }

  // ----------------------------------------------------------------
  // Электроны
  // ----------------------------------------------------------------
  /**
   * Показать на дуге «видимые» электроны — их можно перетаскивать.
   * @param {Array<Array<'up'|'down'>>} cells
   */
  setShellElectrons(index, cells) {
    const s = this.shells[index];
    if (!s) return;

    for (const e of s.electronMeshes) {
      s.group.remove(e.mesh);
      e.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    s.electronMeshes = [];

    if (cells.every((c) => c.length === 0)) return;

    // Все электроны подоболочки живут на ОДНОМ кольце.
    const ring = s.group.children[0];
    if (!ring) return;

    const type = s.shell[1];

    // Собираем список спинов в порядке клеток
    const spins = [];
    cells.forEach((spinsInCell) => spinsInCell.forEach((d) => spins.push(d)));

    spins.forEach((dir, i) => {
      const mesh = this._makeElectron(dir, type);
      s.electronMeshes.push({
        mesh,
        dir,
        // Равномерно по видимому сектору, с запасом по краям
        t: spins.length <= 1 ? 0.5 : 0.06 + (i / (spins.length - 1)) * 0.88,
        speed: (dir === 'up' ? 1 : -1) * 0.06,
        radius: s.radius,
        arcData: ring.userData,
      });
      s.group.add(mesh);
    });
  }

  _makeElectron(dir, type = 's') {
    const group = new THREE.Group();
    const tint = SUBSHELL_COLORS[type] ?? 0xfff0b8;

    const geo = new THREE.SphereGeometry(0.14, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint,
      emissiveIntensity: 3.4,
      roughness: 0.2,
    });
    group.add(new THREE.Mesh(geo, mat));

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshBasicMaterial({
        color: tint,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    group.add(halo);

    return group;
  }

  // ----------------------------------------------------------------
  // Прогресс
  // ----------------------------------------------------------------
  markSolved(index) {
    const s = this.shells[index];
    if (!s) return;
    s.solved = true;

    // продолжаем к следующей нерешённой
    const next = this.shells.findIndex((x) => !x.solved);
    if (next !== -1) this.setActive(next);
  }

  /** Финальное раскрытие — видно весь атом, электроны по всему кольцу. */
  expand() {
    this.expanded = true;

    this.shells.forEach((s) => {
      s.group.visible = true;
      s.group.traverse((o) => {
        if (!o.material || !o.userData?.radius) return;
        o.material.color.setHex(s.solved ? PALETTE.shellSolved : PALETTE.shellActive);
        o.material.opacity = s.solved ? 0.85 : 0.6;
      });
    });

    // Электроны разъезжаются по всему кольцу, если их несколько
    // Электроны распределяются по всему кольцу и замирают — так их можно посчитать
    for (const s of this.shells) {
      const count = s.electronMeshes.length;
      s.electronMeshes.forEach((e, i) => {
        e.t = (i + 0.5) / count;
        if (e.arcData) {
          e.arcData = {
            ...e.arcData,
            startAngle: -Math.PI / 2,
            arcLength: Math.PI * 2,
          };
        }
        e.speed = 0; // стоят — чтобы можно было сосчитать
      });
    }
  }

  // ----------------------------------------------------------------
  // Кадр
  // ----------------------------------------------------------------
  update(dt) {
    this._time += dt;

    // Лёгкое «дыхание» протона
    const pulse = 1 + Math.sin(this._time * 1.6) * 0.02;
    this.proton.scale.setScalar(pulse);

    // Электроны: в режиме-песочнице бегут по ВСЕМУ кольцу, в задании —
    // ползут по дуге туда-сюда (их снимают по одному).
    for (const s of this.shells) {
      for (const e of s.electronMeshes) {
        if (!e.arcData) continue;
        const speed = e.fullRing ? 0.12 : e.speed;
        e.t += speed * dt;

        if (e.fullRing) {
          // Полная окружность, без разворота
          if (e.t > 1) e.t -= 1;
          if (e.t < 0) e.t += 1;
          const angle = e.arcData.startAngle + Math.PI * 2 * e.t;
          const r = e.arcData.radius;
          e.mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
        } else {
          if (e.t > 0.97 || e.t < 0.03) e.speed *= -1;
          e.t = Math.min(Math.max(e.t, 0.02), 0.98);
          if (this.expanded) {
            if (e.t > 1) e.t -= 1;
            if (e.t < 0) e.t += 1;
          }
          const angle = e.arcData.startAngle + e.arcData.arcLength * e.t;
          const r = e.arcData.radius;
          e.mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
        }
      }
    }
  }

  destroy() {
    this.clearShells();
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
