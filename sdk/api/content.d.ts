/// <reference path="types.d.ts" />

/**
 * Определения блоков и операции с блоками мира.
 * Контент должен быть загружен; операции с координатами требуют открытого мира. Источник: src/logic/scripting/lua/libs/libblock.cpp. Неверный индекс определения может вернуть undefined. Координаты и индексы передаются по правилам VC без автоматического сдвига.
 */
declare namespace block {
  /** Возвращает числовой ID определения блока по имени. */
  function index(this: void, name: string): number;
  /** Возвращает полное имя определения блока по ID. */
  function name(this: void, id: number): string | undefined;
  /** Возвращает имя материала блока. */
  function material(this: void, id: number): string | undefined;
  /** Возвращает отображаемое название блока. */
  function caption(this: void, id: number): string | undefined;
  /** Возвращает число загруженных определений блоков. */
  function defs_count(this: void): number;
  /** Проверяет твёрдость блока в указанных координатах мира. */
  function is_solid_at(this: void, x: number, y: number, z: number): boolean;
  /** Проверяет, можно ли заменить блок в указанных координатах. */
  function is_replaceable_at(this: void, x: number, y: number, z: number): boolean;
  /**
   * Возвращает ID блока в указанных координатах мира.
   * Для незагруженной ячейки возвращает -1.
   */
  function get(this: void, x: number, y: number, z: number): number;
  /**
   * Заменяет блок и его упакованное состояние напрямую; noupdate отключает обновление.
   * Не вызывает on_placed. Возвращаемое движком значение здесь намеренно отбрасывается.
   */
  function set(this: void, x: number, y: number, z: number, id: number, states?: number, noupdate?: boolean): void;
  /** Ставит блок с обработкой события размещения; playerid указывает инициатора. */
  function place(this: void, x: number, y: number, z: number, id: number, states?: number, playerid?: number): void;
  /** Разрушает блок с обработкой событий; playerid указывает инициатора. */
  function destruct(this: void, x: number, y: number, z: number, playerid?: number): void;
  /** Возвращает локальную ось X повёрнутого блока отдельными координатами Lua. */
  function get_X(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает локальную ось X повёрнутого блока отдельными координатами Lua. */
  function get_X(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает локальную ось Y повёрнутого блока отдельными координатами Lua. */
  function get_Y(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает локальную ось Y повёрнутого блока отдельными координатами Lua. */
  function get_Y(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает локальную ось Z повёрнутого блока отдельными координатами Lua. */
  function get_Z(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает локальную ось Z повёрнутого блока отдельными координатами Lua. */
  function get_Z(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает упакованное состояние блока. */
  function get_states(this: void, x: number, y: number, z: number): number;
  /** Задаёт упакованное состояние блока. */
  function set_states(this: void, x: number, y: number, z: number, state: number): void;
  /** Возвращает индекс поворота блока. */
  function get_rotation(this: void, x: number, y: number, z: number): number;
  /** Изменяет индекс поворота блока. */
  function set_rotation(this: void, x: number, y: number, z: number, rotation: number): void;
  /** Читает bits пользовательских битов состояния, начиная с offset. */
  function get_user_bits(this: void, x: number, y: number, z: number, offset: number, bits: number): number;
  /** Записывает value в bits пользовательских битов, начиная с offset. */
  function set_user_bits(this: void, x: number, y: number, z: number, offset: number, bits: number, value: number): void;
  /** Возвращает индекс варианта блока. */
  function get_variant(this: void, x: number, y: number, z: number): number;
  /** Задаёт индекс варианта блока. */
  function set_variant(this: void, x: number, y: number, z: number, variant: number): void;
  /** Проверяет, занимает ли определение блока несколько ячеек. */
  function is_extended(this: void, id: number): boolean | undefined;
  /** Возвращает размеры определения блока отдельными координатами Lua. */
  function get_size(this: void, id: number): VC.MaybeXYZ;
  /** Проверяет, является ли ячейка сегментом многоблочного объекта. */
  function is_segment(this: void, x: number, y: number, z: number): boolean;
  /** Возвращает координаты исходной ячейки многоблочного объекта. */
  function seek_origin(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  /** Возвращает имя модели определения блока и его варианта. */
  function model_name(this: void, id: number, variant?: number): string | undefined;
  /** Возвращает шесть текстур граней блока для указанного варианта. */
  function get_textures(this: void, id: number, variant?: number): [string,string,string,string,string,string] | undefined;
  /** Возвращает имя типа модели блока для указанного варианта. */
  function get_model(this: void, id: number, variant?: number): string | undefined;
  /** Возвращает две границы выбранного хитбокса с учётом поворота. */
  function get_hitbox(this: void, id: number, rotation: number, hitbox?: number): [VC.Vec3, VC.Vec3] | undefined;
  /** Возвращает имя профиля вращения блока. */
  function get_rotation_profile(this: void, id: number): string | undefined;
  /** Возвращает ID предмета, получаемого при выборе блока. */
  function get_picking_item(this: void, id: number): number | undefined;
  /**
   * Ищет блок вдоль луча до distance; без попадания возвращает undefined, dest принимает результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function raycast(this: void, start: VC.Vec3, dir: VC.Vec3, distance: number, dest?: Partial<VC.BlockRayHit>, filter?: string[], includeNonSelectable?: boolean): VC.BlockRayHit | undefined;
  /**
   * Упаковывает поворот, сегмент и пользовательские биты в число.
   * Движок читает массив компонентов; объект с именованными полями не подходит.
   */
  function compose_state(this: void, state: VC.BlockState): number;
  /**
   * Разбирает упакованное состояние на поворот, сегмент и пользовательские биты.
   * Возвращает одну Lua-таблицу из трёх компонентов.
   */
  function decompose_state(this: void, state: number): VC.BlockState;
  /** Читает поле пользовательских данных блока; index выбирает элемент поля. */
  function get_field(this: void, x: number, y: number, z: number, name: string, index?: number): number | string | undefined;
  /**
   * Записывает поле пользовательских данных блока; index выбирает элемент поля.
   * Для символьных полей может вернуть число закодированных символов.
   */
  function set_field(this: void, x: number, y: number, z: number, name: string, value: number | string | boolean, index?: number): number | undefined;
  /** Перезагружает скрипт определения блока по имени. */
  function reload_script(this: void, name: string): void;
  /** Проверяет наличие тега у определения блока. */
  function has_tag(this: void, id: number, tag: string): boolean | undefined;
}

/**
 * Определения предметов и их свойства.
 * Нужен загруженный контент. Источник: src/logic/scripting/lua/libs/libitem.cpp.
 */
declare namespace item {
  /** Возвращает числовой ID определения предмета по имени. */
  function index(this: void, name: string): number;
  /** Возвращает полное имя определения предмета по ID. */
  function name(this: void, id: number): string | undefined;
  /** Возвращает отображаемое название предмета. */
  function caption(this: void, id: number): string | undefined;
  /** Возвращает описание предмета. */
  function description(this: void, id: number): string | undefined;
  /** Возвращает максимальное количество предметов в одном слоте. */
  function stack_size(this: void, id: number): number | undefined;
  /** Возвращает число загруженных определений предметов. */
  function defs_count(this: void): number;
  /** Возвращает имя значка предмета. */
  function icon(this: void, id: number): string | undefined;
  /** Возвращает ID блока, который ставится этим предметом. */
  function placing_block(this: void, id: number): number | undefined;
  /** Возвращает имя модели предмета. */
  function model_name(this: void, id: number): string | undefined;
  /**
   * Возвращает четыре числовых компонента свечения предмета.
   * Движок возвращает таблицу из четырёх числовых компонентов.
   */
  function emission(this: void, id: number): VC.Vec4 | undefined;
  /** Возвращает число использований, заданное определением предмета. */
  function uses(this: void, id: number): number | undefined;
  /** Перезагружает скрипт определения предмета по имени. */
  function reload_script(this: void, name: string): void;
  /** Проверяет наличие тега у определения предмета. */
  function has_tag(this: void, id: number, tag: string): boolean | undefined;
}
