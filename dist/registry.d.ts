import React, { ReactNode } from 'react';
import { Store } from './store';
type StoreKey = string | symbol;
type StoreConstructor<S extends Store> = new () => S;
/** Owns store instances and their init/destroy lifecycle. */
export declare class StoreRegistry {
    private _stores;
    private _initialized;
    /** Live `StoreProvider`s holding this registry open. */
    private _refCount;
    /** In-flight `initAll()`, awaited before teardown. */
    private _initPromise;
    /** Identity token for a scheduled teardown, so a re-retain can cancel it. */
    private _pendingRelease;
    register<S extends Store>(key: StoreKey, store: S): S;
    /** Instantiates once, cached by constructor reference. */
    getOrCreate<S extends Store>(Ctor: StoreConstructor<S>): S;
    /** Throws if the key is not registered. */
    get<S extends Store>(key: StoreKey): S;
    has(key: StoreKey): boolean;
    get stores(): readonly Store[];
    /** Idempotent. A store whose `onInit` rejects is left uninitialized. */
    initAll(): Promise<void>;
    init(key: StoreKey): Promise<void>;
    /** Keeps registrations, so the registry can be initialized again. */
    destroyAll(): Promise<void>;
    /** Destroys every store and drops all registrations. */
    clear(): Promise<void>;
    /** @internal */
    _retain(): Promise<void>;
    /** @internal */
    _release(): void;
    /** @internal */
    get _providerCount(): number;
}
export declare const registry: StoreRegistry;
interface StoreProviderProps {
    children: ReactNode;
    /** Defaults to the global `registry`. */
    registry?: StoreRegistry;
    /** Initializes registered stores on mount, destroys them on unmount. */
    autoInit?: boolean;
}
export declare function StoreProvider({ children, registry: customRegistry, autoInit, }: StoreProviderProps): React.FunctionComponentElement<React.ProviderProps<StoreRegistry>>;
export declare function useRegistry(): StoreRegistry;
/** Creates the store if the registry does not have it yet. */
export declare function useRegisteredStore<S extends Store>(Ctor: StoreConstructor<S>): S;
export {};
//# sourceMappingURL=registry.d.ts.map