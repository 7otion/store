/** The synchronous subset of the Web Storage API a stored atom needs. */
export interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    /** Every key held. Backends that can enumerate enable `clearNamespace`. */
    keys?(): string[];
}
/** `localStorage`, guarded: reading it throws where site data is blocked. */
export declare const localStorageAdapter: StorageAdapter;
/**
 * Sets the backend for every stored atom. Call it before the first store is
 * constructed; `localStorage` is used automatically where it exists.
 */
export declare function configureStorage(storage: StorageAdapter | null): void;
/** @internal */
export declare function currentStorage(): StorageAdapter | null;
/** @internal */
export declare function warnMissingStorage(name: string): void;
/**
 * Puts every key under a prefix the caller controls — one namespace per
 * project, tenant or user. A `null` prefix stores nothing, so state cannot
 * leak into a shared bucket while no namespace is chosen.
 */
export declare function namespaced(adapter: StorageAdapter, prefix: () => string | null): StorageAdapter;
/**
 * Drops every key under `prefix`, whether or not that namespace is the current
 * one. Returns false if the backend cannot enumerate its keys.
 */
export declare function clearNamespace(adapter: StorageAdapter, prefix: string): boolean;
//# sourceMappingURL=storage.d.ts.map