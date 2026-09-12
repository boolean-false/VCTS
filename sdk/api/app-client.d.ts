/// <reference path="app.d.ts" />
/**
 * Управление приложением из скрипта запуска --script.
 * Доступно только графическим скриптам запуска. Источник: libapp.cpp.
 */
declare namespace app {
  /** Переводит фокус на окно приложения. */
  function focus(this: void): void;
  /** Изменяет заголовок окна приложения. */
  function set_title(this: void, title: string): void;
  /** Открывает каталог в системном файловом менеджере. */
  function open_folder(this: void, path: string): void;
  /** Открывает URL в системном браузере. */
  function open_url(this: void, url: string): void;
}
