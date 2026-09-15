import { Atom, type AtomOptions } from './atom';
import type { HeldClass } from './change-source';
import { Computed, type ComputedOptions } from './computed';
import {
	type EffectCleanup,
	type EffectOptions,
	effect as createEffect,
} from './effect';
import { Derived, ReactiveNode, type Unsubscribe } from './graph';
import { StoredAtom, type StoredAtomOptions } from './stored-atom';

type AnyAtom = Atom<any>;
type AnyComputed = Computed<any>;
type AnyNode = ReactiveNode<unknown>;

/** Base class for stores: owns atoms, computeds, effects and actions. */
export abstract class Store {
	private _effects: Unsubscribe[] = [];
	private _families: Map<unknown, Computed<unknown>>[] = [];
	private _namesHydrated = false;

	// ─── Factories ───────────────────────────────────────────────────────────

	protected atom<T>(initialValue: T, options?: AtomOptions<T>): Atom<T> {
		return new Atom<T>(initialValue, options);
	}

	/** An atom about instances of `cls`, republished when a change source reports one. Empty list unless a value is given. */
	protected atomOf<C extends HeldClass>(
		cls: C | C[],
	): Atom<InstanceType<C>[]>;
	protected atomOf<C extends HeldClass, T>(
		cls: C | C[],
		initialValue: T,
		options?: AtomOptions<T>,
	): Atom<T>;
	protected atomOf<C extends HeldClass, T>(
		cls: C | C[],
		...rest: [] | [T, AtomOptions<T>?]
	): Atom<T> | Atom<InstanceType<C>[]> {
		if (rest.length === 0) {
			return new Atom<InstanceType<C>[]>([])._about(cls);
		}
		const [initialValue, options] = rest;
		return new Atom<T>(initialValue, options)._about(cls);
	}

	/** Loaded from storage on construction, saved on every change. */
	protected storedAtom<T>(
		key: string,
		initialValue: T,
		options?: StoredAtomOptions<T>,
	): StoredAtom<T> {
		return new StoredAtom<T>(key, initialValue, options);
	}

	/** Lazy, and tracked by what the function reads. */
	protected computed<T>(
		compute: () => T,
		options?: ComputedOptions<T>,
	): Computed<T> {
		return new Computed<T>(compute, options);
	}

	/** Stopped on destroy. Create in `onInit`, not in a field initializer. */
	protected effect(
		fn: () => EffectCleanup,
		options?: EffectOptions,
	): Unsubscribe {
		const stop = createEffect(fn, options);
		this._effects.push(stop);
		return stop;
	}

	/** A computed per key, created on demand and cached until destroy. */
	protected family<K, T>(
		compute: (key: K) => T,
		options?: ComputedOptions<T>,
	): Family<K, T> {
		const cache = new Map<K, Computed<T>>();
		this._families.push(cache as Map<unknown, Computed<unknown>>);

		const family = (key: K): Computed<T> => {
			let node = cache.get(key);
			if (!node) {
				node = new Computed<T>(() => compute(key), {
					...options,
					name: `${options?.name ?? 'family'}[${String(key)}]`,
				});
				cache.set(key, node);
			}
			return node;
		};

		family.delete = (key: K): boolean => {
			const node = cache.get(key);
			if (!node) return false;
			node.dispose();
			return cache.delete(key);
		};
		family.clear = (): void => {
			for (const node of cache.values()) node.dispose();
			cache.clear();
		};
		Object.defineProperty(family, 'size', { get: () => cache.size });

		return family as Family<K, T>;
	}

	// ─── Lifecycle ───────────────────────────────────────────────────────────

	protected async onInit(): Promise<void> {}

	protected async onDestroy(): Promise<void> {}

	/** @internal */
	async _init(): Promise<void> {
		this._hydrateNames();
		await this.onInit();
	}

	/** @internal */
	async _destroy(): Promise<void> {
		await this.onDestroy();

		for (const stop of this._effects.splice(0)) stop();
		for (const cache of this._families) {
			for (const node of cache.values()) node.dispose();
			cache.clear();
		}
		for (const [, node] of this._ownNodes()) {
			if (node instanceof Derived) node.dispose();
			if (node instanceof Atom) node._unregister();
		}
	}

	// ─── Persistence ─────────────────────────────────────────────────────────

	/** Re-reads every stored atom this store owns. */
	reloadStored(): void {
		for (const [, node] of this._ownNodes()) {
			if (node instanceof StoredAtom) node.reload();
		}
	}

	// ─── Internal ────────────────────────────────────────────────────────────

	/** Read via descriptors so user-defined getters are not invoked. */
	private *_ownNodes(): Generator<[string, AnyNode]> {
		for (const key of Object.getOwnPropertyNames(this)) {
			const value = Object.getOwnPropertyDescriptor(this, key)?.value;
			if (value instanceof ReactiveNode) yield [key, value as AnyNode];
		}
	}

	/** Lazy: class field initializers run after the base constructor. */
	private _hydrateNames(): void {
		if (this._namesHydrated) return;
		this._namesHydrated = true;
		for (const [key, node] of this._ownNodes()) {
			node._setName(`${this.constructor.name}.${key}`);
		}
	}
}

// ─── Family ───────────────────────────────────────────────────────────────────

export interface Family<K, T> {
	(key: K): Computed<T>;
	/** Drops and disposes one key's node. */
	delete(key: K): boolean;
	/** Drops and disposes every cached node. */
	clear(): void;
	readonly size: number;
}

// ─── Type utilities ───────────────────────────────────────────────────────────

export type StoreAtoms<S extends Store> = {
	[K in keyof S as S[K] extends AnyAtom ? K : never]: S[K];
};

export type StoreComputeds<S extends Store> = {
	[K in keyof S as S[K] extends AnyComputed ? K : never]: S[K];
};

export type StoreActions<S extends Store> = {
	[
		K in keyof S as S[K] extends (...args: unknown[]) => unknown ? K : never
	]: S[K];
};
