import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { Store } from './store';

type StoreKey = string | symbol;
type StoreConstructor<S extends Store> = new () => S;

/** Owns store instances and their init/destroy lifecycle. */
export class StoreRegistry {
	private _stores = new Map<StoreKey, Store>();
	private _initialized = new Set<StoreKey>();

	/** Live `StoreProvider`s holding this registry open. */
	private _refCount = 0;
	/** In-flight `initAll()`, awaited before teardown. */
	private _initPromise: Promise<void> | null = null;
	/** Identity token for a scheduled teardown, so a re-retain can cancel it. */
	private _pendingRelease: object | null = null;

	register<S extends Store>(key: StoreKey, store: S): S {
		this._stores.set(key, store);
		return store;
	}

	/** Instantiates once, cached by constructor reference. */
	getOrCreate<S extends Store>(Ctor: StoreConstructor<S>): S {
		const key = Ctor as unknown as StoreKey;
		let store = this._stores.get(key);
		if (!store) {
			store = new Ctor();
			this._stores.set(key, store);
		}
		return store as S;
	}

	/** Throws if the key is not registered. */
	get<S extends Store>(key: StoreKey): S {
		const store = this._stores.get(key);
		if (!store) {
			throw new Error(
				`Store not found: ${String(key)}. Did you forget to register it?`,
			);
		}
		return store as S;
	}

	has(key: StoreKey): boolean {
		return this._stores.has(key);
	}

	get stores(): readonly Store[] {
		return [...this._stores.values()];
	}

	/** Idempotent. A store whose `onInit` rejects is left uninitialized. */
	async initAll(): Promise<void> {
		const pending: Promise<void>[] = [];
		for (const [key, store] of this._stores) {
			if (this._initialized.has(key)) continue;
			this._initialized.add(key);
			pending.push(
				store._init().catch(err => {
					this._initialized.delete(key);
					throw err;
				}),
			);
		}
		await Promise.all(pending);
	}

	async init(key: StoreKey): Promise<void> {
		const store = this.get(key);
		if (this._initialized.has(key)) return;
		this._initialized.add(key);
		try {
			await store._init();
		} catch (err) {
			this._initialized.delete(key);
			throw err;
		}
	}

	/** Keeps registrations, so the registry can be initialized again. */
	async destroyAll(): Promise<void> {
		if (this._initPromise) {
			await this._initPromise.catch(() => {});
			this._initPromise = null;
		}
		await Promise.all([...this._stores.values()].map(s => s._destroy()));
		this._initialized.clear();
	}

	/** Destroys every store and drops all registrations. */
	async clear(): Promise<void> {
		await this.destroyAll();
		this._stores.clear();
		this._refCount = 0;
		this._pendingRelease = null;
	}

	// ─── Provider lifecycle ──────────────────────────────────────────────────

	/** @internal */
	_retain(): Promise<void> {
		this._refCount++;
		this._pendingRelease = null;
		if (!this._initPromise) this._initPromise = this.initAll();
		return this._initPromise;
	}

	/** @internal */
	_release(): void {
		this._refCount = Math.max(0, this._refCount - 1);
		if (this._refCount > 0) return;

		// StrictMode's unmount → remount pair runs synchronously, so deferring
		// by a microtask lets the remount cancel this.
		const token = {};
		this._pendingRelease = token;
		queueMicrotask(() => {
			if (this._pendingRelease !== token) return;
			this._pendingRelease = null;
			void this.destroyAll().catch(err => {
				console.error('[o7-store] destroyAll failed:', err);
			});
		});
	}

	/** @internal */
	get _providerCount(): number {
		return this._refCount;
	}
}

export const registry = new StoreRegistry();

// ─── React Context ────────────────────────────────────────────────────────────

const RegistryContext = createContext<StoreRegistry>(registry);

interface StoreProviderProps {
	children: ReactNode;
	/** Defaults to the global `registry`. */
	registry?: StoreRegistry;
	/** Initializes registered stores on mount, destroys them on unmount. */
	autoInit?: boolean;
}

export function StoreProvider({
	children,
	registry: customRegistry,
	autoInit = false,
}: StoreProviderProps) {
	const reg = customRegistry ?? registry;

	useEffect(() => {
		if (!autoInit) return;
		reg._retain().catch(err => {
			console.error('[o7-store] store initialization failed:', err);
		});
		return () => reg._release();
	}, [reg, autoInit]);

	return React.createElement(
		RegistryContext.Provider,
		{ value: reg },
		children,
	);
}

export function useRegistry(): StoreRegistry {
	return useContext(RegistryContext);
}

/** Creates the store if the registry does not have it yet. */
export function useRegisteredStore<S extends Store>(
	Ctor: StoreConstructor<S>,
): S {
	const reg = useRegistry();
	return reg.getOrCreate(Ctor);
}
