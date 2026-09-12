/// <reference path="types.d.ts" />

/**
 * Время приложения, системные часы и отложенные вызовы.
 * Источники: libtime.cpp и internal/lifetime_events.lua.
 */
declare namespace time {
  /** Возвращает время работы приложения в секундах. */
  function uptime(this: void): number;
  /** Возвращает длительность последнего кадра в секундах. */
  function delta(this: void): number;
  /** Возвращает время UTC в целых секундах Unix. */
  function utc_time(this: void): number;
  /** Возвращает время UTC в секундах Unix с дробной частью. */
  function precise_utc_time(this: void): number;
  /** Возвращает смещение местного времени относительно UTC в секундах. */
  function utc_offset(this: void): number;
  /** Возвращает системное время с учётом местного смещения. */
  function local_time(this: void): number;
  /** Возвращает монотонное время в секундах от запуска таймера движка; подходит для измерения интервалов. */
  function precise_time(this: void): number;
  /** Планирует выполнение обработчика в главном цикле приложения. */
  function post_runnable(this: void, callback: (this: void) => void): void;
}

/**
 * Подписка и отправка событий Lua.
 * Источник: internal/events.lua. Имена событий не проверяют типы аргументов. Обработчики вызываются без неявного self; задавайте типизированные контракты в коде игры.
 */
declare namespace events {
  /** Подписывает handler на событие и возвращает тот же обработчик. */
  function on<F extends (this: void, ...args: never[]) => unknown>(this: void, event: string, handler: F): F;
  /** Сбрасывает обработчики события; handler задаёт новую подписку. */
  function reset(this: void, event: string, handler?: (this: void, ...args: never[]) => unknown): void;
  /** Удаляет конкретный обработчик события. */
  function remove(this: void, event: string, handler: (this: void, ...args: never[]) => unknown): void;
  /** Удаляет обработчики событий с указанным префиксом имени. */
  function remove_by_prefix(this: void, prefix: string): void;
  /** Вызывает обработчики события с переданными аргументами и возвращает результат диспетчера. */
  function emit(this: void, event: string, ...args: unknown[]): unknown;
}

/**
 * Игровые правила и подписки на изменение их значений.
 * Источник: internal/rules.lua. Тип значения правила нужно проверить перед использованием.
 */
declare namespace rules {
  /** Возвращает текущее значение правила; тип значения нужно проверить. */
  function get(this: void, name: string): unknown;
  /** Изменяет значение правила и уведомляет подписчиков. */
  function set(this: void, name: string, value: VC.Value): void;
  /** Восстанавливает значение правила по умолчанию. */
  function reset(this: void, name: string): void;
  /** Подписывает обработчик на изменение правила и возвращает ID подписки. */
  function listen(this: void, name: string, handler: (this: void, value: unknown) => void): number;
  /** Создаёт правило со значением по умолчанию и необязательным обработчиком. */
  function create(this: void, name: string, value: VC.Value, handler?: (this: void, value: unknown) => void): number | undefined;
  /** Удаляет подписку на правило по ID. */
  function unlisten(this: void, name: string, id: number): void;
  /** Удаляет все правила. */
  function clear(this: void): void;
}

/**
 * Предметы, слоты и данные инвентарей мира.
 * Источник: internal/extensions/inventory.lua. Данные слота могут переопределять названия произвольными значениями.
 */
declare namespace inventory {
  /** Читает оставшееся число использований предмета из данных слота. */
  function get_uses(this: void, id: number, slot: number): unknown;
  /** Расходует одно использование предмета в слоте; при исчерпании прочности удаляет один предмет. */
  function use(this: void, id: number, slot: number): void;
  /** Уменьшает количество предметов в слоте на count. */
  function decrement(this: void, id: number, slot: number, count?: number): void;
  /** Возвращает название предмета с учётом переопределения в данных слота. */
  function get_caption(this: void, id: number, slot: number): unknown;
  /** Задаёт название предмета в слоте; без caption удаляет переопределение. */
  function set_caption(this: void, id: number, slot: number, caption?: string): void;
  /** Возвращает описание предмета с учётом данных слота. */
  function get_description(this: void, id: number, slot: number): unknown;
  /** Задаёт описание предмета в слоте; без description удаляет переопределение. */
  function set_description(this: void, id: number, slot: number, description?: string): void;
}

/**
 * Именованные таблицы данных текущего сеанса в памяти.
 * Источник: internal/session.lua. Данные хранятся в памяти и не сохраняются вместе с миром.
 */
declare namespace session {
  /** Возвращает или создаёт именованную таблицу данных сеанса. */
  function get(this: void, name: string): Record<string, unknown>;
  /** Проверяет наличие именованной таблицы данных сеанса. */
  function has(this: void, name: string): boolean;
  /** Удаляет именованную таблицу данных сеанса. */
  function reset(this: void, name: string): void;
}

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** ID пака и окружение, переданные фабрике скрипта. */
  interface ScriptContext {
    /** ID пака, которому принадлежит скрипт. */
    readonly packId:string;
    /** Окружение Lua-скрипта с динамическими значениями. */
    readonly environment:Record<string,unknown>;
  }
  /** Обработчики жизненного цикла мира и его игровых событий. */
  interface WorldCallbacks {
    /**
     * Зарегистрированный обработчик инициализации; вызов и аргументы не подтверждены аудитом движка.
     * Обработчик зарегистрирован, но место вызова и аргументы не найдены в проверенных исходниках.
     */
    init?(this:void,...args:unknown[]):void;
    /** Вызывается при открытии мира; isNew отличает новый мир от сохранённого. */
    on_world_open?(this:void,isNew:boolean):void;
    /** Вызывается при логическом обновлении мира без аргументов. */
    on_world_tick?(this:void):void;
    /** Вызывается при сохранении мира. */
    on_world_save?(this:void):void;
    /** Вызывается при выходе из мира. */
    on_world_quit?(this:void):void;
  }
  /** Обработчики загрузки скриптов и контента. */
  interface ContentCallbacks {
    /** Вызывается на этапе загрузки скриптов контента. */
    on_scripts_loading?(this:void):void;
    /** Вызывается после загрузки контента. */
    on_content_loaded?(this:void):void;
  }
}

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Обработчики жизненного цикла мира и его игровых событий. */
  interface WorldCallbacks {
    /** Сообщает об установке блока с ID, координатами и ID игрока. */
    on_block_placed?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /** Сообщает о начале разрушения блока игроком. */
    on_block_breaking?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /** Сообщает о разрушении блока игроком. */
    on_block_broken?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /** Сообщает о замене блока в мире. */
    on_block_replaced?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /**
     * Сообщает о взаимодействии игрока с блоком.
     * Результат обработчика мира игнорируется; отмена задаётся в on_interact самого блока.
     */
    on_block_interact?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /** Вызывается при обновлении игрока; ticksPerSecond задаёт частоту тиков. */
    on_player_tick?(this:void,player:number,ticksPerSecond:number):void;
    /** Сообщает о появлении чанка; loaded указывает, загружен ли он из сохранения. */
    on_chunk_present?(this:void,x:number,z:number,loaded:boolean):void;
    /** Сообщает об удалении чанка из активного мира. */
    on_chunk_remove?(this:void,x:number,z:number):void;
    /** Сообщает об открытии инвентаря игроком. */
    on_inventory_open?(this:void,inventory:number,player:number):void;
    /** Сообщает о закрытии инвентаря игроком. */
    on_inventory_closed?(this:void,inventory:number,player:number):void;
    /** Сообщает о появлении сущности по UID. */
    on_entity_spawn?(this:void,uid:number):void;
    /** Сообщает об удалении сущности по UID. */
    on_entity_despawn?(this:void,uid:number):void;
  }
  /** Обработчики событий конкретного определения блока. */
  interface BlockCallbacks {
    /** Зарегистрированный обработчик инициализации; вызов и аргументы не подтверждены аудитом движка. */
    init?(this:void,...args:unknown[]):void;
    /** Вызывается при обновлении блока в указанных координатах. */
    on_update?(this:void,x:number,y:number,z:number):void;
    /** Вызывается при случайном обновлении блока. */
    on_random_update?(this:void,x:number,y:number,z:number):void;
    /** Вызывается при начале разрушения этого блока игроком. */
    on_breaking?(this:void,x:number,y:number,z:number,player:number):void;
    /** Вызывается после разрушения этого блока игроком. */
    on_broken?(this:void,x:number,y:number,z:number,player:number):void;
    /** Вызывается после установки этого блока игроком. */
    on_placed?(this:void,x:number,y:number,z:number,player:number):void;
    /** Вызывается при замене этого блока. */
    on_replaced?(this:void,x:number,y:number,z:number,player:number):void;
    /** Обрабатывает взаимодействие с блоком; true отменяет стандартное действие. */
    on_interact?(this:void,x:number,y:number,z:number,player:number):boolean|void;
    /** Вызывается на тике блока; ticksPerSecond задаёт частоту тиков. */
    on_block_tick?(this:void,x:number,y:number,z:number,ticksPerSecond:number):void;
    /** Вызывается для определения блока на общем тике; ticksPerSecond задаёт частоту. */
    on_blocks_tick?(this:void,ticksPerSecond:number):void;
    /** Вызывается при появлении этого блока в активном мире. */
    on_block_present?(this:void,x:number,y:number,z:number):void;
    /** Вызывается при удалении этого блока из активного мира. */
    on_block_removed?(this:void,x:number,y:number,z:number):void;
  }
  /** Обработчики использования предмета и взаимодействия с блоками. */
  interface ItemCallbacks {
    /** Зарегистрированный обработчик инициализации; вызов и аргументы не подтверждены аудитом движка. */
    init?(this:void,...args:unknown[]):void;
    /** Обрабатывает использование предмета игроком; true отменяет стандартное действие. */
    on_use?(this:void,player:number):boolean|void;
    /** Обрабатывает применение предмета к блоку; normal задаёт нормаль грани, true отменяет стандартное действие. */
    on_use_on_block?(this:void,x:number,y:number,z:number,player:number,normal:Vec3):boolean|void;
    /** Обрабатывает разрушение блока этим предметом; true отменяет стандартное действие. */
    on_block_break_by?(this:void,x:number,y:number,z:number,player:number):boolean|void;
  }
}
