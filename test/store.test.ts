import { describe, expect, it, vi } from 'vitest';
import { Store } from '../src/store';

interface Project {
	ref: string;
	name: string;
}

class ProjectStore extends Store {
	readonly items = this.atom<Project[]>([]);

	readonly byRef = this.computed(() => {
		const index = new Map<string, Project>();
		for (const item of this.items.value) index.set(item.ref, item);
		return index;
	});

	readonly item = this.family((ref: string) => this.byRef.value.get(ref));

	patch(ref: string, patch: Partial<Project>): void {
		this.items.set(prev =>
			prev.map(p => (p.ref === ref ? { ...p, ...patch } : p)),
		);
	}
}

function seed(): ProjectStore {
	const store = new ProjectStore();
	store.items.set([
		{ ref: 'alpha', name: 'Alpha' },
		{ ref: 'beta', name: 'Beta' },
		{ ref: 'gamma', name: 'Gamma' },
	]);
	return store;
}

describe('Store.family', () => {
	it('caches one node per key', () => {
		class S extends Store {
			readonly n = this.atom(2);
			readonly times = this.family((k: number) => this.n.value * k);
		}
		const s = new S();

		expect(s.times(3)).toBe(s.times(3));
		expect(s.times(3)).not.toBe(s.times(4));
		expect(s.times(3).get()).toBe(6);
		expect(s.times(4).get()).toBe(8);
		expect(s.times.size).toBe(2);
	});

	it('tracks the source atom per key', () => {
		class S extends Store {
			readonly n = this.atom(2);
			readonly times = this.family((k: number) => this.n.value * k);
		}
		const s = new S();
		expect(s.times(3).get()).toBe(6);

		s.n.set(10);
		expect(s.times(3).get()).toBe(30);
	});

	it('returns undefined for an unknown key', () => {
		const store = seed();
		expect(store.item('nope').get()).toBeUndefined();
	});

	it('notifies only the key whose value actually changed', () => {
		const store = seed();

		const listeners = new Map<string, ReturnType<typeof vi.fn>>();
		for (const ref of ['alpha', 'beta', 'gamma']) {
			const listener = vi.fn();
			listeners.set(ref, listener);
			store.item(ref).subscribe(listener);
		}

		store.patch('beta', { name: 'Beta!' });

		// Every per-key node re-runs, at O(1) each; only the moved one notifies.
		expect(listeners.get('alpha')).not.toHaveBeenCalled();
		expect(listeners.get('beta')).toHaveBeenCalledTimes(1);
		expect(listeners.get('gamma')).not.toHaveBeenCalled();
		expect(store.item('beta').get()?.name).toBe('Beta!');
	});

	it('delete() and clear() drop cached nodes', () => {
		class S extends Store {
			readonly n = this.atom(1);
			readonly times = this.family((k: number) => this.n.value * k);
		}
		const s = new S();
		s.times(1);
		s.times(2);
		expect(s.times.size).toBe(2);

		expect(s.times.delete(1)).toBe(true);
		expect(s.times.delete(1)).toBe(false);
		expect(s.times.size).toBe(1);

		s.times.clear();
		expect(s.times.size).toBe(0);
	});
});

describe('Store lifecycle', () => {
	it('stops effects and disposes computeds on destroy, then revives', async () => {
		class S extends Store {
			effectRuns = 0;
			readonly a = this.atom(1);
			readonly doubled = this.computed(() => this.a.value * 2);

			protected override async onInit() {
				this.effect(() => {
					this.a.value;
					this.effectRuns++;
				});
			}
		}

		const s = new S();
		await s._init();
		expect(s.effectRuns).toBe(1);

		s.a.set(2);
		expect(s.effectRuns).toBe(2);
		expect(s.doubled.get()).toBe(4);

		await s._destroy();

		s.a.set(3);
		expect(s.effectRuns).toBe(2);

		// Unlinked but not dead.
		expect(s.doubled.get()).toBe(6);

		await s._init();
		expect(s.effectRuns).toBe(3);
	});

	it('disposes family nodes on destroy', async () => {
		class S extends Store {
			readonly n = this.atom(1);
			readonly times = this.family((k: number) => this.n.value * k);
		}
		const s = new S();
		s.times(2);
		s.times(3);
		expect(s.times.size).toBe(2);

		await s._destroy();
		expect(s.times.size).toBe(0);
	});

	it('runs onInit and onDestroy hooks', async () => {
		const order: string[] = [];
		class S extends Store {
			protected override async onInit() {
				order.push('init');
			}
			protected override async onDestroy() {
				order.push('destroy');
			}
		}
		const s = new S();

		await s._init();
		await s._destroy();

		expect(order).toEqual(['init', 'destroy']);
	});

	it('names nodes after the fields holding them', async () => {
		class ProfileStore extends Store {
			readonly email = this.atom('a@b.c');
			readonly upper = this.computed(() =>
				this.email.value.toUpperCase(),
			);
		}
		const s = new ProfileStore();
		await s._init();

		expect(s.email.name).toBe('ProfileStore.email');
		expect(s.upper.name).toBe('ProfileStore.upper');
	});
});
