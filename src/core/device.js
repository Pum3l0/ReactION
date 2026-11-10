/**
 * Определение устройства и ориентации экрана.
 *
 * Задача:
 *  - понять, что за устройство (телефон / планшет / десктоп);
 *  - на телефоне в вертикальной ориентации показать экран
 *    «поверни горизонтально» (в портрете лаборатория не помещается);
 *  - сообщать игре о смене ориентации, чтобы 3D-сцены пересчитали камеру.
 *
 * Никакого UA-снаффинга «на глазок»: ориентируемся на размеры экрана и
 * наличие touch, это надёжнее и не ломается на новых устройствах.
 */

export const DEVICE = {
  PHONE: 'phone',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
};

/** Точка прерывания: уже этого — считаем телефоном. */
const PHONE_MAX = 600;
/** Выше этого (в короткой стороне) — уже не телефон, а планшет/десктоп. */
const TABLET_MAX = 1024;

/**
 * Определить тип устройства по текущим размерам и возможностям ввода.
 * @returns {'phone'|'tablet'|'desktop'}
 */
export function detectDevice() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortSide = Math.min(w, h);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Десктоп: большой экран и нет тач-ввода
  if (shortSide > TABLET_MAX && !hasTouch) return DEVICE.DESKTOP;

  // Телефон: узкая короткая сторона (в любой ориентации)
  if (shortSide <= PHONE_MAX) return DEVICE.PHONE;

  // Всё, что между, с тачем — планшет; без тача — небольшой ноутбук
  if (hasTouch) return DEVICE.TABLET;
  return DEVICE.DESKTOP;
}

/** Текущая ориентация: 'landscape' или 'portrait'. */
export function getOrientation() {
  return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
}

/** Телефон ли это (в любой ориентации). */
export function isPhone() {
  return detectDevice() === DEVICE.PHONE;
}

/**
 * Управляет экраном «поверни телефон».
 *
 * @param {{onChange?: (info: {device, orientation, needsRotate}) => void}} options
 * @returns {{destroy: () => void, info: () => object}}
 */
export function initDeviceWatcher({ onChange } = {}) {
  const hintEl = document.getElementById('rotate-hint');

  let last = '';

  function evaluate() {
    const device = detectDevice();
    const orientation = getOrientation();
    // Повернуть нужно только телефон в портрете
    const needsRotate = device === DEVICE.PHONE && orientation === 'portrait';

    if (hintEl) hintEl.hidden = !needsRotate;

    const info = { device, orientation, needsRotate };
    const key = `${device}|${orientation}`;
    if (key !== last) {
      last = key;
      onChange?.(info);
    }
    return info;
  }

  // resize ловит и смену ориентации, и поворот окна на десктопе.
  // orientationchange нужен как подстраховка для старых мобильных браузеров.
  const handler = () => evaluate();
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);

  evaluate();

  return {
    info: evaluate,
    destroy() {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    },
  };
}
