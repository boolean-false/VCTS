import type { Mover } from "./mover";
const cases: string[] = [];
function check(value: unknown, label: string): void { assert(value, label); cases.push(label); }
function near(a: number, b: number): boolean { return Math.abs(a-b) < 0.001; }
function get(uid: number): VC.Entity { const e = entities.get(uid); assert(e, "live entity"); return e; }
function mover(e: VC.Entity): Mover { return e.require_component("direct:mover"); }
let first: VC.Entity;
let second: VC.Entity;
let dead: VC.Entity;
let disabledSteps = 0;
let savedSteps = 0;
let savedPos: VC.Vec3;
let despawns: number[] = [];
let listener: (this: void, uid: number) => void;

export function setup(this: void): number[] {
  cases.length = 0;
  despawns = [];
  listener = events.on("direct:mover-despawn", (uid: number) => { despawns.push(uid); });
  first = entities.spawn("direct:probe", [2, 105, 2]);
  second = entities.spawn("direct:probe", [2, 105, 5], { direct__mover: { speed: 4 } });
  dead = entities.spawn("direct:probe", [2, 105, 8], {});
  check(mover(first).snapshot().speed === 2 && mover(second).snapshot().speed === 4 && mover(dead).snapshot().speed === 1, "entity ARGS defaults/override/empty");
  check(first !== second && mover(first) !== mover(second), "per-instance factory isolation");
  const id = first.get_uid();
  const def = entities.def_index("direct:probe");
  check(first.def_index() === def && first.def_name() === "direct:probe" && entities.get_def(id) === def, "entity definition and object self ABI");
  check(entities.def_hitbox(def)?.[0] === 1 && entities.def_solid(def) === false && entities.defs_count() > def, "entity definition properties");
  check(entities.def_name(-1) === undefined && entities.get(-1) === undefined && !entities.exists(-1), "missing entity nil");
  check(first.get_player() === -1 && entities.get_player(id) === -1, "unbound entity player sentinel");
  check(first.has_component("direct:mover") && !first.has_component("direct:absent") && first.get_component("direct:absent") === undefined, "component lookup");
  check(entities.get_all([id])[id] === first, "UID dictionary no array offset");
  check(entities.get_all_in_box([1, 104, 1], [2, 2, 2]).includes(id) && entities.get_all_in_radius([2, 105, 2], 1).includes(id), "entity spatial queries");
  first.transform.set_size([1, 2, 1]);
  first.transform.set_rot(mat4.idt());
  check(first.transform.get_size()?.[1] === 2 && first.transform.get_rot()?.[0] === 1, "transform size/matrix");
  const body = first.rigidbody;
  body.set_size([1, 1, 1]); body.set_enabled(true); body.set_body_type("kinematic");
  body.set_vdamping(0.5); body.set_crouching(true); body.set_mass(3); body.set_elasticity(0.2); body.set_material("base:stone");
  check(body.is_enabled() && body.get_size()?.[0] === 1 && body.get_body_type() === "kinematic", "rigidbody size/type/enabled");
  check(body.is_vdamping() && body.get_vdamping() === 0.5 && body.is_crouching() && body.get_mass() === 3 && near(body.get_elasticity()!,0.2) && body.get_material() === "base:stone", "rigidbody properties");
  body.set_vdamping(false); body.set_crouching(false); body.set_selectable(true);
  check(body.get_gravity_scale() === 0 && body.get_linear_damping() === 0 && body.is_selectable() && body.get_ground_vel()?.[0] === 0 && body.is_grounded() === false, "rigidbody gravity/damping/ground");
  const ray = world.raycast({start:[0,105,2],dir:[1,0,0],distance:4});
  check(ray?.entity === id, "world raycast entity hit");
  check(entities.raycast([0,105,2],[1,0,0],4,0)?.entity === id, "legacy raycast entity hit");
  first.skeleton.set_color([1,0,0]); first.skeleton.set_visible(true); first.skeleton.reset_pose();
  check(first.skeleton.get_color() === undefined && first.skeleton.get_matrix(0) === undefined && first.get_skeleton() === undefined, "headless skeleton no-op/nil");
  first.set_enabled("direct:mover", false);
  first.set_enabled("direct:mover", false);
  disabledSteps = mover(first).snapshot().steps;
  mover(second).add(100);
  return [id, second.get_uid(), dead.get_uid()];
}
export function ready(this: void): boolean { return mover(second).snapshot().updates >= 2 && second.transform.get_pos()![0] > 2.05; }
export function freeze(this: void): void {
  check(mover(first).snapshot().steps === disabledSteps && mover(first).snapshot().updates === 0 && mover(first).snapshot().disables === 1, "disabled callback suppression/idempotence");
  check(mover(second).snapshot().steps >= 100 && second.transform.get_pos()![0] > 2.05, "physics movement and isolated state");
  first.set_enabled("direct:mover", true); first.set_enabled("direct:mover", true);
  check(mover(first).snapshot().enables === 1, "enable event dot ABI/idempotence");
  mover(first).stop(); mover(second).stop(); mover(dead).stop();
  mover(first).add(37);
  savedSteps = mover(first).snapshot().steps;
  savedPos = first.transform.get_pos()!;
  dead.despawn();
}
export function deadGone(this: void): boolean { return !entities.exists(dead.get_uid()) && entities.get(dead.get_uid()) === undefined; }
export function beforeSave(this: void): void {
  check(despawns.includes(dead.get_uid()) && dead.transform.get_pos() === undefined && dead.rigidbody.get_vel() === undefined, "despawn event and stale handle nil");
  events.remove("direct:mover-despawn", listener);
}
export function loaded(this: void): boolean { return entities.get(first.get_uid()) !== undefined && entities.get(second.get_uid()) !== undefined; }
export function afterLoad(this: void): string[] {
  const restored = get(first.get_uid());
  check(restored !== first && mover(restored).snapshot().restored, "reload recreates entity/component");
  check(mover(restored).snapshot().steps === savedSteps && mover(restored).snapshot().enables === 0, "saved state restored/transient state reset");
  check(mover(get(second.get_uid())).snapshot().speed === 4, "spawn override persisted explicitly by component");
  const pos = restored.transform.get_pos()!;
  check(near(pos[0],savedPos[0]) && near(pos[1],savedPos[1]), "transform restored");
  check(entities.get(dead.get_uid()) === undefined, "despawned entity absent after save/reload");
  entities.despawn(restored.get_uid());
  get(second.get_uid()).despawn();
  return cases;
}
