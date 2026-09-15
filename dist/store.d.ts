import { Atom, type AtomOptions } from './atom';
import type { HeldClass } from './change-source';
import { Computed, type ComputedOptions } from './computed';
import { type EffectCleanup, type EffectOptions } from './effect';
import { type Unsubscribe } from './graph';
import { StoredAtom, type StoredAtomOptions } from './stored-atom';
type AnyAtom = Atom<any>;
type AnyComputed = Computed<any>;
/** Base class for stores: owns atoms, computeds, effects and actions. */
export declare abstract class Store {
    private _effects;
    private _families;
    private _namesHydrated;
    protected atom<T>(initialValue: T, options?: AtomOptions<T>): Atom<T>;
    /** An atom about instances of `cls`, republished when a change source reports one. Empty list unless a value is given. */
    protected atomOf<C extends HeldClass>(cls: C | C[]): Atom<InstanceType<C>[]>;
    protected atomOf<C extends HeldClass, T>(cls: C | C[], initialValue: T, options?: AtomOptions<T>): Atom<T>;
    /** Loaded from storage on construction, saved on every change. */
    protected storedAtom<T>(key: string, initialValue: T, options?: StoredAtomOptions<T>): StoredAtom<T>;
    /** Lazy, and tracked by what the function reads. */
    protected computed<T>(compute: () => T, options?: ComputedOptions<T>): Computed<T>;
    /** Stopped on destroy. Create in `onInit`, not in a field initializer. */
    protected effect(fn: () => EffectCleanup, options?: EffectOptions): Unsubscribe;
    /** A computed per key, created on demand and cached until destroy. */
    protected family<K, T>(compute: (key: K) => T, options?: ComputedOptions<T>): Family<K, T>;
    protected onInit(): Promise<void>;
    protected onDestroy(): Promise<void>;
    /** @internal */
    _init(): Promise<void>;
    /** @internal */
    _destroy(): Promise<void>;
    /** Re-reads every stored atom this store owns. */
    reloadStored(): void;
    /** Read via descriptors so user-defined getters are not invoked. */
    private _ownNodes;
    /** Lazy: class field initializers run after the base constructor. */
    private _hydrateNames;
}
export interface Family<K, T> {
    (key: K): Computed<T>;
    /** Drops and disposes one key's node. */
    delete(key: K): boolean;
    /** Drops and disposes every cached node. */
    clear(): void;
    readonly size: number;
}
export type StoreAtoms<S extends Store> = {
    [K in keyof S as S[K] extends AnyAtom ? K : never]: S[K];
};
export type StoreComputeds<S extends Store> = {
    [K in keyof S as S[K] extends AnyComputed ? K : never]: S[K];
};
export type StoreActions<S extends Store> = {
    [K in keyof S as S[K] extends (...args: unknown[]) => unknown ? K : never]: S[K];
};
export {};
//# sourceMappingURL=store.d.ts.map