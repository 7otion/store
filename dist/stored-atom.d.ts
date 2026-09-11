import { Atom, type AtomOptions } from './atom';
import { type StorageAdapter } from './storage';
export interface StoredAtomOptions<T> extends AtomOptions<T> {
    /** Rejects a stored value; a rejected one falls back to the initial value. */
    validate?: (value: unknown) => boolean;
    storage?: StorageAdapter;
}
/** An atom that loads from storage on construction and saves on every change. */
export declare class StoredAtom<T> extends Atom<T> {
    private _key;
    private _storage?;
    private _initialValue;
    private _options?;
    constructor(key: string, initialValue: T, options?: StoredAtomOptions<T>);
    /**
     * Re-reads the key, for when the backend changed underneath — swapping a
     * namespaced adapter, say. Notifies subscribers without saving: a reload is
     * a read, and writing back would persist the initial value for a key that
     * has none.
     */
    reload(): void;
    get value(): T;
    /** Overriding the setter covers `.set()` too, which assigns through it. */
    set value(next: T);
    private get _backend();
    private _save;
    private static _load;
}
//# sourceMappingURL=stored-atom.d.ts.map