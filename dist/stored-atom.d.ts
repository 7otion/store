import { Atom, type AtomOptions } from './atom';
/** The synchronous subset of the Web Storage API a stored atom needs. */
export interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export interface StoredAtomOptions<T> extends AtomOptions<T> {
    /** Rejects a stored value; a rejected one falls back to the initial value. */
    validate?: (value: unknown) => boolean;
    storage?: StorageAdapter;
}
/**
 * Sets the backend for every stored atom. Call it before the first store is
 * constructed; `localStorage` is used automatically where it exists.
 */
export declare function configureStorage(storage: StorageAdapter | null): void;
/** An atom that loads from storage on construction and saves on every change. */
export declare class StoredAtom<T> extends Atom<T> {
    private _key;
    private _storage?;
    constructor(key: string, initialValue: T, options?: StoredAtomOptions<T>);
    get value(): T;
    /** Overriding the setter covers `.set()` too, which assigns through it. */
    set value(next: T);
    private get _backend();
    private _save;
    private static _load;
}
//# sourceMappingURL=stored-atom.d.ts.map