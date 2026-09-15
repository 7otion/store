import { Derived, type EqualFn } from './graph';

export interface ComputedOptions<T> {
	/** Decides whether a recomputed result is a change. Defaults to `Object.is`. */
	equals?: EqualFn<T>;
	name?: string;
}

/** Compares one level of object keys by `Object.is`. */
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
		if (!Object.is((a as never)[key], (b as never)[key])) return false;
	}
	return true;
}

/**
 * A lazy derived value. Dependencies are whatever the function reads.
 * Construct with `this.computed()` inside a Store.
 */
export class Computed<T> extends Derived<T> {
	/** @internal */
	readonly _type = 'computed' as const;

	private _compute: () => T;
	private _equals: EqualFn<T>;
	private _initialized = false;

	constructor(compute: () => T, options?: ComputedOptions<T>) {
		super(options?.name ?? 'computed');
		this._compute = compute;
		this._equals = options?.equals ?? Object.is;
	}

	protected _run(): void {
		const next = this._compute();

		if (!this._initialized) {
			this._initialized = true;
			this._value = next;
			this._version++;
			return;
		}

		// Holding the version still stops propagation at this node. A touch
		// passes through even when the result is the same object.
		if (this._touched || !this._equals(this._value, next)) {
			this._value = next;
			this._version++;
		}
	}

	override dispose(): void {
		super.dispose();
		this._initialized = false;
	}
}

export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
