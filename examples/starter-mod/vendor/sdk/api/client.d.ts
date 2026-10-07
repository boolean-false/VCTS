/// <reference path="environment.d.ts" />

/** Requires an active graphical world/HUD. Not present in headless.
 * Source: libhud.cpp + scripting_hud.cpp. No runtime checks are added by these types.
 */
declare namespace hud {
  function open_inventory(this: void): void;
  function close_inventory(this: void): void;
  /** second argument HIDES the player inventory (unlike show_overlay). */
  function open(this: void, layout: string, hidePlayerInventory?: boolean, inventory?: number): number;
  function open_block(this: void, x: number, y: number, z: number, hidePlayerInventory?: boolean): LuaMultiReturn<[inventory: number, layout: string]>;
  function open_permanent(this: void, layout: string): void;
  function show_overlay(this: void, layout: string, showPlayerInventory?: boolean, args?: VC.Value): void;
  function get_block_inventory(this: void): number;
  function get_second_inventory(this: void): number;
  function get_exchange_inventory(this: void): number;
  function close(this: void, layout: string): void;
  function pause(this: void): void;
  function resume(this: void): void;
  function is_paused(this: void): boolean;
  function is_inventory_open(this: void): boolean;
  function is_player_inventory_open(this: void): boolean;
  function get_player(this: void): number;
  function set_allow_pause(this: void, allow: boolean): void;
  function reload_script(this: void, packid: string): void;
  function is_open(this: void, layout: string): boolean;
}
/** Requires graphical confirmation UI. Source: libpack.cpp. */
declare namespace pack {
  function request_writeable(this: void, packid: string, callback: (this: void, entryPoint: string) => void): void;
}

declare namespace VC {
  interface HudCallbacks {
    init?(this:void,...args:unknown[]):void;
    on_hud_open?(this:void,player:number):void;
    on_hud_render?(this:void):void;
    on_hud_close?(this:void,player:number):void;
    on_inventory_interact?(this:void,inventory:number,slot:number,action:number,mode:number):void;
  }
}

declare namespace console {
  function log(this:void,...values:(string|number)[]):void;
  function chat(this:void,...values:(string|number)[]):void;
}
