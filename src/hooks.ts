import {
	useCallback,
	useDebugValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import type { Atom, Updater } from './atom';
import type { EqualFn, ReactiveNode } from './graph';
import { StoredAtom, type StoredAtomOptions } from './stored-atom';

type Readable<T> = ReactiveNode<T>;

type Values<T extends readonly Readable<unknown>[]> = {
	[K in keyof T]: T[K] extends Readable<infer V> ? V : never;
};

// ─── useAtom ──────────────────────────────────────────────────────────────────

/** Subscribes to an Atom or Computed. */
export function useAtom<T>(node: Readable<T>): T {
	const subscribe = useCallback(
		(onChange: () => void) => node.subscribe(onChange),
		[node],
	);
	const getSnapshot = useCallback(() => node.peek(), [node]);

	const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	useDebugValue(value);
	return value;
}

// ─── useAtomState ─────────────────────────────────────────────────────────────

/** Reads and writes an Atom, like `useState` against shared state. */
export function useAtomState<T>(
	atom: Atom<T>,
): [T, (updater: Updater<T>) => void] {
	return [useAtom(atom), useAtomSet(atom)];
}

// ─── useAtomSet ───────────────────────────────────────────────────────────────

/** A stable setter that does not subscribe. */
export function useAtomSet<T>(atom: Atom<T>): (updater: Updater<T>) => void {
	return useCallback((updater: Updater<T>) => atom.set(updater), [atom]);
}

// ─── useStoredState ───────────────────────────────────────────────────────────

/** One atom per key, so components sharing a key stay in sync. */
const storedAtoms = new Map<string, StoredAtom<unknown>>();

function storedAtomFor<T>(
	key: string,
	initialValue: T,
	options?: StoredAtomOptions<T>,
): StoredAtom<T> {
	let atom = storedAtoms.get(key) as StoredAtom<T> | undefined;
	if (!atom) {
		// The first caller decides the initial value and options for this key.
		atom = new StoredAtom<T>(key, initialValue, options);
		storedAtoms.set(key, atom as StoredAtom<unknown>);
	}
	return atom;
}

/**
 * `useState` backed by storage, shared by key. The entry is dropped when its
 * last subscriber unmounts, so a later mount reloads from storage.
 */
export function useStoredState<T>(
	key: string,
	initialValue: T,
	options?: StoredAtomOptions<T>,
): [T, (updater: Updater<T>) => void] {
	const atom = useMemo(
		// Only `key` identifies the atom; a changed initial value or options
		// would otherwise recreate one the other subscribers are not using.
		() => storedAtomFor(key, initialValue, options),
		[key],
	);

	const subscribe = useCallback(
		(onChange: () => void) => {
			const unsubscribe = atom.subscribe(onChange);
			return () => {
				unsubscribe();
				if (
					atom.listenerCount === 0 &&
					storedAtoms.get(key) === (atom as StoredAtom<unknown>)
				) {
					storedAtoms.delete(key);
				}
			};
		},
		[atom, key],
	);

	const getSnapshot = useCallback(() => atom.peek(), [atom]);

	const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	useDebugValue(value);

	return [value, useAtomSet(atom)];
}

// ─── useAtomSelector ──────────────────────────────────────────────────────────

/** Subscribes to a slice, re-rendering only when the selected value changes. */
export function useAtomSelector<T, R>(
	node: Readable<T>,
	selector: (value: T) => R,
	isEqual: EqualFn<R> = Object.is,
): R {
	// `selector` and `isEqual` are kept out of the subscription's deps, so an
	// inline one costs a re-selection rather than a re-subscription.
	const subscribe = useCallback(
		(onChange: () => void) => node.subscribe(onChange),
		[node],
	);

	const getSelection = useMemo(() => {
		let hasMemo = false;
		let memoSource: T;
		let memoResult: R;

		return (): R => {
			const source = node.peek();
			if (hasMemo && Object.is(memoSource, source)) return memoResult;

			const next = selector(source);
			memoSource = source;
			if (hasMemo && isEqual(memoResult, next)) return memoResult;

			hasMemo = true;
			memoResult = next;
			return next;
		};
	}, [node, selector, isEqual]);

	const value = useSyncExternalStore(subscribe, getSelection, getSelection);
	useDebugValue(value);
	return value;
}

// ─── useAtoms ─────────────────────────────────────────────────────────────────

/** Subscribes to several nodes, returning their values in order. */
export function useAtoms<T extends readonly Readable<unknown>[]>(
	...nodes: T
): Values<T> {
	const stable = useStableNodes(nodes);

	const subscribe = useCallback(
		(onChange: () => void) => {
			const unsubscribes = stable.map(node => node.subscribe(onChange));
			return () => {
				for (const unsubscribe of unsubscribes) unsubscribe();
			};
		},
		[stable],
	);

	const getSnapshot = useMemo(() => {
		let last: unknown[] | null = null;
		return (): unknown[] => {
			const next = stable.map(node => node.peek());
			// uSES compares snapshots by identity.
			if (
				last !== null &&
				last.length === next.length &&
				last.every((value, i) => Object.is(value, next[i]))
			) {
				return last;
			}
			last = next;
			return next;
		};
	}, [stable]);

	const values = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	useDebugValue(values);
	return values as Values<T>;
}

/** Collapses the rest argument to a stable identity; tolerates a varying length. */
function useStableNodes<T extends readonly Readable<unknown>[]>(nodes: T): T {
	const ref = useRef<T>(nodes);
	const previous = ref.current;
	const changed =
		previous.length !== nodes.length ||
		previous.some((node, i) => node !== nodes[i]);
	if (changed) ref.current = nodes;
	return ref.current;
}

// ─── useStoreAction ───────────────────────────────────────────────────────────

/** Wraps an async action in loading/error state. `run` is stable. */
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

	const actionRef = useRef(action);
	actionRef.current = action;

	const run = useCallback(async (...args: Args): Promise<R | undefined> => {
		setLoading(true);
		setError(null);
		try {
			const result = await actionRef.current(...args);
			if (mountedRef.current) setLoading(false);
			return result;
		} catch (err) {
			if (mountedRef.current) {
				setLoading(false);
				setError(err instanceof Error ? err : new Error(String(err)));
			}
			return undefined;
		}
	}, []);

	const reset = useCallback(() => {
		setLoading(false);
		setError(null);
	}, []);

	return { run, loading, error, reset };
}
