import {Scope, Scheduler, Store, EventBus} from "./lib/core";

type Counter = { ticks: number };
type GameEvents = { changed: [ticks: number] };

export function create(this: void, _context: VC.ScriptContext): VC.WorldCallbacks {
    const clock = new Scheduler(), bus = new EventBus<GameEvents>();
    let scope: Scope | undefined, store: Store<Counter> | undefined;
    let previous = 0;
    return {
        on_world_open: () => {
            clock.clear();
            scope = new Scope();
            previous = time.uptime();
            store = new Store("world:starter-state.json", {
                version: 1,
                decode: value => {
                    if (typeof value !== "object" || value === null || !("ticks" in value) || typeof value.ticks !== "number" || !Number.isInteger(value.ticks) || value.ticks < 0) throw new Error("invalid counter save");
                    return {ticks: value.ticks};
                },
                encode: value => ({ticks: value.ticks})
            }, {ticks: 0});
            bus.on("changed", ticks => {
                store!.value.ticks = ticks;
            }, scope);
            clock.every(0.05, () => bus.emit("changed", store!.value.ticks + 1), scope);
        },
        on_world_tick: () => {
            const now = time.uptime();
            clock.tick(now - previous);
            previous = now;
        },
        on_world_save: () => store?.save(),
        on_world_quit: () => {
            scope?.dispose();
            scope = undefined;
            store = undefined;
            clock.clear();
        }
    };
}
