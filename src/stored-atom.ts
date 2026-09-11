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

function detectStorage(): StorageAdapter | null {
	try {
		// Reading the property throws where site data is blocked.
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

let defaultStorage: StorageAdapter | null = detectStorage();
let warned = false;

/**
 * Sets the backend for every stored atom. Call it before the first store is
 * constructed; `localStorage` is used automatically where it exists.
 */
export function configureStorage(storage: StorageAdapter | null): void {
	defaultStorage = storage;
	warned = false;
}

function warnMissingStorage(name: string): void {
	if (warned) return;
	warned = true;
	console.warn(
		`[@7otion/store] No storage adapter, so "${name}" is not persisted. ` +
			'Call configureStorage() before the first store is constructed.',
	);
}

/** An atom that loads from storage on construction and saves on every change. */
export class StoredAtom<T> extends Atom<T> {
	private _key: string;
	private _storage?: StorageAdapter;
	private _initialValue: T;
	private _options?: StoredAtomOptions<T>;

	constructor(key: string, initialValue: T, options?: StoredAtomOptions<T>) {
		super(StoredAtom._load(key, initialValue, options), options);
		this._key = key;
		this._storage = options?.storage;
		this._initialValue = initialValue;
		this._options = options;
	}

	/**
	 * Re-reads the key, for when the backend changed underneath — swapping a
	 * namespaced adapter, say. Notifies subscribers without saving: a reload is
	 * a read, and writing back would persist the initial value for a key that
	 * has none.
	 */
	reload(): void {
		super.value = StoredAtom._load(
			this._key,
			this._initialValue,
			this._options,
		);
	}

	override get value(): T {
		return super.value;
	}

	/** Overriding the setter covers `.set()` too, which assigns through it. */
	override set value(next: T) {
		const version = this._version;
		super.value = next;
		if (this._version !== version) this._save();
	}

	private get _backend(): StorageAdapter | null {
		return this._storage ?? defaultStorage;
	}

	private _save(): void {
		const storage = this._backend;
		if (!storage) {
			warnMissingStorage(this._name);
			return;
		}

		try {
			const raw = JSON.stringify(this._value);
			if (raw === undefined) storage.removeItem(this._key);
			else storage.setItem(this._key, raw);
		} catch {
			// A full or blocked storage must not break the write.
		}
	}

	private static _load<T>(
		key: string,
		initialValue: T,
		options?: StoredAtomOptions<T>,
	): T {
		const storage = options?.storage ?? defaultStorage;
		if (!storage) {
			warnMissingStorage(options?.name ?? key);
			return initialValue;
		}

		try {
			const raw = storage.getItem(key);
			if (raw === null) return initialValue;

			const stored: unknown = JSON.parse(raw);
			if (options?.validate && !options.validate(stored)) {
				return initialValue;
			}
			return stored as T;
		} catch {
			return initialValue;
		}
	}
}
