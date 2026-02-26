import { Atom } from './atom';
import { Computed } from './computed';
type Readable<T> = Atom<T> | Computed<T>;
/**
 * Subscribe to an Atom or Computed value.
 * The component re-renders only when this specific atom changes.
 *
 * @example
 * const todos = useAtom(store.todos);
 * const count = useAtom(store.totalCount); // Computed
 */
export declare function useAtom<T>(atom: Readable<T>): T;
/**
 * Subscribe to a slice of an Atom's value.
 * The component only re-renders when the *selected* value changes (via Object.is).
 *
 * @example
 * const firstTodo = useAtomSelector(store.todos, (todos) => todos[0]);
 * const count     = useAtomSelector(store.todos, (todos) => todos.length);
 */
export declare function useAtomSelector<T, R>(atom: Readable<T>, selector: (value: T) => R, isEqual?: (a: R, b: R) => boolean): R;
/**
 * Returns a stable setter for an Atom.
 * Does NOT subscribe to the atom — the component won't re-render on changes.
 * Useful for write-only components (forms, buttons).
 *
 * @example
 * const setFilter = useAtomSet(store.filter);
 * <button onClick={() => setFilter("active")}>Active</button>
 */
export declare function useAtomSet<T>(atom: Atom<T>): (updater: T | ((prev: T) => T)) => void;
/**
 * Subscribe to multiple atoms at once.
 * Re-renders only when any of the watched atoms change.
 * Returns values in the same order as the input atoms.
 *
 * @example
 * const [todos, filter, loading] = useAtoms(
 *   store.todos,
 *   store.filter,
 *   store.loading
 * );
 */
export declare function useAtoms<T extends readonly Readable<unknown>[]>(...atoms: T): {
    [K in keyof T]: T[K] extends Readable<infer V> ? V : never;
};
/**
 * Returns a store action wrapped in a loading/error state tracker.
 * Useful for async actions that need to show loading spinners or error messages.
 *
 * @example
 * const { run: fetchTodos, loading, error } = useStoreAction(store.fetchTodos.bind(store));
 *
 * <button onClick={() => fetchTodos()} disabled={loading}>
 *   {loading ? "Loading..." : "Fetch"}
 * </button>
 */
export declare function useStoreAction<Args extends unknown[], R>(action: (...args: Args) => Promise<R>): {
    run: (...args: Args) => Promise<R | undefined>;
    loading: boolean;
    error: Error | null;
    reset: () => void;
};
export {};
//# sourceMappingURL=hooks.d.ts.map