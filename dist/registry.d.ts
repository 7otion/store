import React, { ReactNode } from 'react';
import { Store } from './store';
type StoreKey = string | symbol;
type StoreConstructor<S extends Store> = new () => S;
/**
 * Central registry for store instances.
 *
 * Stores are lazily instantiated and cached. Use the singleton `registry`
 * export for app-wide stores, or create a new `StoreRegistry` for
 * scoped/isolated contexts (e.g. per-window in Tauri).
 */
export declare class StoreRegistry {
    private _stores;
    private _initialized;
    /**
     * Register a pre-constructed store instance.
     *
     * @example
     * registry.register("todos", new TodoStore());
     */
    register<S extends Store>(key: StoreKey, store: S): S;
    /**
     * Get-or-create a store by constructor.
     * Instantiates once and caches by constructor reference.
     *
     * @example
     * const todos = registry.getOrCreate(TodoStore);
     */
    getOrCreate<S extends Store>(Ctor: StoreConstructor<S>): S;
    /**
     * Retrieve a registered store by key. Throws if not found.
     */
    get<S extends Store>(key: StoreKey): S;
    has(key: StoreKey): boolean;
    /**
     * Initialize all registered stores (calls `onInit` lifecycle hook).
     * Safe to call multiple times — already-initialized stores are skipped.
     */
    initAll(): Promise<void>;
    /**
     * Initialize a single store by key.
     */
    init(key: StoreKey): Promise<void>;
    /**
     * Destroy all stores and clean up resources.
     */
    destroyAll(): Promise<void>;
}
/** App-wide singleton registry */
export declare const registry: StoreRegistry;
interface StoreProviderProps {
    children: ReactNode;
    /** Pass a custom registry for isolated contexts. Defaults to the global `registry`. */
    registry?: StoreRegistry;
    /** If true, calls `registry.initAll()` on mount and `registry.destroyAll()` on unmount. */
    autoInit?: boolean;
}
/**
 * Provides a StoreRegistry to the React tree.
 *
 * @example
 * <StoreProvider autoInit>
 *   <App />
 * </StoreProvider>
 */
export declare function StoreProvider({ children, registry: customRegistry, autoInit, }: StoreProviderProps): React.FunctionComponentElement<React.ProviderProps<StoreRegistry>>;
/**
 * Access the nearest StoreRegistry from context.
 */
export declare function useRegistry(): StoreRegistry;
/**
 * Get a store from the registry by constructor.
 * The store is created if it doesn't exist yet.
 *
 * @example
 * const todoStore = useRegisteredStore(TodoStore);
 * const todos = useAtom(todoStore.todos);
 */
export declare function useRegisteredStore<S extends Store>(Ctor: StoreConstructor<S>): S;
export {};
//# sourceMappingURL=registry.d.ts.map