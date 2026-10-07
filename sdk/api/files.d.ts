/// <reference path="types.d.ts" />

/** Source: libfile.cpp and internal/extensions/file.lua.
 * Paths use VC entry-point:path syntax. Write operations respect VC permissions.
 */
declare namespace file {
  function exists(this: void, path: string): boolean;
  function find(this: void, path: string): string | undefined;
  function isdir(this: void, path: string): boolean;
  function isfile(this: void, path: string): boolean;
  /** Missing file returns -1 in the current C++ implementation. */
  function length(this: void, path: string): number;
  function list(this: void, path: string): string[];
  function list_all_res(this: void, path: string): string[];
  function mkdir(this: void, path: string): boolean;
  function mkdirs(this: void, path: string): boolean;
  function read(this: void, path: string): string;
  function read_bytes(this: void, path: string, useTable: true): number[];
  function read_bytes(this: void, path: string, useTable?: false): VC.Bytearray;
  function read_bytes(this: void, path: string, useTable: boolean): number[] | VC.Bytearray;
  /** The native return is not a reliable success flag; use exceptions/read-back. */
  function write(this: void, path: string, text: string): void;
  function write_bytes(this: void, path: string, data: VC.Bytearray | number[]): boolean;
  function remove(this: void, path: string): boolean;
  function remove_tree(this: void, path: string): number;
  function resolve(this: void, path: string): string;
  function read_combined_list(this: void, path: string): VC.Value[];
  function read_combined_object(this: void, path: string): VC.ObjectValue;
  function is_writeable(this: void, path: string): boolean;
  function mount(this: void, path: string): string;
  function unmount(this: void, entryPoint: string): void;
  function create_memory_device(this: void): string;
  function create_zip(this: void, directory: string, output: string): void;
  function name(this: void, path: string): string | undefined;
  function stem(this: void, path: string): string;
  function ext(this: void, path: string): string | undefined;
  function prefix(this: void, path: string): string | undefined;
  function parent(this: void, path: string): string;
  function remove_ext(this: void, path: string): string;
  function path(this: void, path: string): string;
  function join(this: void, directory: string, path: string): string;
  function readlines(this: void, path: string): string[];
}

/** Sources: libjson.cpp, libtoml.cpp, libyaml.cpp. Parse does not validate a TS schema. */
declare namespace json {
  function parse(this: void, text: string): unknown;
  function tostring(this: void, value: VC.Value, pretty?: boolean, escapeUTF?: boolean): string;
}
declare namespace toml {
  function parse(this: void, text: string): unknown;
  function tostring(this: void, value: VC.ObjectValue): string;
}
declare namespace yaml {
  function parse(this: void, text: string): unknown;
  function tostring(this: void, value: VC.Value): string;
}
/** Source: libbase64.cpp. Default decode returns FFI Bytearray, not a table. */
declare namespace base64 {
  function encode(this: void, bytes: VC.Bytearray | number[]): string;
  function decode(this: void, text: string, useTable: true): number[];
  function decode(this: void, text: string, useTable?: false): VC.Bytearray;
  function decode(this: void, text: string, useTable: boolean): VC.Bytearray | number[];
  function encode_urlsafe(this: void, bytes: VC.Bytearray | number[]): string;
  function decode_urlsafe(this: void, text: string, useTable: true): number[];
  function decode_urlsafe(this: void, text: string, useTable?: false): VC.Bytearray;
  function decode_urlsafe(this: void, text: string, useTable: boolean): VC.Bytearray | number[];
}
