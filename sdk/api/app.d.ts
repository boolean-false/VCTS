/// <reference path="environment.d.ts" />

/**
 * Управление приложением из скрипта запуска --script.
 * Доступно только скрипту запуска --script. Источники: libapp.cpp и complete_app_lib в stdlib.lua. Ожидающие операции выполняются в корутине этого скрипта.
 */
declare namespace app {
  /** Путь выполняемого скрипта запуска. */
  const script: string;
  /** Передаёт управление приложению до следующего тика. */
  function tick(this: void): void;
  /** Приостанавливает корутину скрипта на указанное число секунд. */
  function sleep(this: void, seconds: number): void;
  /**
   * Ждёт выполнения predicate с ограничением числа тиков и времени timeout.
   * timeout измеряется через os.clock() в текущей реализации Lua.
   */
  function sleep_until(this: void, predicate: (this: void) => boolean, maxTicks?: number, timeout?: number): void;
  /** Завершает приложение; silent управляет тихим выходом. */
  function quit(this: void, silent?: boolean): void;
  /** Проверяет, загружен ли игровой контент. */
  function is_content_loaded(this: void): boolean;
  /** Загружает настроенные паки контента. */
  function load_content(this: void): void;
  /** Сбрасывает загруженный контент, сохраняя указанные паки. */
  function reset_content(this: void, nonResetPacks?: string[]): void;
  /** Добавляет и удаляет паки в конфигурации контента. */
  function reconfig_packs(this: void, add: string[], remove: string[]): void;
  /** Задаёт полный список паков контента. */
  function config_packs(this: void, packs: string[]): void;
  /** Возвращает список настроенных паков контента. */
  function get_content(this: void): string[];
  /** Возвращает каталоги поиска контента. */
  function get_content_sources(this: void): string[];
  /** Задаёт каталоги поиска контента. */
  function set_content_sources(this: void, sources: string[]): void;
  /** Восстанавливает стандартные каталоги поиска контента. */
  function reset_content_sources(this: void): void;
  /** Возвращает значение настройки по имени. */
  function get_setting(this: void, name: string): boolean | number | string;
  /** Изменяет значение настройки приложения. */
  function set_setting(this: void, name: string, value: boolean | number | string): void;
  /** Возвращает строковое представление настройки. */
  function str_setting(this: void, name: string): string;
  /** Возвращает значение по умолчанию и границы настройки. */
  function get_setting_info(this: void, name: string): VC.SettingInfo;
  /** Создаёт мир с именем, seed и генератором; localPlayer задаёт локального игрока. */
  function new_world(this: void, name: string, seed: string, generator: string, localPlayer?: number): void;
  /** Открывает сохранённый мир по имени. */
  function open_world(this: void, name: string): void;
  /** Заново открывает текущий мир. */
  function reopen_world(this: void): void;
  /** Сохраняет текущий мир. */
  function save_world(this: void): void;
  /** Закрывает текущий мир; save управляет сохранением. */
  function close_world(this: void, save?: boolean): void;
  /** Удаляет сохранённый мир по имени. */
  function delete_world(this: void, name: string): void;
  /** Возвращает основной и дополнительный номера версии движка отдельными значениями Lua. */
  function get_version(this: void): LuaMultiReturn<[major: number, minor: number]>;
  /** Создаёт именованное виртуальное файловое устройство в памяти. */
  function create_memory_device(this: void, name: string): void;
  /**
   * Запускает экземпляр движка для отладки и возвращает его дескриптор.
   * Нужно разрешение debugging проекта; для автоматического выбора порта также network.
   */
  function start_debug_instance(this: void, port?: number, projectPath?: string, outputPath?: string): number;
  /**
   * Запускает фоновый экземпляр с указанным скриптом и возвращает дескриптор.
   * Нужно разрешение sub-instances проекта.
   */
  function start_background_instance(this: void, script: string, output?: string, projectArgs?: Record<string,string>): number;
  /** Проверяет, работает ли экземпляр с данным дескриптором. */
  function is_instance_alive(this: void, handle: number): boolean;
  /** Завершает экземпляр по дескриптору и сообщает результат. */
  function terminate_instance(this: void, handle: number): boolean;
}
