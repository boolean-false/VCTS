/// <reference path="types.d.ts" />

/** Типы VoxelCore; отдельного объекта VC во время исполнения нет. */
declare namespace VC {
  /** Значение по умолчанию и допустимые границы настройки. */
  interface SettingInfo {
    /** Значение настройки по умолчанию. */
    def: boolean | number | string;
    /** Нижняя граница числовой настройки, если задана. */
    min?: number;
    /** Верхняя граница числовой настройки, если задана. */
    max?: number;
  }
  /** Метаданные и зависимости пака контента. */
  interface PackInfo {
    /** Полный идентификатор пака. */
    id: string;
    /** Отображаемое название пака. */
    title: string;
    /** Автор пака. */
    creator: string;
    /** Краткое описание пака. */
    description: string;
    /** Строка версии пака. */
    version: string;
    /** Путь каталога пака. */
    path: string;
    /** Путь значка пака, если задан. */
    icon?: string;
    /** Идентификаторы зависимостей пака. */
    dependencies?: string[];
    /** Признак наличия сохранённых индексов контента. */
    has_indices: boolean;
  }
}
/**
 * Сведения о движке, настройках и аргументах проекта.
 * Доступно без привилегий скрипта запуска. Источник: псевдонимы stdmin.lua к libapp.cpp.
 */
declare namespace vc {
  /** Проверяет, запущен ли движок без графического интерфейса. */
  function is_headless(this: void): boolean;
  /** Проверяет, доступен ли графический клиент. */
  function is_client(this: void): boolean;
  /** Возвращает основной и дополнительный номера версии движка отдельными значениями Lua. */
  function get_version(this: void): LuaMultiReturn<[major: number, minor: number]>;
  /** Возвращает значение настройки по имени. */
  function get_setting(this: void, name: string): boolean | number | string;
  /** Возвращает строковое представление настройки. */
  function str_setting(this: void, name: string): string;
  /** Возвращает значение по умолчанию и границы настройки. */
  function get_setting_info(this: void, name: string): VC.SettingInfo;
  /** Возвращает строковый аргумент проекта или undefined, если его нет. */
  function get_project_arg(this: void, name: string): string | undefined;
}
/**
 * Поиск паков, их ресурсов и каталогов данных.
 * Источники: libpack.cpp и internal/extensions/pack.lua.
 */
declare namespace pack {
  /** Возвращает путь каталога пака по ID. */
  function get_folder(this: void, id: string): string;
  /** Возвращает ID установленных паков. */
  function get_installed(this: void): string[];
  /** Возвращает ID доступных паков. */
  function get_available(this: void): string[];
  /**
   * Возвращает сведения об одном паке или словарь сведений для списка ID.
   * Для отсутствующего пака менеджер может вызвать ошибку до возврата undefined.
   */
  function get_info(this: void, id: string): VC.PackInfo | undefined;
  /** Возвращает сведения об одном паке или словарь сведений для списка ID. */
  function get_info(this: void, ids: string[]): Record<string, VC.PackInfo | undefined>;
  /** Возвращает список базовых паков проекта. */
  function get_base_packs(this: void): string[];
  /** Собирает список паков с учётом их зависимостей. */
  function assemble(this: void, ids: string[]): string[];
  /** Проверяет, установлен ли пак с указанным ID. */
  function is_installed(this: void, id: string): boolean;
  /**
   * Возвращает путь файла данных пака в текущем мире.
   * Нужен открытый мир; каталог данных пака создаётся при вызове.
   */
  function data_file(this: void, id: string, name: string): string;
  /** Возвращает путь общего файла данных пака. */
  function shared_file(this: void, id: string, name: string): string;
}
