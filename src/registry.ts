import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	ReactNode,
} from 'react';
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
export class StoreRegistry {
	private _stores = new Map<StoreKey, Store>();
	private _initialized = new Set<StoreKey>();

	/**
	 * Register a pre-constructed store instance.
	 *
	 * @example
	 * registry.register("todos", new TodoStore());
	 */
	register<S extends Store>(key: StoreKey, store: S): S {
		this._stores.set(key, store);
		return store;
	}

	/**
	 * Get-or-create a store by constructor.
	 * Instantiates once and caches by constructor reference.
	 *
	 * @example
	 * const todos = registry.getOrCreate(TodoStore);
	 */
	getOrCreate<S extends Store>(Ctor: StoreConstructor<S>): S {
		if (!this._stores.has(Ctor as unknown as StoreKey)) {
			this._stores.set(Ctor as unknown as StoreKey, new Ctor());
		}
		return this._stores.get(Ctor as unknown as StoreKey) as S;
	}

	/**
	 * Retrieve a registered store by key. Throws if not found.
	 */
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

	/**
	 * Initialize all registered stores (calls `onInit` lifecycle hook).
	 * Safe to call multiple times — already-initialized stores are skipped.
	 */
	async initAll(): Promise<void> {
		const pending: Promise<void>[] = [];
		for (const [key, store] of this._stores) {
			if (!this._initialized.has(key)) {
				this._initialized.add(key);
				pending.push(store._init());
			}
		}
		await Promise.all(pending);
	}

	/**
	 * Initialize a single store by key.
	 */
	async init(key: StoreKey): Promise<void> {
		const store = this.get(key);
		if (!this._initialized.has(key)) {
			this._initialized.add(key);
			await store._init();
		}
	}

	/**
	 * Destroy all stores and clean up resources.
	 */
	async destroyAll(): Promise<void> {
		const pending = [...this._stores.values()].map(s => s._destroy());
		await Promise.all(pending);
		this._stores.clear();
		this._initialized.clear();
	}
}

/** App-wide singleton registry */
export const registry = new StoreRegistry();

// ─── React Context ────────────────────────────────────────────────────────────

const RegistryContext = createContext<StoreRegistry>(registry);

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
export function StoreProvider({
	children,
	registry: customRegistry,
	autoInit = false,
}: StoreProviderProps) {
	const reg = customRegistry ?? registry;
	const initialized = useRef(false);

	useEffect(() => {
		if (autoInit && !initialized.current) {
			initialized.current = true;
			reg.initAll().catch(console.error);
		}
		return () => {
			if (autoInit) {
				reg.destroyAll().catch(console.error);
			}
		};
	}, [reg, autoInit]);

	return React.createElement(
		RegistryContext.Provider,
		{ value: reg },
		children,
	);
}

/**
 * Access the nearest StoreRegistry from context.
 */
export function useRegistry(): StoreRegistry {
	return useContext(RegistryContext);
}

/**
 * Get a store from the registry by constructor.
 * The store is created if it doesn't exist yet.
 *
 * @example
 * const todoStore = useRegisteredStore(TodoStore);
 * const todos = useAtom(todoStore.todos);
 */
export function useRegisteredStore<S extends Store>(
	Ctor: StoreConstructor<S>,
): S {
	const reg = useRegistry();
	return reg.getOrCreate(Ctor);
}
