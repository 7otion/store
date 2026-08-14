import { type EqualFn, ReactiveNode } from './graph';
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
    constructor(initialValue: T, options?: AtomOptions<T>);
    _update(): void;
    get value(): T;
    /** Stores a function as the value rather than calling it, unlike {@link set}. */
    set value(next: T);
    /** A function argument is always an updater; assign `.value` to store one. */
    set(updater: Updater<T>): void;
}
export type AtomValue<A> = A extends Atom<infer T> ? T : never;
//# sourceMappingURL=atom.d.ts.map