import {
	DIRTY,
	type EqualFn,
	ReactiveNode,
	enqueue,
	flush,
	track,
} from './graph';

export type { Unsubscribe, Listener, EqualFn } from './graph';

export type Updater<T> = T | ((prev: T) => T);

export interface AtomOptions<T> {
	/** Decides whether a write is a change. Defaults to `Object.is`. */
	equals?: EqualFn<T>;
	name?: string;
}

/** A reactive value. Construct with `this.atom()` inside a Store. */
export class Atom<T> extends ReactiveNode<T> {
	/** @internal */
	readonly _type = 'atom' as const;

	private _equals: EqualFn<T>;

	constructor(initialValue: T, options?: AtomOptions<T>) {
		super(options?.name ?? 'atom');
		this._value = initialValue;
		this._equals = options?.equals ?? Object.is;
	}

	_update(): void {}

	// ─── Read ────────────────────────────────────────────────────────────────

	get value(): T {
		track(this);
		return this._value;
	}

	// ─── Write ───────────────────────────────────────────────────────────────

	/** Stores a function as the value rather than calling it, unlike {@link set}. */
	set value(next: T) {
		if (this._equals(this._value, next)) return;

		this._value = next;
		this._version++;

		for (const observer of this._observers) observer._markStale(DIRTY);
		if (this._watched) enqueue(this);

		flush();
	}

	/** A function argument is always an updater; assign `.value` to store one. */
	set(updater: Updater<T>): void {
		const next =
			typeof updater === 'function'
				? (updater as (prev: T) => T)(this._value)
				: updater;
		this.value = next;
	}
}

export type AtomValue<A> = A extends Atom<infer T> ? T : never;
