export interface Mover extends VC.ComponentCallbacks {
  snapshot(this: void): { steps: number; updates: number; enables: number; disables: number; restored: boolean; speed: number };
  add(this: void, amount: number): void;
  stop(this: void): void;
}
declare global {
  namespace VC { interface ComponentRegistry { "direct:mover": Mover; } }
}

// Module scope is shared by require. All mutable per-entity state lives in this factory.
export function create(this: void, { entity, args, saved }: VC.ComponentContext): Mover {
  let steps = typeof saved.steps === "number" ? saved.steps : 0;
  const restored = typeof saved.steps === "number";
  const speed = typeof saved.speed === "number" ? saved.speed : typeof args.speed === "number" ? args.speed : 1;
  let moving = !restored;
  let updates = 0;
  let enables = 0;
  let disables = 0;
  entity.rigidbody.set_gravity_scale(0);
  entity.rigidbody.set_linear_damping(0);
  entity.rigidbody.set_vel([0, 0, 0]);
  return {
    snapshot: () => ({ steps, updates, enables, disables, restored, speed }),
    add: amount => { steps += amount; },
    stop: () => { moving = false; entity.rigidbody.set_vel([0, 0, 0]); },
    on_update: tps => { assert(tps > 0, "update dot ABI"); updates++; },
    on_physics_update: delta => {
      assert(delta >= 0, "physics dot ABI");
      if (moving) { steps++; entity.rigidbody.set_vel([speed, 0, 0]); }
    },
    on_disable: () => { disables++; entity.rigidbody.set_vel([0, 0, 0]); },
    on_enable: () => { enables++; },
    on_save: () => { saved.steps = steps; saved.speed = speed; },
    on_despawn: () => { events.emit("direct:mover-despawn", entity.get_uid()); },
  };
}
