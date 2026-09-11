import { describe, expect, it, mock } from 'bun:test';
import { batch } from '../src/graph';
import { Store } from '../src/store';

class Harness extends Store {
	readonly a = this.atom(0);
	readonly b = this.atom(0);
}

describe('batch', () => {
	it('collapses repeated writes to one atom into a single notification', () => {
		const s = new Harness();
		const listener = mock();
		s.a.subscribe(listener);

		batch(() => {
			s.a.set(1);
			s.a.set(2);
			s.a.set(3);
		});

		expect(listener).toHaveBeenCalledTimes(1);
		expect(s.a.get()).toBe(3);
	});

	it('notifies each affected atom once across a multi-atom batch', () => {
		const s = new Harness();
		const onA = mock();
		const onB = mock();
		s.a.subscribe(onA);
		s.b.subscribe(onB);

		batch(() => {
			s.a.set(1);
			s.b.set(1);
			s.a.set(2);
			s.b.set(2);
		});

		expect(onA).toHaveBeenCalledTimes(1);
		expect(onB).toHaveBeenCalledTimes(1);
	});

	it('defers notification until the batch closes', () => {
		const s = new Harness();
		const seen: number[] = [];
		s.a.subscribe(() => seen.push(s.a.get()));

		batch(() => {
			s.a.set(1);
			expect(seen).toEqual([]);
			s.a.set(2);
		});

		expect(seen).toEqual([2]);
	});

	it('only flushes when the outermost batch closes', () => {
		const s = new Harness();
		const listener = mock();
		s.a.subscribe(listener);

		batch(() => {
			batch(() => {
				s.a.set(1);
			});
			expect(listener).not.toHaveBeenCalled();
			s.a.set(2);
		});

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('does not notify for a no-op write', () => {
		const s = new Harness();
		const listener = mock();
		s.a.subscribe(listener);

		batch(() => {
			s.a.set(0);
		});

		expect(listener).not.toHaveBeenCalled();
	});

	it('flushes and rethrows when the batched function throws', () => {
		const s = new Harness();
		const listener = mock();
		s.a.subscribe(listener);

		expect(() =>
			batch(() => {
				s.a.set(1);
				throw new Error('boom');
			}),
		).toThrow('boom');

		expect(s.a.get()).toBe(1);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('delivers writes made by a listener during the drain', () => {
		const s = new Harness();
		const onB = mock();
		s.a.subscribe(() => s.b.set(s.a.get() * 10));
		s.b.subscribe(onB);

		batch(() => {
			s.a.set(1);
		});

		expect(s.b.get()).toBe(10);
		expect(onB).toHaveBeenCalledTimes(1);
	});

	it('throws instead of hanging when notifications never settle', () => {
		const s = new Harness();
		// A genuinely new value each time, so Object.is never settles the cycle.
		s.a.subscribe(() => s.a.set(v => v + 1));

		expect(() => batch(() => s.a.set(1))).toThrow(/did not settle/);
	});

	it('re-entrant writes stay flat instead of recursing', () => {
		const s = new Harness();
		let depth = 0;
		let maxDepth = 0;
		s.a.subscribe(() => {
			depth++;
			maxDepth = Math.max(maxDepth, depth);
			if (s.a.get() < 50) s.a.set(v => v + 1);
			depth--;
		});

		s.a.set(1);

		expect(s.a.get()).toBe(50);
		// Breadth-first drain: each notification returns before the next runs.
		expect(maxDepth).toBe(1);
	});
});
