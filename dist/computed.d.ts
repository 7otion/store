import { Atom, type Listener, type Unsubscribe } from './atom';
type AnyAtom = Atom<any>;
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
    constructor(deps: AnyAtom[], compute: () => T, name?: string);
    get name(): string;
    get value(): T;
    get(): T;
    subscribe(listener: Listener): Unsubscribe;
    /** Release dependency subscriptions. Called automatically by Store.destroy(). */
    dispose(): void;
}
/**
 * Typed overloads so that `this.computed([a, b], (va, vb) => ...)` infers
 * the correct argument types for the compute function.
 */
export declare function makeComputed<T>(deps: AnyAtom[], compute: () => T, name?: string): Computed<T>;
export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
export {};
//# sourceMappingURL=computed.d.ts.map