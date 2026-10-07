/// <reference path="types.d.ts" />

// Конструктор и методы из res/modules/internal/bytearray.lua.
declare function Bytearray(this: void, source?: number | string | number[]): VC.Bytearray;
declare namespace Bytearray {
    function append(this: void, target: VC.Bytearray, source: number | number[] | VC.Bytearray): void;
}
declare function Bytearray_as_string(this: void, source: VC.Bytearray | number[]): string;
