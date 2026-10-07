/**
 * Загружает модуль при вызове обработчика, после инициализации вызывающего модуля.
 * Сборщик проверяет буквальный ID и права импорта. В Lua остаётся штатный require.
 * @vctsDeferred
 */
declare function vcts_load<T>(this: void, id: string): T;
