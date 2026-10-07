/**
 * Экспериментальный SDK; минимальный адаптер находится в runtime/core.lua.
 * Это наши функции поверх VC, а не встроенные функции движка.
 * this: void фиксирует dot-call ABI для методов и callbacks на границе Lua.
 * defineProject пока не управляет сборкой: конфигурация демо отдельная.
 */

export interface Position {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

declare const playerBrand: unique symbol;
export type PlayerId = number & { readonly [playerBrand]: true };

export interface Subscription {
  dispose(this: void): void;
}

export interface Event<T> {
  subscribe(this: void, handler: (this: void, value: T) => void): Subscription;
}

export interface Signal<T> extends Event<T> {
  emit(this: void, value: T): void;
}

export declare function signal<T>(): Signal<T>;

/**
 * Scope освобождает подписки и отменяет ещё не начавшиеся callbacks.
 * После закрытия мира или удаления владельца callbacks не вызываются.
 * Выполнение уже начавшегося синхронного callback не прерывается.
 */
export interface Lifetime {
  own(this: void, resource: Subscription): void;
  after(this: void, seconds: number, callback: (this: void) => void): Subscription;
}

declare const fieldBrand: unique symbol;
export interface Field<T> {
  readonly [fieldBrand]: T;
}

/** Диапазон int16 проверяется также во время выполнения. Тип number его не доказывает. */
export declare const field: {
  int16(this: void, initial: number): Field<number>;
};

type Fields = Readonly<Record<string, Field<unknown>>>;
type State<S extends Fields> = {
  -readonly [K in keyof S]: S[K] extends Field<infer T> ? T : never;
};

export interface BlockContext<S, T> {
  readonly position: Position;
  readonly state: S;
  readonly transient: T;
  readonly lifetime: Lifetime;
}

export interface BlockDefinition<S extends Fields, T> {
  readonly id: string;
  readonly appearance: { readonly texture: string };
  readonly state: S;
  readonly transient: (this: void) => T;
  onInteract(this: void, context: BlockContext<State<S>, T>, player: PlayerId): boolean;
}

declare const blockBrand: unique symbol;
export interface Block {
  readonly [blockBrand]: true;
}

export declare function defineBlock<S extends Fields, T>(
  definition: BlockDefinition<S, T>,
): Block;

/** Представление состоит из снимка данных и команд. Оно не владеет состоянием блока. */
export interface PanelModel<V, A> {
  read(this: void): V;
  readonly changed: Event<V>;
  readonly actions: A;
  readonly owner: Lifetime;
}

export interface PanelDefinition<V, A> {
  readonly title: string;
  readonly text: (this: void, view: V) => string;
  readonly buttons: readonly {
    readonly label: string;
    readonly enabled: (this: void, view: V) => boolean;
    readonly invoke: (this: void, actions: A) => void;
  }[];
}

export interface Panel<V, A> {
  /** Закрытие панели освобождает её подписку, но не отменяет работу владельца. */
  open(this: void, player: PlayerId, model: PanelModel<V, A>): void;
}

export declare function definePanel<V, A>(definition: PanelDefinition<V, A>): Panel<V, A>;

export declare function definePack(definition: {
  readonly id: string;
  readonly dependencies: readonly string[];
  readonly blocks: readonly Block[];
}): unknown;

export declare function defineProject(definition: {
  readonly id: string;
  readonly title: string;
  readonly packs: readonly { readonly id: string; readonly source: string }[];
  readonly basePacks: readonly string[];
}): unknown;
