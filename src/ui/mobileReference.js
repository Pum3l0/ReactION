const viewers = new WeakMap();
const TABLES = {
  mendeleev: { title: 'Менделеева', alt: 'Таблица Менделеева', file: 'mendeleevtab.webp' },
  solubility: { title: 'Растворимость', alt: 'Таблица растворимости', file: 'rastvortable.webp' },
};
export function isMobileReference() {
  return window.matchMedia('(max-width: 1024px) and (pointer: coarse)').matches;
}
export function closeMobileReference(host) { viewers.get(host)?.close(); }

export function openMobileReference(host, type = 'mendeleev') {
  if (!isMobileReference() || !TABLES[type]) return null;
  if (viewers.has(host)) { viewers.get(host).select(type); return viewers.get(host); }
  const previousFocus = document.activeElement;
  const el = document.createElement('section');
  el.className = 'mobile-reference';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Справочные таблицы');
  el.innerHTML = `<header class="mobile-reference-head"><nav aria-label="Выбор таблицы">${Object.entries(TABLES).map(([id,t]) => `<button class="btn btn--tonal" data-table="${id}" aria-pressed="false">${t.title}</button>`).join('')}</nav><button class="btn btn--ghost" data-close-reference aria-label="Закрыть таблицы">✕</button></header><div class="mobile-reference-tools"><button class="btn btn--tonal" data-zoom="out" aria-label="Уменьшить">−</button><button class="btn btn--tonal" data-zoom="fit">Вписать</button><button class="btn btn--tonal" data-zoom="in" aria-label="Увеличить">+</button><output aria-live="polite"></output><span>Раздвинь пальцы для увеличения</span></div><div class="mobile-reference-viewport" tabindex="0" aria-label="Таблица: перемещение пальцем"><div class="mobile-reference-sheet"><img draggable="false" alt=""></div></div><p class="mobile-reference-error" hidden>Не удалось загрузить таблицу. <button class="btn btn--tonal" data-retry>Повторить</button></p>`;
  host.appendChild(el);
  const viewport = el.querySelector('.mobile-reference-viewport');
  const sheet = el.querySelector('.mobile-reference-sheet');
  const img = el.querySelector('img');
  const output = el.querySelector('output');
  const error = el.querySelector('.mobile-reference-error');
  let active, zoom = 1, loaded = false, closed = false;
  const pointers = new Map();
  function dimensions() {
    const base = Math.min(viewport.clientWidth / img.naturalWidth, viewport.clientHeight / img.naturalHeight, 1);
    return { width: img.naturalWidth * base, height: img.naturalHeight * base };
  }
  function render() {
    if (!loaded || closed) return;
    const size = dimensions();
    img.style.width = `${size.width * zoom}px`;
    img.style.height = `${size.height * zoom}px`;
    sheet.style.width = `${Math.max(viewport.clientWidth, size.width * zoom)}px`;
    sheet.style.height = `${Math.max(viewport.clientHeight, size.height * zoom)}px`;
    output.textContent = `${Math.round(zoom * 100)}%`;
  }
  function setZoom(value, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    const oldWidth = img.getBoundingClientRect().width;
    const oldHeight = img.getBoundingClientRect().height;
    const px = (viewport.scrollLeft + x - Math.max(0, (viewport.clientWidth - oldWidth) / 2)) / oldWidth;
    const py = (viewport.scrollTop + y - Math.max(0, (viewport.clientHeight - oldHeight) / 2)) / oldHeight;
    zoom = Math.min(8, Math.max(1, value));
    render();
    viewport.scrollLeft = px * img.getBoundingClientRect().width - x;
    viewport.scrollTop = py * img.getBoundingClientRect().height - y;
  }
  function select(id) {
    if (active === id) return;
    active = id; loaded = false; zoom = 1; pointers.clear();
    error.hidden = true; img.hidden = true;
    viewport.scrollTo(0, 0);
    el.querySelectorAll('[data-table]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.table === id)));
    img.alt = TABLES[id].alt;
    img.src = '/textures/props/' + TABLES[id].file;
  }
  img.onload = () => { if (closed) return; loaded = true; img.hidden = false; render(); };
  img.onerror = () => { loaded = false; error.hidden = false; };
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') {
      const buttons = [...el.querySelectorAll('button, [tabindex="0"]')].filter(e=>e.getClientRects().length);
      const next = buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length];
      event.preventDefault(); next?.focus();
    }
  }
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('resize', render);
    window.visualViewport?.removeEventListener('resize', render);
    document.removeEventListener('keydown', onKey, true);
    el.remove(); viewers.delete(host);
    if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
  }
  el.addEventListener('click', e => {
    e.stopPropagation();
    const table = e.target.closest('[data-table]');
    const button = e.target.closest('[data-zoom]');
    if (table) select(table.dataset.table);
    if (button && loaded) setZoom(button.dataset.zoom === 'fit' ? 1 : zoom * (button.dataset.zoom === 'in' ? 1.5 : 1 / 1.5));
    if (e.target.closest('[data-close-reference]')) close();
    if (e.target.closest('[data-retry]')) { const id=active; active=null; select(id); }
  });
  el.addEventListener('pointerdown', e=>e.stopPropagation());
  viewport.addEventListener('pointerdown', e => {
    if (!loaded) return;
    pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const before = [...pointers.values()];
    const previous = pointers.get(e.pointerId);
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if (pointers.size === 2) {
      const after = [...pointers.values()];
      const distance = points => Math.hypot(points[0].x-points[1].x, points[0].y-points[1].y);
      const rect=viewport.getBoundingClientRect();
      const oldDistance=distance(before);
      if (oldDistance > 0) setZoom(zoom * distance(after)/oldDistance, (after[0].x+after[1].x)/2-rect.left, (after[0].y+after[1].y)/2-rect.top);
    } else {
      viewport.scrollLeft -= e.clientX-previous.x;
      viewport.scrollTop -= e.clientY-previous.y;
    }
  });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) viewport.addEventListener(name,e=>pointers.delete(e.pointerId));
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', render);
  window.visualViewport?.addEventListener('resize', render);
  const record = { el, select, close };
  viewers.set(host, record);
  select(type);
  el.querySelector('[data-close-reference]').focus({preventScroll:true});
  return record;
}
