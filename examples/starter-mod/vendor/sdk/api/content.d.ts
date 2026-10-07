/// <reference path="types.d.ts" />

/** Direct globals. Content must be loaded; position operations require an open world.
 * Source: src/logic/scripting/lua/libs/libblock.cpp. Invalid definition indices may return nil.
 * Coordinate arguments and slot/field indices keep VC semantics (no automatic +1).
 */
declare namespace block {
  function index(this: void, name: string): number;
  function name(this: void, id: number): string | undefined;
  function material(this: void, id: number): string | undefined;
  function caption(this: void, id: number): string | undefined;
  function defs_count(this: void): number;
  function is_solid_at(this: void, x: number, y: number, z: number): boolean;
  function is_replaceable_at(this: void, x: number, y: number, z: number): boolean;
  /** Returns -1 for an unloaded coordinate. */
  function get(this: void, x: number, y: number, z: number): number;
  /** Does not emit on_placed. Return value is intentionally discarded. */
  function set(this: void, x: number, y: number, z: number, id: number, states?: number, noupdate?: boolean): void;
  function place(this: void, x: number, y: number, z: number, id: number, states?: number, playerid?: number): void;
  function destruct(this: void, x: number, y: number, z: number, playerid?: number): void;
  function get_X(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  function get_X(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  function get_Y(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  function get_Y(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  function get_Z(this: void, id: number, rotation: number): LuaMultiReturn<VC.Vec3>;
  function get_Z(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  function get_states(this: void, x: number, y: number, z: number): number;
  function set_states(this: void, x: number, y: number, z: number, state: number): void;
  function get_rotation(this: void, x: number, y: number, z: number): number;
  function set_rotation(this: void, x: number, y: number, z: number, rotation: number): void;
  function get_user_bits(this: void, x: number, y: number, z: number, offset: number, bits: number): number;
  function set_user_bits(this: void, x: number, y: number, z: number, offset: number, bits: number, value: number): void;
  function get_variant(this: void, x: number, y: number, z: number): number;
  function set_variant(this: void, x: number, y: number, z: number, variant: number): void;
  function is_extended(this: void, id: number): boolean | undefined;
  function get_size(this: void, id: number): VC.MaybeXYZ;
  function is_segment(this: void, x: number, y: number, z: number): boolean;
  function seek_origin(this: void, x: number, y: number, z: number): LuaMultiReturn<VC.Vec3>;
  function model_name(this: void, id: number, variant?: number): string | undefined;
  function get_textures(this: void, id: number, variant?: number): [string,string,string,string,string,string] | undefined;
  function get_model(this: void, id: number, variant?: number): string | undefined;
  function get_hitbox(this: void, id: number, rotation: number, hitbox?: number): [VC.Vec3, VC.Vec3] | undefined;
  function get_rotation_profile(this: void, id: number): string | undefined;
  function get_picking_item(this: void, id: number): number | undefined;
  function raycast(this: void, start: VC.Vec3, dir: VC.Vec3, distance: number, dest?: Partial<VC.BlockRayHit>, filter?: string[], includeNonSelectable?: boolean): VC.BlockRayHit | undefined;
  /** C++ reads an ARRAY, despite the named-object example in current docs. */
  function compose_state(this: void, state: VC.BlockState): number;
  /** One Lua table, not three return values. */
  function decompose_state(this: void, state: number): VC.BlockState;
  function get_field(this: void, x: number, y: number, z: number, name: string, index?: number): number | string | undefined;
  /** Character fields can return the number of encoded characters. */
  function set_field(this: void, x: number, y: number, z: number, name: string, value: number | string | boolean, index?: number): number | undefined;
  function reload_script(this: void, name: string): void;
  function has_tag(this: void, id: number, tag: string): boolean | undefined;
}

/** Source: src/logic/scripting/lua/libs/libitem.cpp. Requires loaded content. */
declare namespace item {
  function index(this: void, name: string): number;
  function name(this: void, id: number): string | undefined;
  function caption(this: void, id: number): string | undefined;
  function description(this: void, id: number): string | undefined;
  function stack_size(this: void, id: number): number | undefined;
  function defs_count(this: void): number;
  function icon(this: void, id: number): string | undefined;
  function placing_block(this: void, id: number): number | undefined;
  function model_name(this: void, id: number): string | undefined;
  /** C++ returns four numeric components, not a string as the docs suggest. */
  function emission(this: void, id: number): VC.Vec4 | undefined;
  function uses(this: void, id: number): number | undefined;
  function reload_script(this: void, name: string): void;
  function has_tag(this: void, id: number, tag: string): boolean | undefined;
}
