import { Atom, type Listener, type Unsubscribe } from './atom';
import { scheduleNotify } from './batch';

type AnyAtom = Atom<any>;

/**
 * A read-only reactive value derived from one or more Atoms.
 * Automatically recomputes when any dependency changes.
 *
 * You never construct Computed directly — use `this.computed()` inside a Store.
 */
export class Computed<T> {
	/** @internal */
	readonly _type = 'computed' as const;

	private _value: T;
	private _listeners = new Set<Listener>();
	private _cleanup: Unsubscribe[] = [];
	private _name: string;

	constructor(deps: AnyAtom[], compute: () => T, name = 'computed') {
		this._name = name;
		this._value = compute();

		this._cleanup = deps.map(dep =>
			dep.subscribe(() => {
				const next = compute();
				if (Object.is(this._value, next)) return;
				this._value = next;
				const snapshot = [...this._listeners];
				scheduleNotify(() => snapshot.forEach(l => l()));
			}),
		);
	}

	get name(): string {
		return this._name;
	}

	get value(): T {
		return this._value;
	}

	get(): T {
		return this._value;
	}

	subscribe(listener: Listener): Unsubscribe {
		this._listeners.add(listener);
		return () => {
			this._listeners.delete(listener);
		};
	}

	/** Release dependency subscriptions. Called automatically by Store.destroy(). */
	dispose(): void {
		this._cleanup.forEach(u => u());
		this._cleanup = [];
		this._listeners.clear();
	}
}

// ─── Builder helpers (used internally by Store) ───────────────────────────────

/**
 * Typed overloads so that `this.computed([a, b], (va, vb) => ...)` infers
 * the correct argument types for the compute function.
 */
export function makeComputed<T>(
	deps: AnyAtom[],
	compute: () => T,
	name?: string,
): Computed<T> {
	return new Computed(deps, compute, name);
}

export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
