/// <reference path="types.d.ts" />

/** Source: libtime.cpp and internal/lifetime_events.lua. */
declare namespace time {
  function uptime(this: void): number;
  function delta(this: void): number;
  function utc_time(this: void): number;
  function precise_utc_time(this: void): number;
  function utc_offset(this: void): number;
  function local_time(this: void): number;
  function precise_time(this: void): number;
  function post_runnable(this: void, callback: (this: void) => void): void;
}

/** Source: internal/events.lua. Dynamic event names do not prove payload types.
 * Callbacks receive no implicit self. Use typed application contracts above this layer.
 */
declare namespace events {
  function on<F extends (this: void, ...args: never[]) => unknown>(this: void, event: string, handler: F): F;
  function reset(this: void, event: string, handler?: (this: void, ...args: never[]) => unknown): void;
  function remove(this: void, event: string, handler: (this: void, ...args: never[]) => unknown): void;
  function remove_by_prefix(this: void, prefix: string): void;
  function emit(this: void, event: string, ...args: unknown[]): unknown;
}

/** Source: internal/rules.lua. Rule values are dynamic and must be narrowed by the caller. */
declare namespace rules {
  function get(this: void, name: string): unknown;
  function set(this: void, name: string, value: VC.Value): void;
  function reset(this: void, name: string): void;
  function listen(this: void, name: string, handler: (this: void, value: unknown) => void): number;
  function create(this: void, name: string, value: VC.Value, handler?: (this: void, value: unknown) => void): number | undefined;
  function unlisten(this: void, name: string, id: number): void;
  function clear(this: void): void;
}

/** Source: internal/extensions/inventory.lua. Local data can override captions with arbitrary values. */
declare namespace inventory {
  function get_uses(this: void, id: number, slot: number): unknown;
  function use(this: void, id: number, slot: number): void;
  function decrement(this: void, id: number, slot: number, count?: number): void;
  function get_caption(this: void, id: number, slot: number): unknown;
  function set_caption(this: void, id: number, slot: number, caption?: string): void;
  function get_description(this: void, id: number, slot: number): unknown;
  function set_description(this: void, id: number, slot: number, description?: string): void;
}

/** Source: internal/session.lua. Arbitrary in-memory values; not saved with the world. */
declare namespace session {
  function get(this: void, name: string): Record<string, unknown>;
  function has(this: void, name: string): boolean;
  function reset(this: void, name: string): void;
}

declare namespace VC {
  interface ScriptContext {readonly packId:string;readonly environment:Record<string,unknown>;}
  interface WorldCallbacks {
    /** Registered hook; invocation payload was not found in the audited sources. */
    init?(this:void,...args:unknown[]):void;
    on_world_open?(this:void,isNew:boolean):void;
    on_world_tick?(this:void):void;
    on_world_save?(this:void):void;
    on_world_quit?(this:void):void;
  }
  interface ContentCallbacks {
    on_scripts_loading?(this:void):void;
    on_content_loaded?(this:void):void;
  }
}

declare namespace VC {
  interface WorldCallbacks {
    on_block_placed?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    on_block_breaking?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    on_block_broken?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    on_block_replaced?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    /** World handler return is ignored; cancellation comes from the block's on_interact. */
    on_block_interact?(this:void,block:number,x:number,y:number,z:number,player:number):void;
    on_player_tick?(this:void,player:number,ticksPerSecond:number):void;
    on_chunk_present?(this:void,x:number,z:number,loaded:boolean):void;
    on_chunk_remove?(this:void,x:number,z:number):void;
    on_inventory_open?(this:void,inventory:number,player:number):void;
    on_inventory_closed?(this:void,inventory:number,player:number):void;
    on_entity_spawn?(this:void,uid:number):void;
    on_entity_despawn?(this:void,uid:number):void;
  }
  interface BlockCallbacks {
    init?(this:void,...args:unknown[]):void;
    on_update?(this:void,x:number,y:number,z:number):void;
    on_random_update?(this:void,x:number,y:number,z:number):void;
    on_breaking?(this:void,x:number,y:number,z:number,player:number):void;
    on_broken?(this:void,x:number,y:number,z:number,player:number):void;
    on_placed?(this:void,x:number,y:number,z:number,player:number):void;
    on_replaced?(this:void,x:number,y:number,z:number,player:number):void;
    on_interact?(this:void,x:number,y:number,z:number,player:number):boolean|void;
    on_block_tick?(this:void,x:number,y:number,z:number,ticksPerSecond:number):void;
    on_blocks_tick?(this:void,ticksPerSecond:number):void;
    on_block_present?(this:void,x:number,y:number,z:number):void;
    on_block_removed?(this:void,x:number,y:number,z:number):void;
  }
  interface ItemCallbacks {
    init?(this:void,...args:unknown[]):void;
    on_use?(this:void,player:number):boolean|void;
    on_use_on_block?(this:void,x:number,y:number,z:number,player:number,normal:Vec3):boolean|void;
    on_block_break_by?(this:void,x:number,y:number,z:number,player:number):boolean|void;
  }
}
