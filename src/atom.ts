import { scheduleNotify } from './batch';

export type Unsubscribe = () => void;
export type Listener = () => void;
export type Updater<T> = T | ((prev: T) => T);

function isUpdaterFn<T>(v: Updater<T>): v is (prev: T) => T {
	return typeof v === 'function';
}

/**
 * A fine-grained reactive container for a single value.
 *
 * Atoms are the state variables in a Store. Setting their value
 * notifies only the subscribers watching that specific atom,
 * giving you precise control over re-renders.
 *
 * You never construct Atoms directly — use `this.atom()` inside a Store.
 */
export class Atom<T> {
	/** @internal */
	readonly _type = 'atom' as const;
	private _value: T;
	private _listeners = new Set<Listener>();
	private _name: string;

	constructor(initialValue: T, name = 'atom') {
		this._value = initialValue;
		this._name = name;
	}

	get name(): string {
		return this._name;
	}

	// ─── Read ────────────────────────────────────────────────────────────────

	/** Current value — prefer this inside store actions. */
	get value(): T {
		return this._value;
	}

	/** Alias for `.value` — useful in non-reactive contexts. */
	get(): T {
		return this._value;
	}

	// ─── Write ───────────────────────────────────────────────────────────────

	/** Direct assignment — use inside store actions. */
	set value(next: T) {
		if (Object.is(this._value, next)) return;
		this._value = next;
		this._flush();
	}

	/**
	 * Functional or direct update — safe for derived values.
	 * @example atom.set(prev => [...prev, newItem])
	 */
	set(updater: Updater<T>): void {
		const next = isUpdaterFn(updater) ? updater(this._value) : updater;
		this.value = next;
	}

	// ─── Subscriptions ───────────────────────────────────────────────────────

	subscribe(listener: Listener): Unsubscribe {
		this._listeners.add(listener);
		return () => {
			this._listeners.delete(listener);
		};
	}

	/** Number of active subscribers — useful for debugging. */
	get listenerCount(): number {
		return this._listeners.size;
	}

	// ─── Internal ─────────────────────────────────────────────────────────────

	private _flush(): void {
		// Snapshot listeners before scheduling so late-added ones aren't called
		const snapshot = [...this._listeners];
		scheduleNotify(() => snapshot.forEach(l => l()));
	}
}

/**
 * Type helper — strips the Atom wrapper to get the underlying value type.
 * @example type MyValue = AtomValue<Atom<string>> // string
 */
export type AtomValue<A> = A extends Atom<infer T> ? T : never;
