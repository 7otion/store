import { describe, expect, it, mock } from 'bun:test';
import { Store } from '../src/store';
import type { StorageAdapter } from '../src/storage';

function fakeStorage(seed: Record<string, string> = {}) {
	const map = new Map(Object.entries(seed));
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
		map,
	};
}

class Harness extends Store {
	readonly view;
	readonly plain = this.atom('untouched');

	constructor(storage: StorageAdapter) {
		super();
		this.view = this.storedAtom<string>('view', 'grid', {
			storage,
			validate: value => value === 'grid' || value === 'list',
		});
	}
}

describe('storedAtom reload', () => {
	it('picks up a value written behind the atom', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);
		expect(s.view.get()).toBe('grid');

		storage.map.set('view', '"list"');
		s.view.reload();

		expect(s.view.get()).toBe('list');
	});

	it('falls back to the initial value when the key is gone', () => {
		const storage = fakeStorage({ view: '"list"' });
		const s = new Harness(storage);
		expect(s.view.get()).toBe('list');

		storage.map.delete('view');
		s.view.reload();

		expect(s.view.get()).toBe('grid');
	});

	it('still rejects a value validate refuses', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);

		storage.map.set('view', '"mosaic"');
		s.view.reload();

		expect(s.view.get()).toBe('grid');
	});

	it('does not write back what it read', () => {
		const storage = fakeStorage({ view: '"list"' });
		const s = new Harness(storage);
		const written: string[] = [];
		const spy = {
			...storage,
			setItem: (key: string, value: string) => {
				written.push(key);
				storage.setItem(key, value);
			},
		};

		class Watched extends Store {
			readonly view = this.storedAtom<string>('view', 'grid', {
				storage: spy,
			});
		}

		const watched = new Watched();
		watched.view.reload();
		expect(written).toEqual([]);
		expect(s.view.get()).toBe('list');
	});

	it('notifies subscribers when the value changed', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);
		const seen = mock(() => {});
		s.view.subscribe(seen);

		storage.map.set('view', '"list"');
		s.view.reload();

		expect(seen).toHaveBeenCalledTimes(1);
		expect(s.view.get()).toBe('list');
	});

	it('reloadStored() reloads stored atoms and leaves plain ones alone', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);
		s.plain.set('edited');

		storage.map.set('view', '"list"');
		s.reloadStored();

		expect(s.view.get()).toBe('list');
		expect(s.plain.get()).toBe('edited');
	});
});
