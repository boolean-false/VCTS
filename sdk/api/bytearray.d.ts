/// <reference path="types.d.ts" />

// Конструктор и методы из res/modules/internal/bytearray.lua.
/** Создаёт буфер байтов из размера, строки или массива чисел. */
declare function Bytearray(this: void, source?: number | string | number[]): VC.Bytearray;
/** Создаёт буфер байтов из размера, строки или массива чисел. */
declare namespace Bytearray {
    /** Добавляет байт или последовательность байтов в конец буфера target. */
  function append(this: void, target: VC.Bytearray, source: number | number[] | VC.Bytearray): void;
}
/** Преобразует байты в бинарную строку Lua. */
declare function Bytearray_as_string(this: void, source: VC.Bytearray | number[]): string;
