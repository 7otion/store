import { describe, expect, it, vi } from 'vitest';
import { Store } from '../src/store';

class Harness extends Store {
	readonly count = this.atom(0);
	readonly name = this.atom('ada');
	readonly items = this.atom<number[]>([]);
}

describe('Atom', () => {
	it('reads through .value and .get()', () => {
		const s = new Harness();
		expect(s.count.value).toBe(0);
		expect(s.count.get()).toBe(0);
	});

	it('writes through .value, .set(next) and .set(updater)', () => {
		const s = new Harness();

		s.count.value = 1;
		expect(s.count.get()).toBe(1);

		s.count.set(2);
		expect(s.count.get()).toBe(2);

		s.count.set(prev => prev + 5);
		expect(s.count.get()).toBe(7);
	});

	it('notifies subscribers on change', () => {
		const s = new Harness();
		const listener = vi.fn();
		s.count.subscribe(listener);

		s.count.set(1);
		expect(listener).toHaveBeenCalledTimes(1);

		s.count.set(2);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('does not notify when the value is Object.is-equal', () => {
		const s = new Harness();
		const listener = vi.fn();
		s.count.subscribe(listener);

		s.count.set(0);
		s.count.value = 0;
		s.count.set(prev => prev);
		expect(listener).not.toHaveBeenCalled();
	});

	it('treats a new array with equal contents as a change', () => {
		const s = new Harness();
		const listener = vi.fn();
		s.items.subscribe(listener);

		s.items.set([]);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('stops notifying after unsubscribe', () => {
		const s = new Harness();
		const listener = vi.fn();
		const unsub = s.count.subscribe(listener);

		s.count.set(1);
		unsub();
		s.count.set(2);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('unsubscribe is idempotent', () => {
		const s = new Harness();
		const listener = vi.fn();
		const unsub = s.count.subscribe(listener);

		unsub();
		unsub();
		s.count.set(1);

		expect(listener).not.toHaveBeenCalled();
	});

	it('supports multiple independent subscribers', () => {
		const s = new Harness();
		const a = vi.fn();
		const b = vi.fn();
		s.count.subscribe(a);
		s.count.subscribe(b);

		s.count.set(1);

		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it('keeps atoms on the same store independent', () => {
		const s = new Harness();
		const onCount = vi.fn();
		const onName = vi.fn();
		s.count.subscribe(onCount);
		s.name.subscribe(onName);

		s.count.set(1);

		expect(onCount).toHaveBeenCalledTimes(1);
		expect(onName).not.toHaveBeenCalled();
	});

	it('keeps instances of the same store class independent', () => {
		const a = new Harness();
		const b = new Harness();

		a.count.set(10);

		expect(a.count.get()).toBe(10);
		expect(b.count.get()).toBe(0);
	});

	it('survives a subscriber unsubscribing during notification', () => {
		const s = new Harness();
		const calls: string[] = [];
		const unsubB = s.count.subscribe(() => {
			calls.push('b');
		});
		s.count.subscribe(() => {
			calls.push('a');
			unsubB();
		});

		expect(() => s.count.set(1)).not.toThrow();
		s.count.set(2);

		// 'b' runs on the first notification (already snapshotted), not the second.
		expect(calls.filter(c => c === 'b')).toHaveLength(1);
	});
});
