import { Atom } from './atom';
import { Computed, type ComputedOptions } from './computed';
type AnyAtom = Atom<any>;
type AnyComputed = Computed<any>;
export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';
/**
 * Base class for all stores.
 *
 * ## Anatomy of a Store
 *
 * ```ts
 * class TodoStore extends Store {
 *   // ── State (reactive) ──────────────────────────────
 *   readonly todos    = this.atom<Todo[]>([]);
 *   readonly filter   = this.atom<Filter>("all");
 *   readonly loading  = this.atom(false);
 *
 *   // ── Computed (derived, read-only) ─────────────────
 *   readonly filtered = this.computed(
 *     [this.todos, this.filter],
 *     () => applyFilter(this.todos.value, this.filter.value)
 *   );
 *
 *   // ── Internal (non-reactive) ───────────────────────
 *   private _cache = new Map<string, Todo>();
 *
 *   // ── Actions (public methods) ──────────────────────
 *   async fetchTodos() { ... }
 *   addTodo(text: string) { ... }
 * }
 * ```
 *
 * ## Repository Pattern
 *
 * Override `onInit` / `onDestroy` for DB bootstrap / cleanup:
 *
 * ```ts
 * protected async onInit() {
 *   const rows = await db.select<Todo[]>("SELECT * FROM todos");
 *   this.todos.set(rows);
 * }
 * ```
 */
export declare abstract class Store {
    /**
     * Creates a reactive atom. Call this in a property initializer.
     * The atom's name is inferred via Object.defineProperty in the constructor.
     */
    protected atom<T>(initialValue: T): Atom<T>;
    /**
     * Creates a derived computed value from one or more atoms.
     *
     * @param deps   Atoms this value depends on
     * @param compute Pure function that derives the new value
     *
     * @example
     * readonly fullName = this.computed(
     *   [this.firstName, this.lastName],
     *   () => `${this.firstName.value} ${this.lastName.value}`
     * );
     */
    protected computed<T>(deps: AnyAtom[], compute: () => T, options?: ComputedOptions<T>): Computed<T>;
    /**
     * Called when the store is initialised (e.g. via `StoreRegistry.init()`).
     * Override to load initial data from a database or external source.
     */
    protected onInit(): Promise<void>;
    /**
     * Called when the store is destroyed.
     * Override to cancel subscriptions, close DB connections, etc.
     */
    protected onDestroy(): Promise<void>;
    /** @internal — called by StoreRegistry */
    _init(): Promise<void>;
    /** @internal — called by StoreRegistry */
    _destroy(): Promise<void>;
    private _disposeComputeds;
}
/** Extract all Atom properties from a Store as a mapped type */
export type StoreAtoms<S extends Store> = {
    [K in keyof S as S[K] extends AnyAtom ? K : never]: S[K];
};
/** Extract all Computed properties from a Store as a mapped type */
export type StoreComputeds<S extends Store> = {
    [K in keyof S as S[K] extends AnyComputed ? K : never]: S[K];
};
/** Extract all action (function) properties from a Store */
export type StoreActions<S extends Store> = {
    [K in keyof S as S[K] extends (...args: unknown[]) => unknown ? K : never]: S[K];
};
export {};
//# sourceMappingURL=store.d.ts.map