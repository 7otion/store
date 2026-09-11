/** The synchronous subset of the Web Storage API a stored atom needs. */
export interface StorageAdapter {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
	/** Every key held. Backends that can enumerate enable `clearNamespace`. */
	keys?(): string[];
}

/** `localStorage`, guarded: reading it throws where site data is blocked. */
export const localStorageAdapter: StorageAdapter = {
	getItem(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	setItem(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			// A full or blocked storage must not break the write.
		}
	},
	removeItem(key) {
		try {
			localStorage.removeItem(key);
		} catch {
			//
		}
	},
	keys() {
		try {
			return Object.keys(localStorage);
		} catch {
			return [];
		}
	},
};

function detectStorage(): StorageAdapter | null {
	try {
		return globalThis.localStorage ? localStorageAdapter : null;
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

/** @internal */
export function currentStorage(): StorageAdapter | null {
	return defaultStorage;
}

/** @internal */
export function warnMissingStorage(name: string): void {
	if (warned) return;
	warned = true;
	console.warn(
		`[@7otion/store] No storage adapter, so "${name}" is not persisted. ` +
			'Call configureStorage() before the first store is constructed.',
	);
}

/**
 * Puts every key under a prefix the caller controls — one namespace per
 * project, tenant or user. A `null` prefix stores nothing, so state cannot
 * leak into a shared bucket while no namespace is chosen.
 */
export function namespaced(
	adapter: StorageAdapter,
	prefix: () => string | null,
): StorageAdapter {
	const enumerate = adapter.keys;

	return {
		getItem(key) {
			const at = prefix();
			return at === null ? null : adapter.getItem(at + key);
		},
		setItem(key, value) {
			const at = prefix();
			if (at !== null) adapter.setItem(at + key, value);
		},
		removeItem(key) {
			const at = prefix();
			if (at !== null) adapter.removeItem(at + key);
		},
		keys: enumerate
			? () => {
					const at = prefix();
					if (at === null) return [];
					return enumerate
						.call(adapter)
						.filter(key => key.startsWith(at))
						.map(key => key.slice(at.length));
				}
			: undefined,
	};
}

/**
 * Drops every key under `prefix`, whether or not that namespace is the current
 * one. Returns false if the backend cannot enumerate its keys.
 */
export function clearNamespace(
	adapter: StorageAdapter,
	prefix: string,
): boolean {
	if (!adapter.keys) return false;
	for (const key of adapter.keys()) {
		if (key.startsWith(prefix)) adapter.removeItem(key);
	}
	return true;
}
