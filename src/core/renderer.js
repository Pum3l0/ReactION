import * as THREE from 'three';

/**
 * Ядро рендеринга.
 *
 * Держит один WebGL-рендерер, сцену и камеру на весь сеанс игры.
 * Экраны (меню, локации) не создают свои рендереры — они подменяют
 * содержимое сцены через SceneManager.
 *
 * Параллакс здесь реализован сдвигом камеры: мышь мягко двигает
 * камеру, и объекты на разной глубине смещаются по-разному — это и
 * даёт эффект 2.5D диорамы без слоёв-картинок.
 */

const CAMERA_FOV = 42;
const PARALLAX_STRENGTH = 0.9; // насколько далеко уезжает камера
const PARALLAX_EASE = 0.06;    // инерция (меньше — плавнее)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120d08);
    // Туман добавляет глубину и "прячет" дальние края диорамы
    this.scene.fog = new THREE.Fog(0x120d08, 12, 34);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.set(0, 3.2, 9);
    this.camera.lookAt(0, 1.4, 0);

    // Целевая и текущая позиция камеры для параллакса
    this._camBase = this.camera.position.clone();
    // Куда смотрит камера при параллаксе. Экран лаборатории меняет эту
    // точку, иначе после перезахода камера «улетала» под стол, глядя
    // в жёстко зашитую точку (0, 1.4, 0) чужой сцены.
    this._lookTarget = new THREE.Vector3(0, 1.4, 0);
    this._pointer = { x: 0, y: 0 };
    this._pointerTarget = { x: 0, y: 0 };
    // Когда включён false — камерой управляет активный экран (например, атом)
    this._parallaxEnabled = true;

    this._clock = new THREE.Clock();
    this._updaters = new Set();

    this._onResize = this._onResize.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove);

    this._onResize();
    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
  }

  /** Плавно перевести камеру в новую базовую позицию (при смене экрана). */
  setCameraPose({ position, lookAt, duration = 0.9 }) {
    if (position) {
      this._camBase.copy(position);
      this.camera.position.copy(position);
    }
    if (lookAt) {
      this._lookTarget.set(lookAt.x, lookAt.y, lookAt.z);
      this.camera.lookAt(this._lookTarget);
    }
    // Резких переходов пока нет — позже тут будет GSAP-твин.
    void duration;
  }

  /** Регистрирует функцию, вызываемую каждый кадр: fn(dt, elapsed). */
  onUpdate(fn) {
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  /**
   * Включить/выключить автоматический параллакс камерой.
   * Экранам вроде 3D-атома камера нужна целиком — там параллакс выключается.
   */
  setParallax(enabled) {
    this._parallaxEnabled = enabled;
    if (enabled) this._camBase.copy(this.camera.position);
  }

  /**
   * Задать точку, куда смотрит камера при параллаксе.
   * Нужно экранам со своей сценой (лаборатория), чтобы камера не
   * «улетала» в чужую точку при возврате на экран.
   */
  setLookTarget(x, y, z) {
    this._lookTarget.set(x, y, z);
    this._camBase.copy(this.camera.position);
    this.camera.lookAt(this._lookTarget);
  }

  _onPointerMove(event) {
    // Нормализуем в диапазон [-1, 1]
    this._pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
    this._pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _loop() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const elapsed = this._clock.elapsedTime;

    if (this._parallaxEnabled) {
      // Инерция параллакса
      this._pointer.x += (this._pointerTarget.x - this._pointer.x) * PARALLAX_EASE;
      this._pointer.y += (this._pointerTarget.y - this._pointer.y) * PARALLAX_EASE;

      this.camera.position.x = this._camBase.x + this._pointer.x * PARALLAX_STRENGTH;
      this.camera.position.y = this._camBase.y - this._pointer.y * PARALLAX_STRENGTH * 0.6;
      this.camera.lookAt(this._lookTarget);
    }

    for (const fn of this._updaters) fn(dt, elapsed);

    this.renderer.render(this.scene, this.camera);
  }
}
