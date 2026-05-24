import { Atom, type Listener, type Unsubscribe } from './atom';
import { scheduleNotify } from './batch';

type AnyAtom = Atom<any>;

export type EqualFn<T> = (prev: T, next: T) => boolean;

export interface ComputedOptions<T> {
	equal?: EqualFn<T>;
	name?: string;
}

/**
 * Shallow equality — compares one level of object keys by Object.is.
 * Use as the `equal` option when your compute function returns a plain object
 * so the computed only notifies when a property actually changes value.
 *
 * @example
 * readonly current = this.computed(
 *   [this.name, this.tags],
 *   () => ({ name: this.name.get(), tags: this.tags.get() }),
 *   { equal: shallowEqual }
 * );
 */
export function shallowEqual<T>(a: T, b: T): boolean {
	if (Object.is(a, b)) return true;
	if (
		typeof a !== 'object' ||
		a === null ||
		typeof b !== 'object' ||
		b === null
	)
		return false;
	const keysA = Object.keys(a as object);
	const keysB = Object.keys(b as object);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!Object.is((a as any)[key], (b as any)[key])) return false;
	}
	return true;
}

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
	private _equal: EqualFn<T>;

	constructor(
		deps: AnyAtom[],
		compute: () => T,
		options?: ComputedOptions<T>,
	) {
		this._name = options?.name ?? 'computed';
		this._equal = options?.equal ?? Object.is;
		this._value = compute();

		this._cleanup = deps.map(dep =>
			dep.subscribe(() => {
				const next = compute();
				if (this._equal(this._value, next)) return;
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

export function makeComputed<T>(
	deps: AnyAtom[],
	compute: () => T,
	options?: ComputedOptions<T>,
): Computed<T> {
	return new Computed(deps, compute, options);
}

export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
