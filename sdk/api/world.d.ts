/// <reference path="types.d.ts" />

/**
 * Состояние мира, время суток, чанки и пересечение лучей.
 * Доступно в состояниях BASE/SCRIPT. Большинство вызовов требует открытого мира. Источник: src/logic/scripting/lua/libs/libworld.cpp.
 */
declare namespace world {
  /** Проверяет, открыт ли мир. */
  function is_open(this: void): boolean;
  /** Возвращает сведения о сохранённых мирах. */
  function get_list(this: void): VC.WorldInfo[];
  /** Возвращает накопленное время мира в секундах. */
  function get_total_time(this: void): number;
  /** Возвращает время суток от 0 до 1: 0 соответствует полуночи, 0.5 полудню. */
  function get_day_time(this: void): number;
  /** Задаёт время суток как долю суточного цикла. */
  function set_day_time(this: void, time: number): void;
  /** Задаёт скорость смены времени суток. */
  function set_day_time_speed(this: void, speed: number): void;
  /** Возвращает скорость смены времени суток. */
  function get_day_time_speed(this: void): number;
  /** Возвращает числовой seed текущего мира. */
  function get_seed(this: void): number;
  /** Возвращает идентификатор генератора текущего мира. */
  function get_generator(this: void): string;
  /** Проверяет, считается ли текущее время дневным. */
  function is_day(this: void): boolean;
  /** Проверяет, считается ли текущее время ночным. */
  function is_night(this: void): boolean;
  /** Проверяет наличие сохранённого мира по имени. */
  function exists(this: void, name: string): boolean;
  /** Возвращает сжатые данные чанка по координатам x, z или undefined; для незагруженного чанка читает сохранение. */
  function get_chunk_data(this: void, x: number, z: number): VC.Bytearray | undefined;
  /** Применяет сжатые данные к чанку; true означает, что чанк существует. */
  function set_chunk_data(this: void, x: number, z: number, data: VC.Bytearray): boolean;
  /** Записывает бинарные данные чанка в хранилище мира. */
  function save_chunk_data(this: void, x: number, z: number, data: VC.Bytearray): void;
  /** Возвращает число загруженных чанков или undefined без мира. */
  function count_chunks(this: void): number | undefined;
  /** Перезагружает скрипт мира указанного пака. */
  function reload_script(this: void, packid: string): void;
}

/**
 * Создание игроков, их положение и игровые режимы.
 * Нужен открытый мир. Неверный или удалённый ID может дать undefined. ID игрока обязателен и в клиентском коде для совместимости с headless. Источник: libplayer.cpp.
 */
declare const player: {
  /** Создаёт игрока с именем и возвращает ID; requestedId запрашивает конкретный ID. */
  create(this: void, name: string, requestedId?: number): number;
  /** Удаляет игрока по ID. */
  delete(this: void, id: number): void;
  /** Возвращает положение игрока отдельными координатами Lua. */
  get_pos(this: void, id: number): VC.MaybeXYZ;
  /** Перемещает игрока в указанные координаты мира. */
  set_pos(this: void, id: number, x: number, y: number, z: number): void;
  /** Возвращает скорость игрока отдельными координатами Lua. */
  get_vel(this: void, id: number): VC.MaybeXYZ;
  /** Задаёт скорость игрока по трём осям. */
  set_vel(this: void, id: number, x: number, y: number, z: number): void;
  /** Возвращает углы поворота игрока; interpolated запрашивает интерполированное значение. */
  get_rot(this: void, id: number, interpolated?: boolean): VC.MaybeXYZ;
  /** Задаёт углы поворота игрока. */
  set_rot(this: void, id: number, x: number, y: number, z?: number): void;
  /** Возвращает вектор направления взгляда игрока. */
  get_dir(this: void, id: number): VC.Vec3 | undefined;
  /** Возвращает ID инвентаря и индекс выбранного слота отдельными значениями Lua. */
  get_inventory(this: void, id: number): LuaMultiReturn<[number?, number?]>;
  /** Проверяет, приостановлен ли игрок. */
  is_suspended(this: void, id: number): boolean | undefined;
  /** Приостанавливает или возобновляет игрока; при приостановке его сущность удаляется из мира. */
  set_suspended(this: void, id: number, suspended: boolean): void;
  /** Проверяет, включён ли режим полёта. */
  is_flight(this: void, id: number): boolean | undefined;
  /** Включает или выключает полёт игрока. */
  set_flight(this: void, id: number, value: boolean): void;
  /** Проверяет, разрешено ли прохождение сквозь блоки. */
  is_noclip(this: void, id: number): boolean | undefined;
  /** Включает или выключает прохождение сквозь блоки. */
  set_noclip(this: void, id: number, value: boolean): void;
  /** Проверяет, включён ли режим бесконечных предметов. */
  is_infinite_items(this: void, id: number): boolean | undefined;
  /** Включает или выключает бесконечные предметы. */
  set_infinite_items(this: void, id: number, value: boolean): void;
  /** Проверяет, включено ли мгновенное разрушение блоков. */
  is_instant_destruction(this: void, id: number): boolean | undefined;
  /** Включает или выключает мгновенное разрушение блоков. */
  set_instant_destruction(this: void, id: number, value: boolean): void;
  /** Проверяет, загружает ли игрок чанки вокруг себя. */
  is_loading_chunks(this: void, id: number): boolean | undefined;
  /** Включает или выключает загрузку чанков вокруг игрока. */
  set_loading_chunks(this: void, id: number, value: boolean): void;
  /** Возвращает предельную дальность взаимодействия игрока. */
  get_interaction_distance(this: void, id: number): number | undefined;
  /** Задаёт предельную дальность взаимодействия игрока. */
  set_interaction_distance(this: void, id: number, distance: number): void;
  /** Выбирает слот панели предметов; индекс начинается с 0. */
  set_selected_slot(this: void, id: number, slot: number): void;
  /** Возвращает координаты блока, на который наведён игрок. */
  get_selected_block(this: void, id: number): VC.MaybeXYZ;
  /** Возвращает UID сущности, на которую наведён игрок. */
  get_selected_entity(this: void, id: number): number | undefined;
  /** Возвращает координаты точки появления игрока. */
  get_spawnpoint(this: void, id: number): VC.MaybeXYZ;
  /** Задаёт точку появления игрока. */
  set_spawnpoint(this: void, id: number, x: number, y: number, z: number): void;
  /** Возвращает UID сущности, связанной с игроком. */
  get_entity(this: void, id: number): number | undefined;
  /**
   * Привязывает игрока к сущности по числовому UID.
   * Поддерживается числовой UID сущности; форма с объектом сущности не объявлена.
   */
  set_entity(this: void, id: number, entity: number): void;
  /** Возвращает ID активной камеры игрока. */
  get_camera(this: void, id: number): number | undefined;
  /** Выбирает активную камеру игрока по ID. */
  set_camera(this: void, id: number, camera: number): void;
  /** Возвращает имя игрока. */
  get_name(this: void, id: number): string | undefined;
  /** Изменяет имя игрока. */
  set_name(this: void, id: number, name: string): void;
  /** Возвращает ID игроков в сфере с заданным центром и радиусом. */
  get_all_in_radius(this: void, center: VC.Vec3, radius: number): number[];
  /** Возвращает ID всех игроков. */
  get_all(this: void): number[];
  /** Возвращает ID ближайшего к position игрока или undefined. */
  get_nearest(this: void, position: VC.Vec3): number | undefined;
}

/**
 * Предметы, слоты и данные инвентарей мира.
 * Нужен открытый мир. Индексы слотов начинаются с 0. Динамические данные предметов требуют проверки. Источник: libinventory.cpp.
 */
declare namespace inventory {
  /** Возвращает ID предмета и количество в слоте отдельными значениями Lua. */
  function get(this: void, id: number, slot: number): LuaMultiReturn<[item: number, count: number]>;
  /** Задаёт предмет, количество и дополнительные данные слота. */
  function set(this: void, id: number, slot: number, item: number, count: number, data?: VC.ObjectValue): void;
  /** Изменяет количество предметов в слоте. */
  function set_count(this: void, id: number, slot: number, count: number): void;
  /** Возвращает число слотов инвентаря. */
  function size(this: void, id: number): number;
  /** Добавляет предметы в инвентарь и возвращает не поместившийся остаток. */
  function add(this: void, id: number, item: number, count: number, data?: VC.ObjectValue): number;
  /** Перемещает содержимое слота в другой инвентарь; targetSlot задаёт целевой слот. */
  function move(this: void, from: number, slot: number, to: number, targetSlot?: number): void;
  /** Перемещает содержимое слота в диапазон слотов другого инвентаря. */
  function move_range(this: void, from: number, slot: number, to: number, begin?: number, end?: number): void;
  /** Ищет слот с заданным предметом и минимальным количеством; без результата возвращает undefined. */
  function find_by_item(this: void, id: number, item: number, begin?: number, end?: number, minimumCount?: number): number | undefined;
  /** Возвращает ID инвентаря блока или 0, если блок не может иметь инвентарь. */
  function get_block(this: void, x: number, y: number, z: number): number;
  /** Привязывает инвентарь к блоку мира. */
  function bind_block(this: void, id: number, x: number, y: number, z: number): void;
  /** Удаляет привязку инвентаря к блоку. */
  function unbind_block(this: void, x: number, y: number, z: number): void;
  /** Читает именованное поле данных предмета в слоте; значение требует проверки типа. */
  function get_data(this: void, id: number, slot: number, name: string): unknown;
  /** Записывает именованное поле данных предмета в слоте. */
  function set_data(this: void, id: number, slot: number, name: string, value: VC.Value): void;
  /** Возвращает все дополнительные данные предмета в слоте или undefined. */
  function get_all_data(this: void, id: number, slot: number): VC.ObjectValue | undefined;
  /** Записывает дополнительные данные слота; clear управляет удалением старых полей. */
  function set_all_data(this: void, id: number, slot: number, data: VC.ObjectValue, clear?: boolean): void;
  /** Проверяет наличие данных слота или конкретного поля name. */
  function has_data(this: void, id: number, slot: number, name?: string): boolean;
  /** Создаёт инвентарь указанного размера и возвращает его ID. */
  function create(this: void, size: number): number;
  /** Удаляет инвентарь по ID. */
  function remove(this: void, id: number): void;
  /** Копирует инвентарь и возвращает ID копии или 0 при отсутствии исходного инвентаря. */
  function clone(this: void, id: number): number;
}
