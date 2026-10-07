/// <reference path="environment.d.ts" />

/** Application script only (--script); not injected into ordinary pack module environments.
 * Sources: libapp.cpp + complete_app_lib in stdlib.lua.
 * Operations that yield must run in the application script coroutine.
 */
declare namespace app {
  const script: string;
  function tick(this: void): void;
  function sleep(this: void, seconds: number): void;
  /** timeout uses os.clock() in the current Lua implementation. */
  function sleep_until(this: void, predicate: (this: void) => boolean, maxTicks?: number, timeout?: number): void;
  function quit(this: void, silent?: boolean): void;
  function is_content_loaded(this: void): boolean;
  function load_content(this: void): void;
  function reset_content(this: void, nonResetPacks?: string[]): void;
  function reconfig_packs(this: void, add: string[], remove: string[]): void;
  function config_packs(this: void, packs: string[]): void;
  function get_content(this: void): string[];
  function get_content_sources(this: void): string[];
  function set_content_sources(this: void, sources: string[]): void;
  function reset_content_sources(this: void): void;
  function get_setting(this: void, name: string): boolean | number | string;
  function set_setting(this: void, name: string, value: boolean | number | string): void;
  function str_setting(this: void, name: string): string;
  function get_setting_info(this: void, name: string): VC.SettingInfo;
  function new_world(this: void, name: string, seed: string, generator: string, localPlayer?: number): void;
  function open_world(this: void, name: string): void;
  function reopen_world(this: void): void;
  function save_world(this: void): void;
  function close_world(this: void, save?: boolean): void;
  function delete_world(this: void, name: string): void;
  function get_version(this: void): LuaMultiReturn<[major: number, minor: number]>;
  function create_memory_device(this: void, name: string): void;
  /** Requires project debugging permissions (and network permission for automatic port selection). */
  function start_debug_instance(this: void, port?: number, projectPath?: string, outputPath?: string): number;
  /** Requires project sub-instances permission. */
  function start_background_instance(this: void, script: string, output?: string, projectArgs?: Record<string,string>): number;
  function is_instance_alive(this: void, handle: number): boolean;
  function terminate_instance(this: void, handle: number): boolean;
}
