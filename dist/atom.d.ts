export type Unsubscribe = () => void;
export type Listener = () => void;
export type Updater<T> = T | ((prev: T) => T);
/**
 * A fine-grained reactive container for a single value.
 *
 * Atoms are the state variables in a Store. Setting their value
 * notifies only the subscribers watching that specific atom,
 * giving you precise control over re-renders.
 *
 * You never construct Atoms directly — use `this.atom()` inside a Store.
 */
export declare class Atom<T> {
    /** @internal */
    readonly _type: "atom";
    private _value;
    private _listeners;
    private _name;
    constructor(initialValue: T, name?: string);
    get name(): string;
    /** Current value — prefer this inside store actions. */
    get value(): T;
    /** Alias for `.value` — useful in non-reactive contexts. */
    get(): T;
    /** Direct assignment — use inside store actions. */
    set value(next: T);
    /**
     * Functional or direct update — safe for derived values.
     * @example atom.set(prev => [...prev, newItem])
     */
    set(updater: Updater<T>): void;
    subscribe(listener: Listener): Unsubscribe;
    /** Number of active subscribers — useful for debugging. */
    get listenerCount(): number;
    private _flush;
}
/**
 * Type helper — strips the Atom wrapper to get the underlying value type.
 * @example type MyValue = AtomValue<Atom<string>> // string
 */
export type AtomValue<A> = A extends Atom<infer T> ? T : never;
//# sourceMappingURL=atom.d.ts.map