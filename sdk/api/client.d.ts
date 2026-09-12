/// <reference path="environment.d.ts" />

/**
 * Управление интерфейсом и инвентарями игрового HUD.
 * Нужен активный графический мир и HUD. В headless API отсутствует. Источники: libhud.cpp и scripting_hud.cpp. Типы не добавляют проверок при исполнении.
 */
declare namespace hud {
  /** Открывает инвентарь локального игрока. */
  function open_inventory(this: void): void;
  /** Закрывает экран инвентаря. */
  function close_inventory(this: void): void;
  /**
   * Открывает layout с необязательным инвентарём и возвращает его ID.
   * Второй аргумент скрывает инвентарь игрока; у show_overlay он управляет показом.
   */
  function open(this: void, layout: string, hidePlayerInventory?: boolean, inventory?: number): number;
  /** Открывает интерфейс блока и возвращает ID инвентаря и имя layout отдельными значениями Lua. */
  function open_block(this: void, x: number, y: number, z: number, hidePlayerInventory?: boolean): LuaMultiReturn<[inventory: number, layout: string]>;
  /** Открывает постоянный layout игрового HUD. */
  function open_permanent(this: void, layout: string): void;
  /** Показывает layout поверх HUD и передаёт args; showPlayerInventory управляет видимостью инвентаря игрока. */
  function show_overlay(this: void, layout: string, showPlayerInventory?: boolean, args?: VC.Value): void;
  /** Возвращает ID инвентаря блока, открытого в HUD. */
  function get_block_inventory(this: void): number;
  /** Возвращает ID второго открытого инвентаря. */
  function get_second_inventory(this: void): number;
  /** Возвращает ID обменного инвентаря HUD. */
  function get_exchange_inventory(this: void): number;
  /** Закрывает интерфейс по имени layout. */
  function close(this: void, layout: string): void;
  /** Ставит игру на паузу через HUD. */
  function pause(this: void): void;
  /** Снимает паузу игры. */
  function resume(this: void): void;
  /** Проверяет, поставлена ли игра на паузу. */
  function is_paused(this: void): boolean;
  /** Проверяет, открыт ли экран инвентаря. */
  function is_inventory_open(this: void): boolean;
  /** Проверяет, виден ли инвентарь игрока. */
  function is_player_inventory_open(this: void): boolean;
  /** Возвращает ID игрока текущего HUD. */
  function get_player(this: void): number;
  /** Разрешает или запрещает паузу через HUD. */
  function set_allow_pause(this: void, allow: boolean): void;
  /** Перезагружает скрипт HUD указанного пака. */
  function reload_script(this: void, packid: string): void;
  /** Проверяет, открыт ли layout с указанным именем. */
  function is_open(this: void, layout: string): boolean;
}
/**
 * Поиск паков, их ресурсов и каталогов данных.
 * Нужен графический диалог подтверждения. Источник: libpack.cpp.
 */
declare namespace pack {
  /** Запрашивает разрешение на запись в пак и передаёт точку входа обработчику. */
  function request_writeable(this: void, packid: string, callback: (this: void, entryPoint: string) => void): void;
}

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Обработчики открытия, отрисовки и закрытия игрового HUD. */
  interface HudCallbacks {
    /** Зарегистрированный обработчик инициализации; вызов и аргументы не подтверждены аудитом движка. */
    init?(this:void,...args:unknown[]):void;
    /** Вызывается при открытии HUD для игрока с указанным ID. */
    on_hud_open?(this:void,player:number):void;
    /** Вызывается при отрисовке игрового HUD. */
    on_hud_render?(this:void):void;
    /** Вызывается при закрытии HUD игрока. */
    on_hud_close?(this:void,player:number):void;
    /** Сообщает о действии action в слоте инвентаря и режиме mode. */
    on_inventory_interact?(this:void,inventory:number,slot:number,action:number,mode:number):void;
  }
}

/** Команды консоли, переменные и вывод сообщений. */
declare namespace console {
  /** Выводит значения в игровую консоль. */
  function log(this:void,...values:(string|number)[]):void;
  /** Выводит значения в игровой чат. */
  function chat(this:void,...values:(string|number)[]):void;
}
