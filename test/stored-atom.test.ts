import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { Atom } from '../src/atom';
import { Store } from '../src/store';
import { configureStorage, type StorageAdapter } from '../src/storage';

function fakeStorage(seed: Record<string, string> = {}) {
	const map = new Map(Object.entries(seed));
	return {
		getItem: mock((key: string) => map.get(key) ?? null),
		setItem: mock((key: string, value: string) => void map.set(key, value)),
		removeItem: mock((key: string) => void map.delete(key)),
		map,
	};
}

const isView = (value: unknown) => value === 'grid' || value === 'list';

class Harness extends Store {
	readonly view: Atom<string>;

	constructor(
		storage: StorageAdapter,
		validate?: (value: unknown) => boolean,
	) {
		super();
		this.view = this.storedAtom<string>('view', 'grid', {
			storage,
			validate,
		});
	}
}

afterEach(() => {
	configureStorage(globalThis.localStorage ?? null);
	localStorage.clear();
});

describe('storedAtom', () => {
	it('uses the initial value when nothing is stored', () => {
		const storage = fakeStorage();
		expect(new Harness(storage).view.get()).toBe('grid');
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	it('loads the stored value', () => {
		const storage = fakeStorage({ view: '"list"' });
		expect(new Harness(storage).view.get()).toBe('list');
	});

	it('saves every change, including through an updater', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);

		s.view.set('list');
		expect(storage.map.get('view')).toBe('"list"');

		s.view.set(prev => (prev === 'list' ? 'grid' : 'list'));
		expect(storage.map.get('view')).toBe('"grid"');

		s.view.value = 'list';
		expect(storage.map.get('view')).toBe('"list"');
	});

	it('does not save when the value did not change', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);

		s.view.set('grid');
		expect(storage.setItem).not.toHaveBeenCalled();
	});

	it('falls back to the initial value when the stored text is not JSON', () => {
		const storage = fakeStorage({ view: 'not json' });
		expect(new Harness(storage).view.get()).toBe('grid');
	});

	it('falls back to the initial value when validate rejects', () => {
		const storage = fakeStorage({ view: '"mosaic"' });
		expect(new Harness(storage, isView).view.get()).toBe('grid');
	});

	it('keeps a stored value that validate accepts', () => {
		const storage = fakeStorage({ view: '"list"' });
		expect(new Harness(storage, isView).view.get()).toBe('list');
	});

	it('round-trips objects, arrays and null', () => {
		const storage = fakeStorage();

		class Shapes extends Store {
			readonly filter = this.storedAtom(
				'filter',
				{ scope: 'all', types: [] as string[] },
				{ storage },
			);
			readonly ref = this.storedAtom<string | null>('ref', null, {
				storage,
			});
		}

		const s = new Shapes();
		s.filter.set({ scope: 'folder', types: ['image'] });
		s.ref.set('reba-yost');
		s.ref.set(null);

		const reloaded = new Shapes();
		expect(reloaded.filter.get()).toEqual({
			scope: 'folder',
			types: ['image'],
		});
		expect(reloaded.ref.get()).toBeNull();
	});

	it('keeps working, unpersisted, without an adapter', () => {
		const warn = spyOn(console, 'warn').mockImplementation(() => {});
		configureStorage(null);

		class Plain extends Store {
			readonly count = this.storedAtom('count', 0);
		}

		const s = new Plain();
		s.count.set(2);

		expect(s.count.get()).toBe(2);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it('survives a storage that throws', () => {
		const storage: StorageAdapter = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('quota');
			},
			removeItem: () => {},
		};

		class Plain extends Store {
			readonly count = this.storedAtom('count', 0, { storage });
		}

		const s = new Plain();
		expect(s.count.get()).toBe(0);

		s.count.set(5);
		expect(s.count.get()).toBe(5);
	});

	it('uses localStorage without configuration', () => {
		localStorage.setItem('theme', '"dark"');

		class Themed extends Store {
			readonly theme = this.storedAtom('theme', 'light');
		}

		const s = new Themed();
		expect(s.theme.get()).toBe('dark');

		s.theme.set('light');
		expect(localStorage.getItem('theme')).toBe('"light"');
	});

	it('notifies subscribers like a plain atom', () => {
		const storage = fakeStorage();
		const s = new Harness(storage);
		const seen = mock();

		s.view.subscribe(seen);
		s.view.set('list');

		expect(seen).toHaveBeenCalledTimes(1);
	});
});
