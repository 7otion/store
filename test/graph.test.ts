import { describe, expect, it, vi } from 'vitest';
import { Store } from '../src/store';
import { batch, untrack } from '../src/graph';
import { effect } from '../src/effect';
import { shallowEqual, type Computed } from '../src/computed';

describe('automatic dependency tracking', () => {
	it('discovers dependencies by running the function', () => {
		class S extends Store {
			readonly first = this.atom('Ada');
			readonly last = this.atom('Lovelace');
			readonly full = this.computed(
				() => `${this.first.value} ${this.last.value}`,
			);
		}
		const s = new S();

		expect(s.full.get()).toBe('Ada Lovelace');
		s.last.set('L.');
		expect(s.full.get()).toBe('Ada L.');
	});

	it('chains computeds off other computeds', () => {
		class S extends Store {
			readonly items = this.atom([1, 2, 3]);
			readonly doubled = this.computed(() =>
				this.items.value.map(n => n * 2),
			);
			readonly total = this.computed(() =>
				this.doubled.value.reduce((a, b) => a + b, 0),
			);
			readonly label = this.computed(() => `sum=${this.total.value}`);
		}
		const s = new S();

		expect(s.label.get()).toBe('sum=12');
		s.items.set([1, 2, 3, 4]);
		expect(s.label.get()).toBe('sum=20');
	});

	it('re-discovers dependencies each run, dropping untaken branches', () => {
		class S extends Store {
			runs = 0;
			readonly useA = this.atom(true);
			readonly a = this.atom('a');
			readonly b = this.atom('b');
			readonly picked = this.computed(() => {
				this.runs++;
				return this.useA.value ? this.a.value : this.b.value;
			});
		}
		const s = new S();
		s.picked.subscribe(() => {});

		expect(s.picked.get()).toBe('a');
		expect(s.runs).toBe(1);

		// `b` is not a dependency on this branch.
		s.b.set('b2');
		expect(s.runs).toBe(1);

		s.a.set('a2');
		expect(s.picked.get()).toBe('a2');
		expect(s.runs).toBe(2);

		s.useA.set(false);
		expect(s.picked.get()).toBe('b2');
		expect(s.runs).toBe(3);

		// `a` has now been dropped as a dependency.
		s.a.set('a3');
		expect(s.runs).toBe(3);
		expect(s.picked.get()).toBe('b2');
	});

	it('untrack() reads without creating a dependency', () => {
		class S extends Store {
			runs = 0;
			readonly tracked = this.atom(1);
			readonly ignored = this.atom(100);
			readonly out = this.computed(() => {
				this.runs++;
				return this.tracked.value + untrack(() => this.ignored.value);
			});
		}
		const s = new S();
		s.out.subscribe(() => {});
		expect(s.out.get()).toBe(101);
		expect(s.runs).toBe(1);

		s.ignored.set(200);
		expect(s.runs).toBe(1);

		s.tracked.set(2);
		expect(s.out.get()).toBe(202);
		expect(s.runs).toBe(2);
	});

	it('peek() reads without creating a dependency', () => {
		class S extends Store {
			runs = 0;
			readonly a = this.atom(1);
			readonly b = this.atom(1);
			readonly out = this.computed(() => {
				this.runs++;
				return this.a.value + this.b.peek();
			});
		}
		const s = new S();
		s.out.subscribe(() => {});
		expect(s.out.get()).toBe(2);

		s.b.set(10);
		expect(s.runs).toBe(1);
	});
});

describe('laziness', () => {
	it('never runs a computed nothing reads or watches', () => {
		class S extends Store {
			runs = 0;
			readonly a = this.atom(1);
			readonly expensive = this.computed(() => {
				this.runs++;
				return this.a.value * 2;
			});
		}
		const s = new S();

		s.a.set(2);
		s.a.set(3);
		expect(s.runs).toBe(0);

		expect(s.expensive.get()).toBe(6);
		expect(s.runs).toBe(1);
	});

	it('does not recompute an unwatched computed on write', () => {
		class S extends Store {
			runs = 0;
			readonly a = this.atom(1);
			readonly out = this.computed(() => {
				this.runs++;
				return this.a.value * 2;
			});
		}
		const s = new S();
		expect(s.out.get()).toBe(2);
		expect(s.runs).toBe(1);

		s.a.set(2);
		s.a.set(3);
		s.a.set(4);
		expect(s.runs).toBe(1);

		expect(s.out.get()).toBe(8);
		expect(s.runs).toBe(2);
	});

	it('evaluates eagerly once something subscribes', () => {
		class S extends Store {
			runs = 0;
			readonly a = this.atom(1);
			readonly out = this.computed(() => {
				this.runs++;
				return this.a.value * 2;
			});
		}
		const s = new S();
		s.out.subscribe(() => {});
		expect(s.runs).toBe(1);

		s.a.set(2);
		expect(s.runs).toBe(2);
	});
});

describe('glitch-freedom', () => {
	it('recomputes a diamond once, from a settled graph', () => {
		class S extends Store {
			cRuns = 0;
			readonly a = this.atom(1);
			readonly b1 = this.computed(() => this.a.value * 2);
			readonly b2 = this.computed(() => this.a.value * 10);
			readonly c = this.computed(() => {
				this.cRuns++;
				return this.b1.value + this.b2.value;
			});
		}
		const s = new S();

		const seen: number[] = [];
		s.c.subscribe(() => seen.push(s.c.get()));
		expect(s.c.get()).toBe(12);
		expect(s.cRuns).toBe(1);

		s.a.set(2);

		// Never an intermediate 4 + 10 = 14 from a half-updated graph, and no
		// batch() involved.
		expect(seen).toEqual([24]);
		expect(s.cRuns).toBe(2);
	});

	it('keeps a deep chain consistent across a single write', () => {
		class S extends Store {
			readonly n = this.atom(1);
			readonly a = this.computed(() => this.n.value + 1);
			readonly b = this.computed(() => this.a.value * 2);
			readonly c = this.computed(() => this.b.value + this.n.value);
		}
		const s = new S();
		const seen: number[] = [];
		s.c.subscribe(() => seen.push(s.c.get()));
		expect(s.c.get()).toBe(5);

		s.n.set(3);
		expect(seen).toEqual([11]);
	});

	it('stops propagating when a recompute lands on the same value', () => {
		class S extends Store {
			downstreamRuns = 0;
			readonly text = this.atom('ab');
			readonly length = this.computed(() => this.text.value.length);
			readonly label = this.computed(() => {
				this.downstreamRuns++;
				return `len:${this.length.value}`;
			});
		}
		const s = new S();
		const listener = vi.fn();
		s.label.subscribe(listener);
		expect(s.downstreamRuns).toBe(1);

		// Different text, same length — the chain stops at `length`.
		s.text.set('cd');
		expect(s.downstreamRuns).toBe(1);
		expect(listener).not.toHaveBeenCalled();

		s.text.set('abc');
		expect(s.downstreamRuns).toBe(2);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('honours a custom equals on a computed', () => {
		class S extends Store {
			readonly first = this.atom('Ada');
			readonly tag = this.atom('x');
			readonly view = this.computed(() => ({ first: this.first.value }), {
				equals: shallowEqual,
			});
		}
		const s = new S();
		const listener = vi.fn();
		s.view.subscribe(listener);
		const before = s.view.get();

		// Recomputes to a fresh object with identical contents.
		s.first.set('Ada');
		expect(listener).not.toHaveBeenCalled();
		expect(s.view.get()).toBe(before);

		s.first.set('Grace');
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe('batch', () => {
	it('collapses a multi-atom transaction into one recompute', () => {
		class S extends Store {
			runs = 0;
			readonly first = this.atom('Ada');
			readonly last = this.atom('Lovelace');
			readonly full = this.computed(() => {
				this.runs++;
				return `${this.first.value} ${this.last.value}`;
			});
		}
		const s = new S();
		const listener = vi.fn();
		s.full.subscribe(listener);
		expect(s.runs).toBe(1);

		batch(() => {
			s.first.set('Grace');
			s.last.set('Hopper');
		});

		expect(s.runs).toBe(2);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(s.full.get()).toBe('Grace Hopper');
	});

	it('returns the value of the batched function', () => {
		expect(batch(() => 42)).toBe(42);
	});
});

describe('cycle detection', () => {
	it('throws instead of overflowing the stack', () => {
		class S extends Store {
			readonly self: Computed<number> = this.computed(
				() => this.self.value + 1,
			);
		}
		const s = new S();
		expect(() => s.self.get()).toThrow(/Cycle detected/);
	});

	it('leaves a throwing computed retryable rather than caching a bad value', () => {
		class S extends Store {
			shouldThrow = true;
			readonly a = this.atom(1);
			readonly out = this.computed(() => {
				if (this.shouldThrow) throw new Error('nope');
				return this.a.value * 2;
			});
		}
		const s = new S();
		expect(() => s.out.get()).toThrow('nope');

		s.shouldThrow = false;
		expect(s.out.get()).toBe(2);
	});
});

describe('effect', () => {
	it('runs immediately and on every settled change', () => {
		class S extends Store {
			readonly a = this.atom(1);
		}
		const s = new S();
		const seen: number[] = [];

		const stop = effect(() => {
			seen.push(s.a.value);
		});
		expect(seen).toEqual([1]);

		s.a.set(2);
		s.a.set(3);
		expect(seen).toEqual([1, 2, 3]);

		stop();
		s.a.set(4);
		expect(seen).toEqual([1, 2, 3]);
	});

	it('runs once for a batched transaction', () => {
		class S extends Store {
			readonly a = this.atom(1);
			readonly b = this.atom(1);
		}
		const s = new S();
		const run = vi.fn();

		effect(() => {
			run(s.a.value + s.b.value);
		});
		expect(run).toHaveBeenCalledTimes(1);

		batch(() => {
			s.a.set(2);
			s.b.set(2);
		});

		expect(run).toHaveBeenCalledTimes(2);
		expect(run).toHaveBeenLastCalledWith(4);
	});

	it('runs cleanup before each re-run and on stop', () => {
		class S extends Store {
			readonly a = this.atom(1);
		}
		const s = new S();
		const cleanups: number[] = [];

		const stop = effect(() => {
			const seen = s.a.value;
			return () => cleanups.push(seen);
		});
		expect(cleanups).toEqual([]);

		s.a.set(2);
		expect(cleanups).toEqual([1]);

		stop();
		expect(cleanups).toEqual([1, 2]);
	});

	it('tracks a computed read inside it', () => {
		class S extends Store {
			readonly a = this.atom(1);
			readonly doubled = this.computed(() => this.a.value * 2);
		}
		const s = new S();
		const seen: number[] = [];

		effect(() => {
			seen.push(s.doubled.value);
		});
		s.a.set(5);

		expect(seen).toEqual([2, 10]);
	});
});

describe('dispose', () => {
	it('unlinks a computed but leaves it usable', () => {
		class S extends Store {
			readonly a = this.atom(1);
			readonly out = this.computed(() => this.a.value * 2);
		}
		const s = new S();
		expect(s.out.get()).toBe(2);

		s.out.dispose();
		s.a.set(5);

		// Re-runs from scratch rather than serving a stale cached value.
		expect(s.out.get()).toBe(10);
	});

	it('drops subscribers on dispose', () => {
		class S extends Store {
			readonly a = this.atom(1);
			readonly out = this.computed(() => this.a.value * 2);
		}
		const s = new S();
		const listener = vi.fn();
		s.out.subscribe(listener);

		s.out.dispose();
		s.a.set(5);

		expect(listener).not.toHaveBeenCalled();
	});

	it('unlinks the source atom when a computed is disposed', () => {
		class S extends Store {
			readonly a = this.atom(1);
			readonly out = this.computed(() => this.a.value * 2);
		}
		const s = new S();
		s.out.get();
		expect(s.a._observers.size).toBe(1);

		s.out.dispose();
		expect(s.a._observers.size).toBe(0);
	});
});
