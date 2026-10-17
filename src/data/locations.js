/**
 * Конфигурация локаций (мест работы учёного).
 *
 * Поля:
 *  id         — ключ, совпадает с именем экрана/сцены
 *  title      — название на карте
 *  subtitle   — короткое описание для карты
 *  palette    — тёплые оттенки конкретной локации (для 3D-плейсхолдеров)
 *  unlocked   — доступна ли с самого начала
 *  tasks      — список задач (см. data/tasks.js по id)
 *
 * Сейчас это плейсхолдеры. Позже сюда добавим:
 *  texture   — путь к сгенерированной диораме (/textures/warehouse.webp)
 *  props     — отдельные объекты для подсветки светом
 */
export const LOCATIONS = [
  {
    id: 'warehouse',
    title: 'Склад реактивов',
    subtitle: 'Первая смена. Петрович и кофе.',
    palette: {
      floor: 0x3a2a18,
      walls: 0x2b1d11,
      accent: 0xffb44d,
    },
    unlocked: true,
    tasks: ['warehouse-01'],
  },
  {
    id: 'lab',
    title: 'Химическая лаборатория',
    subtitle: 'Синтез, анализ, вытяжной шкаф.',
    palette: {
      floor: 0x33302a,
      walls: 0x24211c,
      accent: 0x7ee787,
    },
    unlocked: false,
    tasks: [],
  },
  {
    id: 'archive',
    title: 'Архив соединений',
    subtitle: 'Хранилище формул и старых отчётов.',
    palette: {
      floor: 0x2e2419,
      walls: 0x221a11,
      accent: 0x6fc3ff,
    },
    unlocked: false,
    tasks: [],
  },
];

export function getLocation(id) {
  return LOCATIONS.find((loc) => loc.id === id);
}
