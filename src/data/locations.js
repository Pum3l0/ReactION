/**
 * Локации — рабочие места химика.
 *
 * Игра делится на два режима:
 *   mode: 'shift' — Смена (история): работа химика на производстве.
 *   mode: 'lab'   — Лаборатория (учёба): тренажёр опытов для школ.
 * Переключатель режимов меняет набор карточек на карте.
 *
 *  screen     — какой экран открывать ('level' | 'orbital' | 'lab')
 *  preview    — превью-картинка для карточки на карте
 *  preview3d  — если true, в карточке вместо картинки мини-3D-атом
 */
export const MODE_LABELS = {
  shift: 'Смена',
  lab: 'Лаборатория',
};

export const LOCATIONS = [
  {
    id: 'warehouse',
    mode: 'shift',
    title: 'Склад реактивов',
    subtitle: 'Накладная, кофе и порядок',
    screen: 'level',
    // Панорама рабочего места (вид от первого лица)
    scene: '/textures/warehouse_table.webp',
    preview: '/textures/warehouse_table.webp',
    // В превью показываем Петровича поверх фона
    previewNpc: '/textures/props/petrovich_head.webp',
    npc: {
      name: 'Петрович',
      portrait: '/textures/props/petrovich_head.webp',
      lines: [
        'О, здорово, смена принята. Слушай, тут такое дело…',
        'Я кофе на накладную пролил. Шесть ячеек — кляксы, хоть плачь.',
        'Ты ж у нас голова. Восстанови, что там было, а? Я в долгу не останусь.',
      ],
    },
    unlocked: true,
  },
  {
    id: 'orbital',
    mode: 'shift',
    title: 'Орбитарий',
    subtitle: 'Паспорт элемента. Строение атома.',
    screen: 'orbital',
    scene: null,
    preview: null,
    // Карточка рисует мини-3D-атом
    preview3d: true,
    npc: null,
    unlocked: true,
  },
  {
    // Архив соединений = лаборатория в режиме «Смена»: задания от мастера
    // (учителя), которые нужно выполнить наглядно, как на реальной работе.
    id: 'archive',
    mode: 'shift',
    title: 'Архив соединений',
    subtitle: 'Лабораторные задания от мастера',
    screen: 'lab-shift',
    scene: null,
    preview: '/textures/locations/archive.svg',
    preview3d: false,
    npc: null,
    unlocked: true,
  },

  // ------------------------------------------------------------------
  // Раздел «Лаборатория» (учёба): чистый полигон для школ
  // ------------------------------------------------------------------
  {
    // Рабочий стол = свободный полигон: все вещества, без заданий.
    id: 'bench',
    mode: 'lab',
    title: 'Рабочий стол',
    subtitle: 'Свободные опыты: смешивай любые реактивы',
    screen: 'lab',
    scene: null,
    preview: '/textures/locations/bench.svg',
    preview3d: false,
    npc: null,
    unlocked: true,
  },
  {
    // Песочница атома: пишешь конфигурацию — игра распознаёт элемент.
    id: 'atom-lab',
    mode: 'lab',
    title: 'Песочница атома',
    subtitle: 'Собери атом: пиши конфигурацию, игра угадает элемент',
    screen: 'atom-lab',
    scene: null,
    preview: '/textures/locations/atom-lab.svg',
    preview3d: false,
    npc: null,
    unlocked: true,
  },
];

export function getLocation(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}

/** Локации выбранного режима. */
export function getLocationsByMode(mode) {
  return LOCATIONS.filter((loc) => loc.mode === mode);
}
