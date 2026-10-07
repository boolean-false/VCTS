declare function assert(this: void, condition: unknown, message?: string): asserts condition;

declare function print(this: void, ...args: unknown[]): void;
interface TestCoroutine { readonly __coroutine: unique symbol; }
declare namespace coroutine {
  function create(this: void, fn: (this: void) => unknown): TestCoroutine;
  function resume(this: void, thread: TestCoroutine): LuaMultiReturn<[boolean, unknown?]>;
  function status(this: void, thread: TestCoroutine): "running" | "suspended" | "normal" | "dead";
}
