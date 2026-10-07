/// <reference path="types.d.ts" />

/** Sources: libentity.cpp, lib__{transform,rigidbody,skeleton}.cpp, internal/stdcomp.lua. */
declare namespace VC {
  type BodyType = "static" | "dynamic" | "kinematic";
  /** Extend by declaration merging with project-owned component contracts. */
  interface ComponentRegistry {}
  interface Transform {
    get_pos(this: Transform): Vec3 | undefined;
    set_pos(this: Transform, value: Vec3): void;
    get_size(this: Transform): Vec3 | undefined;
    set_size(this: Transform, value: Vec3): void;
    get_rot(this: Transform): Mat4 | undefined;
    set_rot(this: Transform, value: Mat4): void;
  }
  /** Getters return nil if the entity has already been removed. */
  interface Rigidbody {
    is_enabled(this: Rigidbody): boolean | undefined;
    set_enabled(this: Rigidbody, enabled: boolean): void;
    get_vel(this: Rigidbody): Vec3 | undefined;
    set_vel(this: Rigidbody, value: Vec3): void;
    get_size(this: Rigidbody): Vec3 | undefined;
    set_size(this: Rigidbody, value: Vec3): void;
    get_gravity_scale(this: Rigidbody): number | undefined;
    set_gravity_scale(this: Rigidbody, scale: number | Vec3): void;
    get_linear_damping(this: Rigidbody): number | undefined;
    set_linear_damping(this: Rigidbody, value: number): void;
    is_vdamping(this: Rigidbody): boolean | undefined;
    get_vdamping(this: Rigidbody): number | undefined;
    set_vdamping(this: Rigidbody, value: boolean | number): void;
    is_grounded(this: Rigidbody): boolean | undefined;
    is_crouching(this: Rigidbody): boolean | undefined;
    set_crouching(this: Rigidbody, enabled: boolean): void;
    get_body_type(this: Rigidbody): BodyType | undefined;
    set_body_type(this: Rigidbody, value: BodyType): void;
    get_material(this: Rigidbody): string | undefined;
    set_material(this: Rigidbody, value: string): void;
    get_mass(this: Rigidbody): number | undefined;
    set_mass(this: Rigidbody, value: number): void;
    get_elasticity(this: Rigidbody): number | undefined;
    set_elasticity(this: Rigidbody, value: number): void;
    get_ground_vel(this: Rigidbody): Vec3 | undefined;
    is_selectable(this: Rigidbody): boolean | undefined;
    set_selectable(this: Rigidbody, enabled: boolean): void;
  }
  /** In headless all getters return nil and setters do nothing. Bone indices start at 0. */
  interface Skeleton {
    get_model(this: Skeleton, index: number): string | undefined;
    set_model(this: Skeleton, index: number, name?: string): void;
    get_matrix(this: Skeleton, index: number): Mat4 | undefined;
    /** Mutates destination; returns no value. */
    get_matrix(this: Skeleton, index: number, dest: Mat4): void;
    set_matrix(this: Skeleton, index: number, value: Mat4): void;
    reset_pose(this: Skeleton): void;
    get_texture(this: Skeleton, key: string): string | undefined;
    set_texture(this: Skeleton, key: string, value: string): void;
    index(this: Skeleton, name: string): number | undefined;
    is_visible(this: Skeleton, index?: number): boolean | undefined;
    set_visible(this: Skeleton, visible: boolean): void;
    set_visible(this: Skeleton, index: number, visible: boolean): void;
    get_color(this: Skeleton, index?: number): Vec4 | undefined;
    set_color(this: Skeleton, color: Vec3 | Vec4, index?: number): void;
    set_interpolated(this: Skeleton, enabled: boolean): void;
  }
  /** A handle, not an ownership guarantee. Reacquire with entities.get after world reload. */
  interface Entity {
    readonly transform: Transform;
    readonly rigidbody: Rigidbody;
    readonly skeleton: Skeleton;
    despawn(this: Entity): void;
    get_skeleton(this: Entity): string | undefined;
    set_skeleton(this: Entity, name?: string): void;
    get_component<K extends keyof ComponentRegistry>(this: Entity, name: K): ComponentRegistry[K] | undefined;
    get_component(this: Entity, name: string): unknown;
    require_component<K extends keyof ComponentRegistry>(this: Entity, name: K): ComponentRegistry[K];
    require_component(this: Entity, name: string): unknown;
    has_component(this: Entity, name: string): boolean;
    get_uid(this: Entity): number;
    def_index(this: Entity): number | undefined;
    /** Requires a live entity; the Lua wrapper passes the definition index directly. */
    def_name(this: Entity): string | undefined;
    get_player(this: Entity): number | undefined;
    /** Disabled components also skip save/despawn callbacks in current VC. */
    set_enabled(this: Entity, name: string, enabled: boolean): void;
  }
  interface ComponentCallbacks {
    on_update?(this: void, tps: number): void;
    on_physics_update?(this: void, delta: number): void;
    on_render?(this: void, delta: number): void;
    on_save?(this: void): void;
    on_despawn?(this: void): void;
    on_enable?(this: void): void;
    on_disable?(this: void): void;
    on_grounded?(this: void, force: number): void;
    on_fall?(this: void): void;
    on_sensor_enter?(this: void, index: number, uid: number): void;
    on_sensor_exit?(this: void, index: number, uid: number): void;
    on_aim_on?(this: void, playerId: number): void;
    on_aim_off?(this: void, playerId: number): void;
    on_attacked?(this: void, attackerUid: number, playerId: number): void;
    on_used?(this: void, playerId: number): void;
    on_player_set?(this: void, playerId: number): void;
  }
  /** Factory context supplied by generated component entry; data must be narrowed/validated. */
  interface ComponentContext {
    readonly entity: Entity;
    readonly args: Readonly<Record<string, unknown>>;
    readonly saved: Record<string, Value>;
  }
  type ComponentFactory<T extends ComponentCallbacks = ComponentCallbacks> = (this: void, context: ComponentContext) => T;
  interface EntityRayHit extends BlockRayHit { entity?: number; }
  interface WorldRayOptions {
    start: Vec3; dir: Vec3; distance: number;
    entities?: boolean; ignore_uid?: number; nonselect_entities?: boolean;
    filter_blocks?: (string | number)[]; blocks_exclusion?: boolean; nonselect_blocks?: boolean;
    // filter_entities/entities_exclusion are omitted: native implementation misroutes the filter.
  }
}
declare namespace entities {
  function exists(this: void, uid: number): boolean;
  /** Throws for an unknown definition name. */
  function def_index(this: void, name: string): number;
  function def_name(this: void, index: number): string | undefined;
  function def_hitbox(this: void, index: number): VC.Vec3 | undefined;
  function def_solid(this: void, index: number): boolean | undefined;
  function defs_count(this: void): number;
  function get_def(this: void, uid: number): number | undefined;
  /** ARGS keys are component IDs with ':' replaced by '__'. Supplying args replaces definition defaults. */
  function spawn(this: void, name: string, position: VC.Vec3, args?: VC.ObjectValue): VC.Entity;
  function despawn(this: void, uid: number): void;
  function get(this: void, uid: number): VC.Entity | undefined;
  /** UID-keyed dictionary, NOT a dense array. */
  function get_all(this: void, uids?: number[]): Record<number, VC.Entity | undefined>;
  function get_skeleton(this: void, uid: number): string | undefined;
  function set_skeleton(this: void, uid: number, name?: string): void;
  function get_player(this: void, uid: number): number | undefined;
  function get_all_in_box(this: void, position: VC.Vec3, size: VC.Vec3): number[];
  function get_all_in_radius(this: void, position: VC.Vec3, radius: number): number[];
  /** Legacy overload; dest may retain an old entity field on a subsequent block hit. Prefer a fresh result. */
  function raycast(this: void, start: VC.Vec3, direction: VC.Vec3, distance: number, ignoreUid: number, dest?: VC.EntityRayHit, filterBlocks?: (string | number)[]): VC.EntityRayHit | undefined;
  /** Reloads the chunk used for future instances; does not recreate existing component environments. */
  function reload_component(this: void, name: string): void;
}
declare namespace world {
  function raycast(this: void, options: VC.WorldRayOptions): VC.EntityRayHit | undefined;
}
