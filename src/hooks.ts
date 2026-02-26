import {
	useEffect,
	useReducer,
	useRef,
	useState,
	useCallback,
	useDebugValue,
} from 'react';
import { Atom } from './atom';
import { Computed } from './computed';

type Readable<T> = Atom<T> | Computed<T>;

// ─── Core: useAtom ────────────────────────────────────────────────────────────

/**
 * Subscribe to an Atom or Computed value.
 * The component re-renders only when this specific atom changes.
 *
 * @example
 * const todos = useAtom(store.todos);
 * const count = useAtom(store.totalCount); // Computed
 */
export function useAtom<T>(atom: Readable<T>): T {
	// Use a version counter to force renders — avoids stale closure issues
	const [, rerender] = useReducer((n: number) => n + 1, 0);

	useEffect(() => {
		// Sync check in case atom changed between render and effect
		rerender();
		return atom.subscribe(rerender);
	}, [atom]);

	useDebugValue(atom.value);
	return atom.value;
}

// ─── useAtomSelector ─────────────────────────────────────────────────────────

/**
 * Subscribe to a slice of an Atom's value.
 * The component only re-renders when the *selected* value changes (via Object.is).
 *
 * @example
 * const firstTodo = useAtomSelector(store.todos, (todos) => todos[0]);
 * const count     = useAtomSelector(store.todos, (todos) => todos.length);
 */
export function useAtomSelector<T, R>(
	atom: Readable<T>,
	selector: (value: T) => R,
	isEqual: (a: R, b: R) => boolean = Object.is,
): R {
	const [selected, setSelected] = useState<R>(() => selector(atom.value));
	const prevRef = useRef<R>(selected);

	useEffect(() => {
		// Sync on mount/atom change
		const synced = selector(atom.value);
		if (!isEqual(prevRef.current, synced)) {
			prevRef.current = synced;
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setSelected(synced);
		}

		return atom.subscribe(() => {
			const next = selector(atom.value);
			if (!isEqual(prevRef.current, next)) {
				prevRef.current = next;
				setSelected(next);
			}
		});
	}, [atom, selector, isEqual]);

	return selected;
}

// ─── useAtomSet ───────────────────────────────────────────────────────────────

/**
 * Returns a stable setter for an Atom.
 * Does NOT subscribe to the atom — the component won't re-render on changes.
 * Useful for write-only components (forms, buttons).
 *
 * @example
 * const setFilter = useAtomSet(store.filter);
 * <button onClick={() => setFilter("active")}>Active</button>
 */
export function useAtomSet<T>(
	atom: Atom<T>,
): (updater: T | ((prev: T) => T)) => void {
	return useCallback(updater => atom.set(updater), [atom]);
}

// ─── useAtoms ─────────────────────────────────────────────────────────────────

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
export function useAtoms<T extends readonly Readable<unknown>[]>(
	...atoms: T
): { [K in keyof T]: T[K] extends Readable<infer V> ? V : never } {
	const [, rerender] = useReducer((n: number) => n + 1, 0);

	useEffect(() => {
		rerender();
		const unsubs = atoms.map(a => a.subscribe(rerender));
		return () => unsubs.forEach(u => u());
	}, atoms);

	return atoms.map(a => a.value) as {
		[K in keyof T]: T[K] extends Readable<infer V> ? V : never;
	};
}

// ─── useStoreAction ───────────────────────────────────────────────────────────

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
export function useStoreAction<Args extends unknown[], R>(
	action: (...args: Args) => Promise<R>,
): {
	run: (...args: Args) => Promise<R | undefined>;
	loading: boolean;
	error: Error | null;
	reset: () => void;
} {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const run = useCallback(
		async (...args: Args): Promise<R | undefined> => {
			setLoading(true);
			setError(null);
			try {
				const result = await action(...args);
				if (mountedRef.current) setLoading(false);
				return result;
			} catch (err) {
				if (mountedRef.current) {
					setLoading(false);
					setError(
						err instanceof Error ? err : new Error(String(err)),
					);
				}
				return undefined;
			}
		},
		[action],
	);

	const reset = useCallback(() => {
		setLoading(false);
		setError(null);
	}, []);

	return { run, loading, error, reset };
}
