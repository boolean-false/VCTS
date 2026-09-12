/// <reference path="types.d.ts" />

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Режим физического тела: неподвижный, динамический или управляемый кодом. */
  type BodyType = "static" | "dynamic" | "kinematic";
  /**
   * Расширяемый реестр типов компонентов вашей игры.
   * Дополняйте интерфейс через объединение деклараций типами компонентов своего проекта.
   */
  interface ComponentRegistry {
  }
  /** Положение, размер и вращение сущности. */
  interface Transform {
    /** Возвращает положение сущности в мире. */
    get_pos(this: Transform): Vec3 | undefined;
    /** Задаёт положение сущности в мире. */
    set_pos(this: Transform, value: Vec3): void;
    /** Возвращает масштаб сущности по трём осям. */
    get_size(this: Transform): Vec3 | undefined;
    /** Задаёт масштаб сущности по трём осям. */
    set_size(this: Transform, value: Vec3): void;
    /** Возвращает матрицу вращения сущности. */
    get_rot(this: Transform): Mat4 | undefined;
    /** Задаёт матрицу вращения сущности. */
    set_rot(this: Transform, value: Mat4): void;
  }
  /**
   * Физическое тело сущности и его параметры движения.
   * Методы чтения возвращают undefined после удаления сущности.
   */
  interface Rigidbody {
    /** Проверяет, включена ли физика тела. */
    is_enabled(this: Rigidbody): boolean | undefined;
    /** Включает или выключает физику тела. */
    set_enabled(this: Rigidbody, enabled: boolean): void;
    /** Возвращает линейную скорость тела. */
    get_vel(this: Rigidbody): Vec3 | undefined;
    /** Задаёт линейную скорость тела. */
    set_vel(this: Rigidbody, value: Vec3): void;
    /** Возвращает размеры физического тела. */
    get_size(this: Rigidbody): Vec3 | undefined;
    /** Задаёт размеры физического тела. */
    set_size(this: Rigidbody, value: Vec3): void;
    /** Возвращает коэффициент действия гравитации. */
    get_gravity_scale(this: Rigidbody): number | undefined;
    /** Задаёт коэффициент гравитации числом или по трём осям. */
    set_gravity_scale(this: Rigidbody, scale: number | Vec3): void;
    /** Возвращает коэффициент затухания линейной скорости. */
    get_linear_damping(this: Rigidbody): number | undefined;
    /** Задаёт коэффициент затухания линейной скорости. */
    set_linear_damping(this: Rigidbody, value: number): void;
    /** Проверяет, включено ли вертикальное затухание скорости. */
    is_vdamping(this: Rigidbody): boolean | undefined;
    /** Возвращает коэффициент вертикального затухания скорости. */
    get_vdamping(this: Rigidbody): number | undefined;
    /** Включает или выключает вертикальное затухание либо задаёт его коэффициент. */
    set_vdamping(this: Rigidbody, value: boolean | number): void;
    /** Проверяет, находится ли тело на опоре. */
    is_grounded(this: Rigidbody): boolean | undefined;
    /** Проверяет, находится ли тело в режиме приседания. */
    is_crouching(this: Rigidbody): boolean | undefined;
    /** Включает или выключает приседание. */
    set_crouching(this: Rigidbody, enabled: boolean): void;
    /** Возвращает режим физического тела. */
    get_body_type(this: Rigidbody): BodyType | undefined;
    /** Задаёт статический, динамический или кинематический режим тела. */
    set_body_type(this: Rigidbody, value: BodyType): void;
    /** Возвращает имя физического материала. */
    get_material(this: Rigidbody): string | undefined;
    /** Задаёт физический материал по имени. */
    set_material(this: Rigidbody, value: string): void;
    /** Возвращает массу тела. */
    get_mass(this: Rigidbody): number | undefined;
    /** Задаёт массу тела. */
    set_mass(this: Rigidbody, value: number): void;
    /** Возвращает упругость тела при столкновениях. */
    get_elasticity(this: Rigidbody): number | undefined;
    /** Задаёт упругость тела при столкновениях. */
    set_elasticity(this: Rigidbody, value: number): void;
    /** Возвращает скорость опоры под телом. */
    get_ground_vel(this: Rigidbody): Vec3 | undefined;
    /** Проверяет, доступно ли тело для выбора лучом. */
    is_selectable(this: Rigidbody): boolean | undefined;
    /** Разрешает или запрещает выбор тела лучом. */
    set_selectable(this: Rigidbody, enabled: boolean): void;
  }
  /**
   * Модели, кости, поза и текстуры скелета сущности.
   * В headless чтение возвращает undefined, запись ничего не делает. Индексы костей начинаются с 0.
   */
  interface Skeleton {
    /** Возвращает имя модели кости по её индексу. */
    get_model(this: Skeleton, index: number): string | undefined;
    /** Задаёт или удаляет модель кости по индексу. */
    set_model(this: Skeleton, index: number, name?: string): void;
    /** Читает матрицу кости; при переданном dest записывает её в dest. */
    get_matrix(this: Skeleton, index: number): Mat4 | undefined;
    /**
     * Читает матрицу кости; при переданном dest записывает её в dest.
     * Изменяет dest и ничего не возвращает.
     * @param dest Буфер для результата; если не передан, создаётся новый результат.
     */
    get_matrix(this: Skeleton, index: number, dest: Mat4): void;
    /** Задаёт матрицу кости по индексу. */
    set_matrix(this: Skeleton, index: number, value: Mat4): void;
    /** Восстанавливает исходную позу скелета. */
    reset_pose(this: Skeleton): void;
    /** Возвращает текстуру по ключу скелета. */
    get_texture(this: Skeleton, key: string): string | undefined;
    /** Задаёт текстуру по ключу скелета. */
    set_texture(this: Skeleton, key: string, value: string): void;
    /** Возвращает индекс кости по имени. */
    index(this: Skeleton, name: string): number | undefined;
    /** Проверяет видимость скелета или выбранной кости. */
    is_visible(this: Skeleton, index?: number): boolean | undefined;
    /** Задаёт видимость скелета целиком или выбранной кости. */
    set_visible(this: Skeleton, visible: boolean): void;
    /** Задаёт видимость скелета целиком или выбранной кости. */
    set_visible(this: Skeleton, index: number, visible: boolean): void;
    /** Возвращает цвет скелета или выбранной кости. */
    get_color(this: Skeleton, index?: number): Vec4 | undefined;
    /** Задаёт цвет скелета или выбранной кости. */
    set_color(this: Skeleton, color: Vec3 | Vec4, index?: number): void;
    /** Включает или выключает интерполяцию позы скелета. */
    set_interpolated(this: Skeleton, enabled: boolean): void;
  }
  /**
   * Обёртка сущности с доступом к компонентам, физике и графике.
   * Обёртка не гарантирует существование сущности. После перезагрузки мира получите её заново через entities.get.
   */
  interface Entity {
    /** Положение, масштаб и вращение сущности. */
    readonly transform: Transform;
    /** Физическое тело сущности. */
    readonly rigidbody: Rigidbody;
    /** Графический скелет сущности. */
    readonly skeleton: Skeleton;
    /** Удаляет эту сущность из мира. */
    despawn(this: Entity): void;
    /** Возвращает имя скелета сущности. */
    get_skeleton(this: Entity): string | undefined;
    /** Меняет или удаляет скелет сущности. */
    set_skeleton(this: Entity, name?: string): void;
    /** Возвращает компонент по имени или undefined; известные имена используют ComponentRegistry. */
    get_component<K extends keyof ComponentRegistry>(this: Entity, name: K): ComponentRegistry[K] | undefined;
    /** Возвращает компонент по имени или undefined; известные имена используют ComponentRegistry. */
    get_component(this: Entity, name: string): unknown;
    /** Возвращает обязательный компонент; вызывает ошибку при его отсутствии. */
    require_component<K extends keyof ComponentRegistry>(this: Entity, name: K): ComponentRegistry[K];
    /** Возвращает обязательный компонент; вызывает ошибку при его отсутствии. */
    require_component(this: Entity, name: string): unknown;
    /** Проверяет наличие компонента по имени. */
    has_component(this: Entity, name: string): boolean;
    /** Возвращает уникальный числовой ID сущности. */
    get_uid(this: Entity): number;
    /** Возвращает индекс определения сущности. */
    def_index(this: Entity): number | undefined;
    /**
     * Возвращает имя определения сущности.
     * Нужна существующая сущность; обёртка Lua передаёт индекс определения напрямую.
     */
    def_name(this: Entity): string | undefined;
    /** Возвращает ID связанного с сущностью игрока. */
    get_player(this: Entity): number | undefined;
    /**
     * Включает или выключает указанный компонент.
     * В текущем VC выключенные компоненты также пропускают обработчики сохранения и удаления.
     */
    set_enabled(this: Entity, name: string, enabled: boolean): void;
  }
  /** Обработчики событий компонента сущности. */
  interface ComponentCallbacks {
    /** Вызывается при логическом обновлении компонента; tps задаёт частоту обновлений. */
    on_update?(this: void, tps: number): void;
    /** Вызывается при шаге физики; delta задаёт длительность шага в секундах. */
    on_physics_update?(this: void, delta: number): void;
    /** Вызывается при отрисовке; delta задаёт длительность кадра в секундах. */
    on_render?(this: void, delta: number): void;
    /** Вызывается при сохранении компонента; сохранённые поля задаются окружением компонента. */
    on_save?(this: void): void;
    /** Вызывается при удалении сущности. */
    on_despawn?(this: void): void;
    /** Вызывается при включении компонента. */
    on_enable?(this: void): void;
    /** Вызывается при выключении компонента. */
    on_disable?(this: void): void;
    /** Вызывается при приземлении; force передаёт силу воздействия. */
    on_grounded?(this: void, force: number): void;
    /** Вызывается при потере опоры. */
    on_fall?(this: void): void;
    /** Вызывается при входе сущности uid в сенсор index. */
    on_sensor_enter?(this: void, index: number, uid: number): void;
    /** Вызывается при выходе сущности uid из сенсора index. */
    on_sensor_exit?(this: void, index: number, uid: number): void;
    /** Вызывается, когда игрок наводится на сущность. */
    on_aim_on?(this: void, playerId: number): void;
    /** Вызывается, когда игрок перестаёт наводиться на сущность. */
    on_aim_off?(this: void, playerId: number): void;
    /** Вызывается при атаке; attackerUid и playerId указывают инициаторов. */
    on_attacked?(this: void, attackerUid: number, playerId: number): void;
    /** Вызывается при взаимодействии игрока с сущностью. */
    on_used?(this: void, playerId: number): void;
    /** Вызывается при привязке игрока к сущности. */
    on_player_set?(this: void, playerId: number): void;
  }
  /**
   * Сущность, аргументы и сохранённые данные для фабрики компонента.
   * Контекст передаёт сгенерированная точка входа компонента; динамические данные нужно проверить.
   */
  interface ComponentContext {
    /** Сущность, которой принадлежит компонент. */
    readonly entity: Entity;
    /** Аргументы компонента; значения unknown нужно проверить. */
    readonly args: Readonly<Record<string, unknown>>;
    /** Сохранённые данные компонента. */
    readonly saved: Record<string, Value>;
  }
  /** Фабрика, создающая обработчики компонента из его контекста. */
  type ComponentFactory<T extends ComponentCallbacks = ComponentCallbacks> = (this: void, context: ComponentContext) => T;
  /** Результат пересечения луча с блоком или сущностью. */
  interface EntityRayHit extends BlockRayHit {
    /** UID сущности при попадании в сущность. */
    entity?: number;
  }
  /** Параметры луча и фильтры блоков и сущностей. */
  interface WorldRayOptions {
    /** Начало луча в мировых координатах. */
    start: Vec3;
    /** Направление луча. */
    dir: Vec3;
    /** Максимальная длина луча. */
    distance: number;
    /** Включает проверку пересечений с сущностями. */
    entities?: boolean;
    /** UID сущности, которую луч должен пропустить. */
    ignore_uid?: number;
    /** Включает сущности, недоступные для обычного выбора. */
    nonselect_entities?: boolean;
    /** Имена или ID блоков для фильтрации. */
    filter_blocks?: (string | number)[];
    /** Использует filter_blocks как список исключений. */
    blocks_exclusion?: boolean;
    /** Включает блоки, недоступные для обычного выбора. */
    nonselect_blocks?: boolean;
    // filter_entities/entities_exclusion не объявлены: движок применяет фильтр неверно.
  }
}
/** Создание, поиск и удаление сущностей мира. */
declare namespace entities {
  /** Проверяет существование сущности по UID. */
  function exists(this: void, uid: number): boolean;
  /**
   * Возвращает индекс определения сущности по имени.
   * Для неизвестного имени определения вызывает ошибку.
   */
  function def_index(this: void, name: string): number;
  /** Возвращает имя определения сущности по индексу. */
  function def_name(this: void, index: number): string | undefined;
  /** Возвращает размеры хитбокса определения сущности. */
  function def_hitbox(this: void, index: number): VC.Vec3 | undefined;
  /** Проверяет твёрдость определения сущности. */
  function def_solid(this: void, index: number): boolean | undefined;
  /** Возвращает число загруженных определений сущностей. */
  function defs_count(this: void): number;
  /** Возвращает индекс определения живой сущности по UID. */
  function get_def(this: void, uid: number): number | undefined;
  /**
   * Создаёт сущность в position с аргументами компонентов и возвращает её обёртку.
   * Ключи args задаются ID компонентов с заменой ':' на '__'. Переданные args заменяют значения по умолчанию определения.
   */
  function spawn(this: void, name: string, position: VC.Vec3, args?: VC.ObjectValue): VC.Entity;
  /** Удаляет сущность из мира по UID. */
  function despawn(this: void, uid: number): void;
  /** Возвращает обёртку сущности по UID или undefined. */
  function get(this: void, uid: number): VC.Entity | undefined;
  /**
   * Возвращает словарь сущностей по UID; uids ограничивает выборку.
   * Результат является словарём по UID; ключи могут идти с пропусками.
   */
  function get_all(this: void, uids?: number[]): Record<number, VC.Entity | undefined>;
  /** Возвращает имя скелета сущности. */
  function get_skeleton(this: void, uid: number): string | undefined;
  /** Меняет или удаляет скелет сущности. */
  function set_skeleton(this: void, uid: number, name?: string): void;
  /** Возвращает ID игрока, связанного с сущностью. */
  function get_player(this: void, uid: number): number | undefined;
  /** Возвращает UID сущностей в области с заданными положением и размерами. */
  function get_all_in_box(this: void, position: VC.Vec3, size: VC.Vec3): number[];
  /** Возвращает UID сущностей в сфере заданного радиуса. */
  function get_all_in_radius(this: void, position: VC.Vec3, radius: number): number[];
  /**
   * Ищет пересечение луча с блоком или сущностью, исключая ignoreUid.
   * Устаревшая перегрузка: dest может сохранить поле entity после нового попадания в блок. Используйте свежий результат.
   * @param dest Буфер для результата; если не передан, создаётся новый результат.
   */
  function raycast(this: void, start: VC.Vec3, direction: VC.Vec3, distance: number, ignoreUid: number, dest?: VC.EntityRayHit, filterBlocks?: (string | number)[]): VC.EntityRayHit | undefined;
  /**
   * Перезагружает код компонента для будущих экземпляров.
   * Перезагружает код будущих экземпляров; окружения существующих компонентов сохраняются.
   */
  function reload_component(this: void, name: string): void;
}
/** Состояние мира, время суток, чанки и пересечение лучей. */
declare namespace world {
  /** Ищет пересечение луча с блоком или сущностью согласно параметрам; без попадания возвращает undefined. */
  function raycast(this: void, options: VC.WorldRayOptions): VC.EntityRayHit | undefined;
}
