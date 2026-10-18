/**
 * Локации — рабочие места химика.
 *
 * Каждая локация — смена: свой экран, своя механика и кейс.
 *  screen     — какой экран открывать ('level' | 'orbital')
 *  preview    — превью-картинка для карточки на карте
 *  preview3d  — если true, в карточке вместо картинки мини-3D-атом
 */
export const LOCATIONS = [
  {
    id: 'warehouse',
    title: 'Склад реактивов',
    subtitle: 'Накладная, кофе и порядок',
    screen: 'level',
    // Панорама рабочего места (вид от первого лица)
    scene: '/textures/warehouse_table.webp',
    preview: '/textures/warehouse_table.webp',
    // В превью показываем Петровича поверх фона
    previewNpc: '/textures/props/petrovich_head.png',
    npc: {
      name: 'Петрович',
      portrait: '/textures/props/petrovich_head.png',
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
    id: 'archive',
    title: 'Архив соединений',
    subtitle: 'Хранилище формул. Скоро',
    screen: null,
    scene: null,
    preview: null,
    npc: null,
    unlocked: false,
  },
];

export function getLocation(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}
