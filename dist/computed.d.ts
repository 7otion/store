import { Derived, type EqualFn } from './graph';
export interface ComputedOptions<T> {
    /** Decides whether a recomputed result is a change. Defaults to `Object.is`. */
    equals?: EqualFn<T>;
    name?: string;
}
/** Compares one level of object keys by `Object.is`. */
export declare function shallowEqual<T>(a: T, b: T): boolean;
/**
 * A lazy derived value. Dependencies are whatever the function reads.
 * Construct with `this.computed()` inside a Store.
 */
export declare class Computed<T> extends Derived<T> {
    /** @internal */
    readonly _type: "computed";
    private _compute;
    private _equals;
    private _initialized;
    constructor(compute: () => T, options?: ComputedOptions<T>);
    protected _run(): void;
    dispose(): void;
}
export type ComputedValue<C> = C extends Computed<infer T> ? T : never;
//# sourceMappingURL=computed.d.ts.map