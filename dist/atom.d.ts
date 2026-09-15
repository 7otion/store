import { type EqualFn, ReactiveNode } from './graph';
import { type HeldClass } from './change-source';
export type { Unsubscribe, Listener, EqualFn } from './graph';
export type Updater<T> = T | ((prev: T) => T);
export interface AtomOptions<T> {
    /** Decides whether a write is a change. Defaults to `Object.is`. */
    equals?: EqualFn<T>;
    name?: string;
}
/** A reactive value. Construct with `this.atom()` inside a Store. */
export declare class Atom<T> extends ReactiveNode<T> {
    /** @internal */
    readonly _type: "atom";
    private _equals;
    private _holds;
    constructor(initialValue: T, options?: AtomOptions<T>);
    /** @internal Set by `Store.atomOf`: the classes a change source republishes this atom for. */
    _about(classes: HeldClass | HeldClass[]): this;
    _update(): void;
    get value(): T;
    /** Stores a function as the value rather than calling it, unlike {@link set}. */
    set value(next: T);
    /** A function argument is always an updater; assign `.value` to store one. */
    set(updater: Updater<T>): void;
    /** Notifies as if the value had changed, for a value changed in place. */
    touch(): void;
    /** @internal Whether any of these instances shows through a class this atom holds. */
    _holdsAny(changed: readonly object[]): boolean;
    /** @internal */
    _unregister(): void;
}
export type AtomValue<A> = A extends Atom<infer T> ? T : never;
//# sourceMappingURL=atom.d.ts.map