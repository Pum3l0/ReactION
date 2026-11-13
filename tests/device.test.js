import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDevice, getOrientation, initDeviceWatcher } from '../src/core/device.js';

test('phone remains usable through rotation and keyboard viewport changes', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const viewport = new EventTarget();
  viewport.height = 844;
  const win = new EventTarget();
  Object.assign(win, { innerWidth: 390, innerHeight: 844, ontouchstart: null, visualViewport: viewport });
  let height;
  globalThis.window = win;
  globalThis.document = { documentElement: { style: { setProperty: (_name, value) => { height = value; } } } };
  let watcher;
  try {
    watcher = initDeviceWatcher();
    assert.equal(detectDevice(), 'phone');
    assert.equal(getOrientation(), 'portrait');
    assert.equal(watcher.info().needsRotate, false);
    assert.equal(height, '844px');
    Object.assign(win, { innerWidth: 844, innerHeight: 390 });
    viewport.height = 390;
    win.dispatchEvent(new Event('resize'));
    assert.equal(getOrientation(), 'landscape');
    assert.equal(detectDevice(), 'phone');
    assert.equal(height, '390px');
    viewport.height = 210;
    viewport.dispatchEvent(new Event('resize'));
    assert.equal(height, '210px');
    watcher.destroy();
    viewport.height = 390;
    viewport.dispatchEvent(new Event('resize'));
    assert.equal(height, '210px', 'destroy removes viewport listeners');
  } finally {
    watcher?.destroy();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
