/**
 * Локации — рабочие места химика.
 *
 * Каждая локация это смена: панорама рабочего места, диалог коллеги и
 * задача-накладная. Сейчас полностью реализован склад; остальные —
 * заготовки под ту же механику.
 */
export const LOCATIONS = [
  {
    id: 'warehouse',
    title: 'Склад реактивов',
    subtitle: 'Первая смена. Петрович и кофе.',
    // Панорама рабочего места (вид от первого лица)
    scene: '/textures/warehouse_table.webp',
    // Миниатюра/предисловие для карты
    preview: '/textures/warehouse_table.webp',
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
    id: 'lab',
    title: 'Химическая лаборатория',
    subtitle: 'Синтез и анализ. Скоро.',
    scene: null,
    preview: null,
    npc: null,
    unlocked: false,
  },
  {
    id: 'archive',
    title: 'Архив соединений',
    subtitle: 'Хранилище формул. Скоро.',
    scene: null,
    preview: null,
    npc: null,
    unlocked: false,
  },
];

export function getLocation(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}
