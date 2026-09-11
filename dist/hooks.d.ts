import type { Atom, Updater } from './atom';
import type { EqualFn, ReactiveNode } from './graph';
import { type StoredAtomOptions } from './stored-atom';
type Readable<T> = ReactiveNode<T>;
type Values<T extends readonly Readable<unknown>[]> = {
    [K in keyof T]: T[K] extends Readable<infer V> ? V : never;
};
/** Subscribes to an Atom or Computed. */
export declare function useAtom<T>(node: Readable<T>): T;
/** Reads and writes an Atom, like `useState` against shared state. */
export declare function useAtomState<T>(atom: Atom<T>): [T, (updater: Updater<T>) => void];
/** A stable setter that does not subscribe. */
export declare function useAtomSet<T>(atom: Atom<T>): (updater: Updater<T>) => void;
/**
 * `useState` backed by storage, shared by key. The entry is dropped when its
 * last subscriber unmounts, so a later mount reloads from storage.
 */
export declare function useStoredState<T>(key: string, initialValue: T, options?: StoredAtomOptions<T>): [T, (updater: Updater<T>) => void];
/** Subscribes to a slice, re-rendering only when the selected value changes. */
export declare function useAtomSelector<T, R>(node: Readable<T>, selector: (value: T) => R, isEqual?: EqualFn<R>): R;
/** Subscribes to several nodes, returning their values in order. */
export declare function useAtoms<T extends readonly Readable<unknown>[]>(...nodes: T): Values<T>;
/** Wraps an async action in loading/error state. `run` is stable. */
export declare function useStoreAction<Args extends unknown[], R>(action: (...args: Args) => Promise<R>): {
    run: (...args: Args) => Promise<R | undefined>;
    loading: boolean;
    error: Error | null;
    reset: () => void;
};
export {};
//# sourceMappingURL=hooks.d.ts.map