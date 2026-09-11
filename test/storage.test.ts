import { afterEach, describe, expect, it } from 'bun:test';
import {
	clearNamespace,
	localStorageAdapter,
	namespaced,
	type StorageAdapter,
} from '../src/storage';

function memoryStorage(seed: Record<string, string> = {}): StorageAdapter {
	const map = new Map(Object.entries(seed));
	return {
		getItem: key => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: key => void map.delete(key),
		keys: () => [...map.keys()],
	};
}

/** A backend that cannot enumerate, like a bare cookie or keychain shim. */
function opaqueStorage(): StorageAdapter {
	const map = new Map<string, string>();
	return {
		getItem: key => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: key => void map.delete(key),
	};
}

afterEach(() => {
	localStorage.clear();
});

describe('localStorageAdapter', () => {
	it('round-trips and enumerates', () => {
		localStorageAdapter.setItem('a', '1');
		localStorageAdapter.setItem('b', '2');

		expect(localStorageAdapter.getItem('a')).toBe('1');
		expect(localStorageAdapter.keys?.()).toContain('b');

		localStorageAdapter.removeItem('a');
		expect(localStorageAdapter.getItem('a')).toBeNull();
	});
});

describe('namespaced', () => {
	it('prefixes every key', () => {
		const backing = memoryStorage();
		const scoped = namespaced(backing, () => 'proj.alpha.');

		scoped.setItem('view', '"grid"');

		expect(backing.getItem('proj.alpha.view')).toBe('"grid"');
		expect(scoped.getItem('view')).toBe('"grid"');
		expect(backing.getItem('view')).toBeNull();
	});

	it('keeps namespaces apart', () => {
		const backing = memoryStorage();
		let project = 'alpha';
		const scoped = namespaced(backing, () => `proj.${project}.`);

		scoped.setItem('view', '"grid"');
		project = 'beta';

		expect(scoped.getItem('view')).toBeNull();
		scoped.setItem('view', '"list"');

		project = 'alpha';
		expect(scoped.getItem('view')).toBe('"grid"');
	});

	it('lists its own keys without the prefix', () => {
		const backing = memoryStorage({ 'other.thing': 'x' });
		const scoped = namespaced(backing, () => 'proj.alpha.');
		scoped.setItem('view', '"grid"');

		expect(scoped.keys?.()).toEqual(['view']);
	});

	it('stores nothing while the prefix is null', () => {
		const backing = memoryStorage();
		const scoped = namespaced(backing, () => null);

		scoped.setItem('view', '"grid"');

		expect(scoped.getItem('view')).toBeNull();
		expect(backing.keys?.()).toEqual([]);
		expect(scoped.keys?.()).toEqual([]);
	});

	it('drops enumeration when the backend has none', () => {
		const scoped = namespaced(opaqueStorage(), () => 'proj.alpha.');
		expect(scoped.keys).toBeUndefined();
	});

	it('removes through the prefix', () => {
		const backing = memoryStorage();
		const scoped = namespaced(backing, () => 'proj.alpha.');
		scoped.setItem('view', '"grid"');

		scoped.removeItem('view');

		expect(backing.keys?.()).toEqual([]);
	});
});

describe('clearNamespace', () => {
	it('drops one namespace and leaves the rest', () => {
		const backing = memoryStorage({
			'proj.alpha.view': '"grid"',
			'proj.alpha.focus': '"rain"',
			'proj.beta.view': '"list"',
			'global.theme': '"dark"',
		});

		expect(clearNamespace(backing, 'proj.alpha.')).toBe(true);

		expect(backing.keys?.().sort()).toEqual([
			'global.theme',
			'proj.beta.view',
		]);
	});

	it('reports false when the backend cannot enumerate', () => {
		expect(clearNamespace(opaqueStorage(), 'proj.alpha.')).toBe(false);
	});
});
