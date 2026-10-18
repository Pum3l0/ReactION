/**
 * Живой фон главного меню: плавающие молекулы углеводородов.
 *
 * Всё рисуется на canvas (легко, без сотен DOM-узлов):
 *  - по экрану дрейфуют молекулы метана, этана, пропана;
 *  - у каждой молекулы атомы углерода (крупные) и водорода (мелкие);
 *  - время от времени молекула теряет атом водорода — он отлетает
 *    частицей, а к освободившемуся месту подлетает хлор Cl и встаёт
 *    вместо него (реакция замещения);
 *  - молекулы медленно вращаются и мягко отскакивают от краёв.
 *
 * Палитра строго в цветах проекта: масло / чернила / акценты.
 */

const COLORS = {
  carbon: '#6f6349',      // углерод — приглушённый тёплый
  hydrogen: '#c9b477',    // водород — мягкое масло (без крика)
  chlorine: '#84a878',    // хлор — приглушённый зелёный
  bond: 'rgba(242, 208, 104, 0.18)',
  glow: 'rgba(242, 208, 104, 0.35)',
  chlorineGlow: 'rgba(154, 209, 138, 0.3)',
};

/** Шаблоны молекул: позиции атомов в локальных координатах (в единицах связи). */
const MOLECULES = [
  {
    name: 'метан',
    atoms: [{ x: 0, y: 0 }],
    hydrogens: [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    ],
  },
  {
    name: 'этан',
    atoms: [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }],
    hydrogens: [
      { x: -1.2, y: 0.5 }, { x: -1.2, y: -0.5 }, { x: -0.5, y: 1 },
      { x: 0.5, y: 1 }, { x: 1.2, y: 0.5 }, { x: 1.2, y: -0.5 },
    ],
  },
  {
    name: 'пропан',
    atoms: [{ x: -0.9, y: 0 }, { x: 0, y: 0 }, { x: 0.9, y: 0 }],
    hydrogens: [
      { x: -1.5, y: 0.5 }, { x: -1.5, y: -0.5 }, { x: -0.9, y: 1 },
      { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 0.9, y: 1 },
      { x: 1.5, y: 0.5 }, { x: 1.5, y: -0.5 },
    ],
  },
];

const BOND_LEN = 26; // длина связи в пикселях

export class MoleculeField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.molecules = [];
    this.freeParticles = []; // отлетевшие водороды и подлетающие хлоры
    this.raf = null;
    this.lastTime = 0;

    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);
    window.addEventListener('resize', this._resize);

    this._resize();
    this._spawnMolecules();
    this.raf = requestAnimationFrame(this._tick);
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  _rand(a, b) {
    return a + Math.random() * (b - a);
  }

  _makeMolecule(template, x, y) {
    return {
      template,
      x,
      y,
      vx: this._rand(-0.25, 0.25),
      vy: this._rand(-0.25, 0.25),
      scale: this._rand(0.85, 1.25),
      angle: this._rand(0, Math.PI * 2),
      spin: this._rand(-0.08, 0.08),
      hydrogens: template.hydrogens.map((p) => ({ ...p })),
      chlorines: [],
      reactAt: this._rand(6, 18),
    };
  }

  _spawnMolecules() {
    // По экрану разбрасываем несколько молекул; они дрейфуют и заворачивают.
    const count = Math.max(9, Math.floor(this.w / 170));
    for (let i = 0; i < count; i++) {
      const tpl = MOLECULES[i % MOLECULES.length];
      this.molecules.push(
        this._makeMolecule(tpl, this._rand(80, this.w - 80), this._rand(80, this.h - 80)),
      );
    }
  }

  _tick(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05) || 0.016;
    this.lastTime = time;

    this._update(dt);
    this._draw();

    this.raf = requestAnimationFrame(this._tick);
  }

  _update(dt) {
    const { w, h } = this;

    for (const m of this.molecules) {
      m.x += m.vx;
      m.y += m.vy;
      m.angle += m.spin * dt;

      const margin = 90;
      if (m.x < margin) { m.x = margin; m.vx = Math.abs(m.vx); }
      if (m.x > w - margin) { m.x = w - margin; m.vx = -Math.abs(m.vx); }
      if (m.y < margin) { m.y = margin; m.vy = Math.abs(m.vy); }
      if (m.y > h - margin) { m.y = h - margin; m.vy = -Math.abs(m.vy); }

      // Реакции: замещение / присоединение
      m.reactAt -= dt;
      if (m.reactAt <= 0) {
        this._triggerReaction(m);
        m.reactAt = this._rand(10, 22);
      }
    }

    // Свободные частицы
    for (let i = this.freeParticles.length - 1; i >= 0; i--) {
      const p = this.freeParticles[i];
      p.life -= dt;

      if (p.kind === 'cl-in') {
        // Хлор летит к молекуле-цели — медленно и плавно
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 9 * dt;
        p.vy += (dy / d) * 9 * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        if (d < 34) {
          p.target.chlorines.push({ ...p.slot });
          this.freeParticles.splice(i, 1);
          continue;
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;
      }

      if (p.life <= 0 || p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) {
        this.freeParticles.splice(i, 1);
      }
    }
  }

  /** Реакция: выбиваем водород и подлетаем хлором на его место. */
  _triggerReaction(m) {
    if (!m.hydrogens.length) {
      // всё замещено — «омолаживаем» молекулу, возвращая водороды
      m.hydrogens = m.template.hydrogens.map((p) => ({ ...p }));
      m.chlorines = [];
      return;
    }

    const idx = Math.floor(Math.random() * m.hydrogens.length);
    const hpos = m.hydrogens[idx];
    const world = this._localToWorld(m, hpos.x * BOND_LEN * m.scale, hpos.y * BOND_LEN * m.scale);

    // Отлетающий водород — медленный дрейф в сторону
    const dir = Math.atan2(world.y - m.y, world.x - m.x);
    this.freeParticles.push({
      kind: 'h-out',
      el: 'H',
      x: world.x,
      y: world.y,
      vx: Math.cos(dir) * this._rand(10, 24),
      vy: Math.sin(dir) * this._rand(10, 24),
      life: this._rand(3, 5),
      color: COLORS.hydrogen,
    });

    // Убираем водород с молекулы
    m.hydrogens.splice(idx, 1);

    // Хлор летит из-за края экрана к освободившемуся месту
    const from = this._randomEdgePoint();
    this.freeParticles.push({
      kind: 'cl-in',
      el: 'Cl',
      x: from.x,
      y: from.y,
      vx: 0,
      vy: 0,
      life: 8,
      target: m,
      slot: { x: hpos.x, y: hpos.y },
      color: COLORS.chlorine,
    });
  }

  _randomEdgePoint() {
    switch (Math.floor(Math.random() * 4)) {
      case 0: return { x: -40, y: Math.random() * this.h };
      case 1: return { x: this.w + 40, y: Math.random() * this.h };
      case 2: return { x: Math.random() * this.w, y: -40 };
      default: return { x: Math.random() * this.w, y: this.h + 40 };
    }
  }

  _localToWorld(m, lx, ly) {
    const cos = Math.cos(m.angle);
    const sin = Math.sin(m.angle);
    return {
      x: m.x + lx * cos - ly * sin,
      y: m.y + lx * sin + ly * cos,
    };
  }

  _draw() {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    for (const m of this.molecules) {
      ctx.save();
      ctx.globalAlpha = 0.32;

      const anchor = m.template.atoms[0];

      // Связи C–C
      for (let i = 1; i < m.template.atoms.length; i++) {
        const a = this._localToWorld(
          m, m.template.atoms[i - 1].x * BOND_LEN * m.scale, m.template.atoms[i - 1].y * BOND_LEN * m.scale,
        );
        const b = this._localToWorld(
          m, m.template.atoms[i].x * BOND_LEN * m.scale, m.template.atoms[i].y * BOND_LEN * m.scale,
        );
        this._bond(a, b);
      }

      // Связи к водородам
      const fromC = this._localToWorld(m, anchor.x * BOND_LEN * m.scale, anchor.y * BOND_LEN * m.scale);
      for (const h of m.hydrogens) {
        const to = this._localToWorld(m, h.x * BOND_LEN * m.scale, h.y * BOND_LEN * m.scale);
        this._bond(fromC, to);
      }
      // Связи к хлорам
      for (const cl of m.chlorines) {
        const to = this._localToWorld(m, cl.x * BOND_LEN * m.scale, cl.y * BOND_LEN * m.scale);
        this._bond(fromC, to);
      }

      // Атомы углерода
      for (const a of m.template.atoms) {
        const p = this._localToWorld(m, a.x * BOND_LEN * m.scale, a.y * BOND_LEN * m.scale);
        this._atom(p.x, p.y, 7 * m.scale, COLORS.carbon, null);
      }
      // Атомы водорода
      for (const h of m.hydrogens) {
        const p = this._localToWorld(m, h.x * BOND_LEN * m.scale, h.y * BOND_LEN * m.scale);
        this._atom(p.x, p.y, 4 * m.scale, COLORS.hydrogen, COLORS.glow);
      }
      // Атомы хлора
      for (const cl of m.chlorines) {
        const p = this._localToWorld(m, cl.x * BOND_LEN * m.scale, cl.y * BOND_LEN * m.scale);
        this._atom(p.x, p.y, 6 * m.scale, COLORS.chlorine, COLORS.chlorineGlow);
      }

      ctx.restore();
    }

    // Свободные частицы — без свечения, тихие
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (const p of this.freeParticles) {
      const size = p.el === 'Cl' ? 5 : 3.5;
      this._atom(p.x, p.y, size, p.color, null);
    }
    ctx.restore();
  }

  _bond(a, b) {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.bond;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  _atom(x, y, r, color, glow) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 6;
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
    this.molecules = [];
    this.freeParticles = [];
  }
}
