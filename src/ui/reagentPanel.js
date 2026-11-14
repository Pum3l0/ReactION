import { REAGENTS } from '../data/reactions.js';

/**
 * Панель выбора реагентов.
 *
 * Решает проблему «30 веществ в неразбираемой полосе»: это выдвижная
 * панель слева с поиском, категориями и крупными подписями.
 *
 * Категории берём из тегов реагента (acid/base/salt/indicator/metal).
 * Поиск ищет и по формуле, и по названию — можно набирать «медь» или «Cu».
 */

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'acid', label: 'Кислоты' },
  { id: 'base', label: 'Основания' },
  { id: 'salt', label: 'Соли' },
  { id: 'indicator', label: 'Индикаторы' },
  { id: 'metal', label: 'Металлы' },
  { id: 'element', label: 'Простые вещества' },
  { id: 'other', label: 'Другое' },
];

function vialColorVar(color) {
  if (!color) return 'rgba(200, 220, 255, 0.3)';
  return '#' + color.toString(16).padStart(6, '0');
}

/** Определить категорию реагента по тегам. */
function categoryOf(reagent) {
  const tags = reagent.tags ?? [];
  for (const c of ['acid', 'base', 'salt', 'indicator', 'metal', 'element']) {
    if (tags.includes(c)) return c;
  }
  return 'other';
}

/**
 * Поиск с учётом русских словоформ: «медь» находит «сульфат меди».
 * Сравниваем по корню — берём начало каждого слова (≥4 букв) и ищем совпадение.
 */
function fuzzyMatch(query, formula, name) {
  const hay = (formula + ' ' + name).toLowerCase();
  if (hay.includes(query)) return true;
  // По корням слов: «медь»~«меди», «кислота»~«кислоты».
  // Отбрасываем окончание запроса (1–2 буквы), чтобы ловить словоформы.
  const root = query.length >= 6 ? query.slice(0, query.length - 2)
             : query.length >= 4 ? query.slice(0, query.length - 1)
             : query;
  if (root.length < 3) return false;
  const words = hay.split(/[^\wа-яё]+/i).filter(Boolean);
  return words.some((w) => w.startsWith(root));
}

export class ReagentPanel {
  /**
   * @param {HTMLElement} host
   * @param {{reagentIds: string[], onPick: (id: string) => void}} options
   */
  constructor(host, { reagentIds, onPick }) {
    this.host = host;
    this.onPick = onPick;
    this.ids = reagentIds.filter((id) => REAGENTS[id]);
    this.category = 'all';
    this.query = '';
    this.picked = null;
    this.collapsed = false;

    this._render();
  }

  _render() {
    this.host.innerHTML =
      '<button class="lab-panel-toggle" data-toggle title="Показать/скрыть реактивы">' +
        '<span class="lab-panel-toggle-icon">⚗</span>' +
        '<span class="lab-panel-toggle-label">Реактивы</span>' +
      '</button>' +
      '<div class="lab-panel" data-panel>' +
        '<div class="lab-panel-head">' +
          '<input class="lab-panel-search" type="text" placeholder="Поиск: Cu, медь, кислота…" data-search>' +
          '<button class="lab-panel-close" data-toggle aria-label="Свернуть">‹</button>' +
        '</div>' +
        '<div class="lab-panel-cats" data-cats></div>' +
        '<div class="lab-panel-list" data-list></div>' +
      '</div>';

    this.root = this.host.querySelector('[data-panel]');
    this.searchEl = this.host.querySelector('[data-search]');
    this.catsEl = this.host.querySelector('[data-cats]');
    this.listEl = this.host.querySelector('[data-list]');

    this._renderCats();
    this._renderList();

    this._onInput = () => {
      this.query = this.searchEl.value.trim().toLowerCase();
      this._renderList();
    };
    this.searchEl.addEventListener('input', this._onInput);

    this._onClick = (event) => {
      if (event.target.closest('[data-toggle]')) {
        this.toggle();
        return;
      }
      const cat = event.target.closest('[data-cat]');
      if (cat) {
        this.category = cat.dataset.cat;
        this._renderCats();
        this._renderList();
        return;
      }
      const item = event.target.closest('[data-id]');
      if (item) {
        this.onPick?.(item.dataset.id);
      }
    };
    this.host.addEventListener('click', this._onClick);
  }

  _renderCats() {
    this.catsEl.innerHTML = CATEGORIES.map(
      (c) =>
        '<button class="lab-cat' + (c.id === this.category ? ' is-active' : '') +
        '" data-cat="' + c.id + '">' + c.label + '</button>',
    ).join('');
  }

  _filtered() {
    const q = this.query;
    return this.ids.filter((id) => {
      const r = REAGENTS[id];
      if (this.category === 'other' && categoryOf(r) !== 'other') return false;
      if (!['all', 'other'].includes(this.category) && !r.tags.includes(this.category)) return false;
      if (!q) return true;
      return fuzzyMatch(q, r.formula, r.name);
    });
  }

  _renderList() {
    const items = this._filtered();
    if (!items.length) {
      this.listEl.innerHTML = '<p class="lab-panel-empty">Ничего не найдено</p>';
      return;
    }
    this.listEl.innerHTML = items
      .map((id) => {
        const r = REAGENTS[id];
        const on = id === this.picked ? ' is-picked' : '';
        // Разный вид: жидкость — флакон, бумага (лакмус) — полоска, порошок — горка
        const icon = r.form === 'paper'
          ? '<span class="lab-item-paper" style="--paper-color:' + vialColorVar(r.color) + '"></span>'
          : r.state === 'solid'
            ? '<span class="lab-item-powder" style="--powder-color:' + vialColorVar(r.color) + '"></span>'
            : '<span class="lab-item-vial" style="--vial-color:' + vialColorVar(r.color) + '"></span>';
        return (
          '<button class="lab-item' + on + '" data-id="' + id + '">' +
            icon +
            '<span class="lab-item-text">' +
              '<span class="lab-item-formula">' + r.formula + '</span>' +
              '<span class="lab-item-name">' + r.name + '</span>' +
            '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  setPicked(id) {
    this.picked = id;
    this._renderList();
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.host.classList.toggle('is-collapsed', this.collapsed);
  }

  /** Свернуть панель (используется при открытии пикера сосуда на телефоне). */
  collapse() {
    this.collapsed = true;
    this.host.classList.add('is-collapsed');
  }

  destroy() {
    this.host.removeEventListener('click', this._onClick);
    this.searchEl?.removeEventListener('input', this._onInput);
    this.host.remove();
  }
}
