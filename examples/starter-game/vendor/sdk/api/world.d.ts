/// <reference path="types.d.ts" />

/** BASE/SCRIPT state. Most functions require an open world.
 * Source: src/logic/scripting/lua/libs/libworld.cpp.
 */
declare namespace world {
  function is_open(this: void): boolean;
  function get_list(this: void): VC.WorldInfo[];
  function get_total_time(this: void): number;
  function get_day_time(this: void): number;
  function set_day_time(this: void, time: number): void;
  function set_day_time_speed(this: void, speed: number): void;
  function get_day_time_speed(this: void): number;
  function get_seed(this: void): number;
  function get_generator(this: void): string;
  function is_day(this: void): boolean;
  function is_night(this: void): boolean;
  function exists(this: void, name: string): boolean;
  function get_chunk_data(this: void, x: number, z: number): VC.Bytearray | undefined;
  function set_chunk_data(this: void, x: number, z: number, data: VC.Bytearray): boolean;
  function save_chunk_data(this: void, x: number, z: number, data: VC.Bytearray): void;
  function count_chunks(this: void): number | undefined;
  function reload_script(this: void, packid: string): void;
}

/** Source: libplayer.cpp. Requires a world. Invalid/deleted IDs can return nil.
 * Player ID is required here, including for client code, to work in headless.
 */
declare const player: {
  create(this: void, name: string, requestedId?: number): number;
  delete(this: void, id: number): void;
  get_pos(this: void, id: number): VC.MaybeXYZ;
  set_pos(this: void, id: number, x: number, y: number, z: number): void;
  get_vel(this: void, id: number): VC.MaybeXYZ;
  set_vel(this: void, id: number, x: number, y: number, z: number): void;
  get_rot(this: void, id: number, interpolated?: boolean): VC.MaybeXYZ;
  set_rot(this: void, id: number, x: number, y: number, z?: number): void;
  get_dir(this: void, id: number): VC.Vec3 | undefined;
  get_inventory(this: void, id: number): LuaMultiReturn<[number?, number?]>;
  is_suspended(this: void, id: number): boolean | undefined;
  set_suspended(this: void, id: number, suspended: boolean): void;
  is_flight(this: void, id: number): boolean | undefined;
  set_flight(this: void, id: number, value: boolean): void;
  is_noclip(this: void, id: number): boolean | undefined;
  set_noclip(this: void, id: number, value: boolean): void;
  is_infinite_items(this: void, id: number): boolean | undefined;
  set_infinite_items(this: void, id: number, value: boolean): void;
  is_instant_destruction(this: void, id: number): boolean | undefined;
  set_instant_destruction(this: void, id: number, value: boolean): void;
  is_loading_chunks(this: void, id: number): boolean | undefined;
  set_loading_chunks(this: void, id: number, value: boolean): void;
  get_interaction_distance(this: void, id: number): number | undefined;
  set_interaction_distance(this: void, id: number, distance: number): void;
  set_selected_slot(this: void, id: number, slot: number): void;
  get_selected_block(this: void, id: number): VC.MaybeXYZ;
  get_selected_entity(this: void, id: number): number | undefined;
  get_spawnpoint(this: void, id: number): VC.MaybeXYZ;
  set_spawnpoint(this: void, id: number, x: number, y: number, z: number): void;
  get_entity(this: void, id: number): number | undefined;
  /** Numeric entity IDs are supported; the entity-object overload is not yet modeled. */
  set_entity(this: void, id: number, entity: number): void;
  get_camera(this: void, id: number): number | undefined;
  set_camera(this: void, id: number, camera: number): void;
  get_name(this: void, id: number): string | undefined;
  set_name(this: void, id: number, name: string): void;
  get_all_in_radius(this: void, center: VC.Vec3, radius: number): number[];
  get_all(this: void): number[];
  get_nearest(this: void, position: VC.Vec3): number | undefined;
}

/** Source: libinventory.cpp. Requires an open world. Slot arguments are zero-based.
 * Dynamic item data is explicitly unvalidated at the boundary.
 */
declare namespace inventory {
  function get(this: void, id: number, slot: number): LuaMultiReturn<[item: number, count: number]>;
  function set(this: void, id: number, slot: number, item: number, count: number, data?: VC.ObjectValue): void;
  function set_count(this: void, id: number, slot: number, count: number): void;
  function size(this: void, id: number): number;
  function add(this: void, id: number, item: number, count: number, data?: VC.ObjectValue): number;
  function move(this: void, from: number, slot: number, to: number, targetSlot?: number): void;
  function move_range(this: void, from: number, slot: number, to: number, begin?: number, end?: number): void;
  function find_by_item(this: void, id: number, item: number, begin?: number, end?: number, minimumCount?: number): number | undefined;
  function get_block(this: void, x: number, y: number, z: number): number;
  function bind_block(this: void, id: number, x: number, y: number, z: number): void;
  function unbind_block(this: void, x: number, y: number, z: number): void;
  function get_data(this: void, id: number, slot: number, name: string): unknown;
  function set_data(this: void, id: number, slot: number, name: string, value: VC.Value): void;
  function get_all_data(this: void, id: number, slot: number): VC.ObjectValue | undefined;
  function set_all_data(this: void, id: number, slot: number, data: VC.ObjectValue, clear?: boolean): void;
  function has_data(this: void, id: number, slot: number, name?: string): boolean;
  function create(this: void, size: number): number;
  function remove(this: void, id: number): void;
  function clone(this: void, id: number): number;
}
