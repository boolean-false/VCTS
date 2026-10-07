/// <reference path="types.d.ts" />

declare namespace VC {
  interface SettingInfo { def: boolean | number | string; min?: number; max?: number; }
  interface PackInfo {
    id: string; title: string; creator: string; description: string; version: string;
    path: string; icon?: string; dependencies?: string[]; has_indices: boolean;
  }
}
/** Source: stdmin.lua aliases to libapp.cpp. Available without app-script privileges. */
declare namespace vc {
  function is_headless(this: void): boolean;
  function is_client(this: void): boolean;
  function get_version(this: void): LuaMultiReturn<[major: number, minor: number]>;
  function get_setting(this: void, name: string): boolean | number | string;
  function str_setting(this: void, name: string): string;
  function get_setting_info(this: void, name: string): VC.SettingInfo;
  function get_project_arg(this: void, name: string): string | undefined;
}
/** Source: libpack.cpp and internal/extensions/pack.lua. */
declare namespace pack {
  function get_folder(this: void, id: string): string;
  function get_installed(this: void): string[];
  function get_available(this: void): string[];
  /** Missing packs may throw in the pack manager before the native nil branch. */
  function get_info(this: void, id: string): VC.PackInfo | undefined;
  function get_info(this: void, ids: string[]): Record<string, VC.PackInfo | undefined>;
  function get_base_packs(this: void): string[];
  function assemble(this: void, ids: string[]): string[];
  function is_installed(this: void, id: string): boolean;
  /** Requires an open world; creates the pack's data directory. */
  function data_file(this: void, id: string, name: string): string;
  function shared_file(this: void, id: string, name: string): string;
}
