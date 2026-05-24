import { Atom, type Listener, type Unsubscribe } from './atom';
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
export declare function shallowEqual<T>(a: T, b: T): boolean;
/**
 * A read-only reactive value derived from one or more Atoms.
 * Automatically recomputes when any dependency changes.
 *
 * You never construct Computed directly — use `this.computed()` inside a Store.
 */
export declare class Computed<T> {
    /** @internal */
    readonly _type: "computed";
    private _value;
    private _listeners;
    private _cleanup;
    private _name;
    private _equal;
    constructor(deps: AnyAtom[], compute: () => T, options?: ComputedOptions<T>);
    get name(): string;
    get value(): T;
    get(): T;
    subscribe(listener: Listener): Unsubscribe;
    /** Release dependency subscriptions. Called automatically by Store.destroy(). */
    dispose(): void;
}
export declare function makeComputed<T>(deps: AnyAtom[], compute: () => T, options?: ComputedOptions<T>): Computed<T>;
export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
export {};
//# sourceMappingURL=computed.d.ts.map