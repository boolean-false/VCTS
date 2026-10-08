/** Small author layer; compiled into the owning pack, no runtime SDK dependency. */
export type Dispose = (this: void) => void;

export class Scope {
    private cleanups: Dispose[] = [];
    private closed = false;

    get disposed(): boolean {
        return this.closed;
    }

    own(this: Scope, cleanup: Dispose): Dispose {
        let active = true;
        const dispose = (): void => {
            if (active) {
                active = false;
                const i = this.cleanups.indexOf(dispose);
                if (i >= 0) this.cleanups.splice(i, 1);
                cleanup();
            }
        };
        if (this.closed) dispose(); else this.cleanups.push(dispose);
        return dispose;
    }

    dispose(this: Scope): void {
        if (this.closed) return;
        this.closed = true;
        const pending = this.cleanups;
        this.cleanups = [];
        let failed = false, error: unknown;
        for (let i = pending.length - 1; i >= 0; i--) {
            try {
                pending[i]!();
            } catch (e) {
                if (!failed) {
                    failed = true;
                    error = e;
                }
            }
        }
        if (failed) throw error;
    }
}

type EventShape<M> = { [K in keyof M]: unknown[] };
type Subscription = { event: string; active: boolean; handler: (this: void, ...args: unknown[]) => void };

/** In-process contracts. Mutations during emit apply to the next emission; removed listeners are skipped immediately. */
export class EventBus<M extends EventShape<M>> {
    private subscriptions: Subscription[] = [];

    on<K extends keyof M & string>(this: EventBus<M>, event: K, handler: (this: void, ...args: M[K]) => void, scope?: Scope): Dispose {
        const entry: Subscription = {event, active: true, handler: handler as (this: void, ...args: unknown[]) => void};
        this.subscriptions.push(entry);
        const remove = (): void => {
            entry.active = false;
            const i = this.subscriptions.indexOf(entry);
            if (i >= 0) this.subscriptions.splice(i, 1);
        };
        return scope ? scope.own(remove) : remove;
    }

    emit<K extends keyof M & string>(this: EventBus<M>, event: K, ...args: M[K]): void {
        for (const item of this.subscriptions.slice()) if (item.active && item.event === event) item.handler(...args);
    }
}

type Job = { at: number; interval: number; active: boolean; callback: Dispose };

/** Drive from on_world_tick using elapsed uptime or from on_update(dt). Time is seconds, independent of wall time. */
export class Scheduler {
    private now = 0;
    private jobs: Job[] = [];

    after(this: Scheduler, seconds: number, callback: Dispose, scope?: Scope): Dispose {
        return this.add(seconds, 0, callback, scope);
    }

    every(this: Scheduler, seconds: number, callback: Dispose, scope?: Scope): Dispose {
        if (!(seconds > 0)) throw new Error("interval must be positive");
        return this.add(seconds, seconds, callback, scope);
    }

    private add(this: Scheduler, delay: number, interval: number, callback: Dispose, scope?: Scope): Dispose {
        if (!Number.isFinite(delay) || delay < 0) throw new Error("delay must be finite and nonnegative");
        const job: Job = {at: this.now + delay, interval, active: true, callback};
        this.jobs.push(job);
        const cancel = (): void => {
            job.active = false;
            const i = this.jobs.indexOf(job);
            if (i >= 0) this.jobs.splice(i, 1);
        };
        const dispose = scope ? scope.own(cancel) : cancel;
        if (interval === 0) job.callback = () => {
            try {
                callback();
            } finally {
                dispose();
            }
        };
        return dispose;
    }

    tick(this: Scheduler, seconds: number): void {
        if (!Number.isFinite(seconds) || seconds < 0) throw new Error("delta must be finite and nonnegative");
        this.now += seconds;
        for (const job of this.jobs.slice()) if (job.active && this.now >= job.at) {
            if (job.interval > 0) job.at = this.now + job.interval;
            else {
                job.active = false;
                const i = this.jobs.indexOf(job);
                if (i >= 0) this.jobs.splice(i, 1);
            }
            job.callback();
        }
    }

    clear(this: Scheduler): void {
        for (const job of this.jobs) job.active = false;
        this.jobs = [];
    }

    wait(this: Scheduler, seconds: number, scope?: Scope): Task<void> {
        const task = new Task<void>();
        const cancel = this.after(seconds, () => task.resolve(undefined));
        task.onCancel(cancel);
        if (scope) {
            const release = scope.own(() => task.cancel());
            task.onDone(() => release()).onError(() => release());
        }
        return task;
    }
}

/** Explicit asynchronous result. Native requests continue after cancel, but callbacks no longer deliver. */
export class Task<T> {
    private state: "pending" | "done" | "failed" | "cancelled" = "pending";
    private result: T | undefined;
    private error: unknown;
    private success: ((this: void, value: T) => void)[] = [];
    private failure: ((this: void, error: unknown) => void)[] = [];
    private cancellation: Dispose[] = [];

    get status(): "pending" | "done" | "failed" | "cancelled" {
        return this.state;
    }

    onDone(this: Task<T>, handler: (this: void, value: T) => void): Task<T> {
        if (this.state === "done") handler(this.result as T); else if (this.state === "pending") this.success.push(handler);
        return this;
    }

    onError(this: Task<T>, handler: (this: void, error: unknown) => void): Task<T> {
        if (this.state === "failed") handler(this.error); else if (this.state === "pending") this.failure.push(handler);
        return this;
    }

    onCancel(this: Task<T>, handler: Dispose): Task<T> {
        if (this.state === "cancelled") handler(); else if (this.state === "pending") this.cancellation.push(handler);
        return this;
    }

    resolve(this: Task<T>, value: T): void {
        if (this.state !== "pending") return;
        this.state = "done";
        this.result = value;
        const handlers = this.success;
        this.success = [];
        this.failure = [];
        this.cancellation = [];
        for (const handler of handlers) handler(value);
    }

    reject(this: Task<T>, error: unknown): void {
        if (this.state !== "pending") return;
        this.state = "failed";
        this.error = error;
        const handlers = this.failure;
        this.success = [];
        this.failure = [];
        this.cancellation = [];
        for (const handler of handlers) handler(error);
    }

    cancel(this: Task<T>): void {
        if (this.state !== "pending") return;
        this.state = "cancelled";
        const handlers = this.cancellation;
        this.success = [];
        this.failure = [];
        this.cancellation = [];
        for (const handler of handlers) handler();
    }
}

export interface Schema<T> {
    readonly version: number;

    decode(this: void, data: unknown): T;

    encode(this: void, data: T): VC.Value;

    migrate?(this: void, data: unknown, fromVersion: number): unknown;
}

function object(this: void, value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("object expected");
    return value as Record<string, unknown>;
}

/** Invalid/future saves fail explicitly. Defaults and snapshots pass through schema to prevent shared state. */
export class Store<T> {
    value: T;

    constructor(private path: string, private schema: Schema<T>, defaults: T) {
        if (!Number.isInteger(schema.version) || schema.version < 1) throw new Error("schema version must be positive integer");
        this.value = this.clone(defaults);
        if (file.isfile(path)) this.restore(json.parse(file.read(path)));
    }

    private clone(this: Store<T>, value: T): T {
        return this.schema.decode(json.parse(json.tostring(this.schema.encode(value))));
    }

    restore(this: Store<T>, envelope: unknown): void {
        const saved = object(envelope), version = saved.version;
        if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > this.schema.version) throw new Error("unsupported save version");
        let data = saved.data;
        if (version !== this.schema.version) {
            if (!this.schema.migrate) throw new Error("save migration required");
            data = this.schema.migrate(data, version);
        }
        const decoded = this.schema.decode(data);
        this.value = this.clone(decoded);
    }

    snapshot(this: Store<T>): { version: number; data: VC.Value } {
        return {version: this.schema.version, data: this.schema.encode(this.clone(this.value))};
    }

    save(this: Store<T>): void {
        const text = json.tostring(this.snapshot());
        file.write(this.path, text);
    }
}
