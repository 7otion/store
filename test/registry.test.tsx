import { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Store } from '../src/store';
import { StoreProvider, StoreRegistry } from '../src/registry';
import { flushMicrotasks } from './setup';

class TrackedStore extends Store {
	initCount = 0;
	destroyCount = 0;
	readonly ready = this.atom(false);

	protected async onInit() {
		this.initCount++;
		this.ready.set(true);
	}

	protected async onDestroy() {
		this.destroyCount++;
		this.ready.set(false);
	}
}

class FailingStore extends Store {
	attempts = 0;
	shouldFail = true;

	protected async onInit() {
		this.attempts++;
		if (this.shouldFail) throw new Error('init failed');
	}
}

function setup() {
	const reg = new StoreRegistry();
	const store = new TrackedStore();
	reg.register('tracked', store);
	return { reg, store };
}

describe('StoreRegistry', () => {
	it('get() throws for an unregistered key', () => {
		const reg = new StoreRegistry();
		expect(() => reg.get('nope')).toThrow(/Store not found/);
	});

	it('getOrCreate() instantiates once and caches by constructor', () => {
		const reg = new StoreRegistry();
		const a = reg.getOrCreate(TrackedStore);
		const b = reg.getOrCreate(TrackedStore);
		expect(a).toBe(b);
	});

	it('initAll() runs each store once, however many times it is called', async () => {
		const { reg, store } = setup();

		await reg.initAll();
		await reg.initAll();

		expect(store.initCount).toBe(1);
		expect(store.ready.get()).toBe(true);
	});

	it('leaves a store uninitialized when onInit rejects, so a retry works', async () => {
		const reg = new StoreRegistry();
		const failing = new FailingStore();
		reg.register('failing', failing);

		await expect(reg.initAll()).rejects.toThrow('init failed');
		expect(failing.attempts).toBe(1);

		failing.shouldFail = false;
		await reg.initAll();
		expect(failing.attempts).toBe(2);
	});

	it('destroyAll() keeps registrations so the registry can be reused', async () => {
		const { reg, store } = setup();

		await reg.initAll();
		await reg.destroyAll();

		expect(store.destroyCount).toBe(1);
		expect(reg.has('tracked')).toBe(true);
		expect(() => reg.get('tracked')).not.toThrow();

		await reg.initAll();
		expect(store.initCount).toBe(2);
	});

	it('clear() drops registrations entirely', async () => {
		const { reg } = setup();
		await reg.initAll();
		await reg.clear();

		expect(reg.has('tracked')).toBe(false);
	});
});

describe('StoreProvider', () => {
	it('initializes registered stores on mount', async () => {
		const { reg, store } = setup();

		await act(async () => {
			render(
				<StoreProvider registry={reg} autoInit>
					<span>ok</span>
				</StoreProvider>,
			);
		});

		expect(store.initCount).toBe(1);
		expect(store.ready.get()).toBe(true);
	});

	it('survives StrictMode mount → unmount → remount', async () => {
		const { reg, store } = setup();

		await act(async () => {
			render(
				<StrictMode>
					<StoreProvider registry={reg} autoInit>
						<span>ok</span>
					</StoreProvider>
				</StrictMode>,
			);
		});
		await act(async () => {
			await flushMicrotasks();
		});

		expect(reg.has('tracked')).toBe(true);
		expect(() => reg.get('tracked')).not.toThrow();
		expect(store.initCount).toBe(1);
		expect(store.destroyCount).toBe(0);
		expect(store.ready.get()).toBe(true);
		expect(reg._providerCount).toBe(1);
	});

	it('destroys stores on a real unmount', async () => {
		const { reg, store } = setup();

		let unmount = () => {};
		await act(async () => {
			({ unmount } = render(
				<StoreProvider registry={reg} autoInit>
					<span>ok</span>
				</StoreProvider>,
			));
		});

		await act(async () => {
			unmount();
			await flushMicrotasks();
		});

		expect(store.destroyCount).toBe(1);
		expect(reg._providerCount).toBe(0);
	});

	it('refcounts nested providers sharing one registry', async () => {
		const { reg, store } = setup();

		let unmountInner = () => {};
		await act(async () => {
			render(
				<StoreProvider registry={reg} autoInit>
					<span>outer</span>
				</StoreProvider>,
			);
			({ unmount: unmountInner } = render(
				<StoreProvider registry={reg} autoInit>
					<span>inner</span>
				</StoreProvider>,
			));
		});

		expect(reg._providerCount).toBe(2);

		await act(async () => {
			unmountInner();
			await flushMicrotasks();
		});

		// One provider is still mounted — nothing should have been torn down.
		expect(reg._providerCount).toBe(1);
		expect(store.destroyCount).toBe(0);
	});

	it('does not initialize anything without autoInit', async () => {
		const { reg, store } = setup();

		await act(async () => {
			render(
				<StoreProvider registry={reg}>
					<span>ok</span>
				</StoreProvider>,
			);
		});

		expect(store.initCount).toBe(0);
	});
});
