import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, spyOn } from 'bun:test';
import { Store } from '../src/store';
import {
	useAtom,
	useAtomSelector,
	useAtomSet,
	useAtoms,
	useStoreAction,
} from '../src/hooks';

interface User {
	id: number;
	name: string;
}

class UserStore extends Store {
	readonly users = this.atom<User[]>([
		{ id: 1, name: 'ada' },
		{ id: 2, name: 'grace' },
	]);
	readonly filter = this.atom('');
	readonly loading = this.atom(false);
	readonly count = this.computed(() => this.users.value.length);

	async succeed(name: string) {
		this.users.set(prev => [...prev, { id: prev.length + 1, name }]);
		return name;
	}

	async fail(): Promise<never> {
		throw new Error('nope');
	}
}

describe('useAtom', () => {
	it('returns the current value and re-renders on change', async () => {
		const s = new UserStore();
		function View() {
			const users = useAtom(s.users);
			return <span data-testid="out">{users.length}</span>;
		}

		render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('2');

		await act(async () => {
			s.users.set(prev => [...prev, { id: 3, name: 'linus' }]);
		});
		expect(screen.getByTestId('out').textContent).toBe('3');
	});

	it('renders exactly once on mount', () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			useAtom(s.users);
			return null;
		}

		render(<View />);

		expect(renders).toBe(1);
	});

	it('re-renders once per change, not once per subscriber hop', async () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			useAtom(s.filter);
			return null;
		}

		render(<View />);
		renders = 0;

		await act(async () => {
			s.filter.set('a');
		});

		expect(renders).toBe(1);
	});

	it('does not re-render when the value is unchanged', async () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			useAtom(s.filter);
			return null;
		}

		render(<View />);
		renders = 0;

		await act(async () => {
			s.filter.set('');
		});

		expect(renders).toBe(0);
	});

	it('unsubscribes on unmount', async () => {
		const s = new UserStore();
		function View() {
			useAtom(s.filter);
			return null;
		}

		const { unmount } = render(<View />);
		expect(s.filter.listenerCount).toBeGreaterThan(0);

		unmount();
		expect(s.filter.listenerCount).toBe(0);
	});

	it('works with a Computed', async () => {
		const s = new UserStore();
		function View() {
			const count = useAtom(s.count);
			return <span data-testid="out">{count}</span>;
		}

		render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('2');

		await act(async () => {
			s.users.set(prev => [...prev, { id: 3, name: 'linus' }]);
		});
		expect(screen.getByTestId('out').textContent).toBe('3');
	});

	it('subscribes once and does not resubscribe across re-renders', async () => {
		const s = new UserStore();
		const subscribeSpy = spyOn(s.filter, 'subscribe');
		let bump = () => {};

		function View() {
			const [, setN] = useState(0);
			bump = () => setN(n => n + 1);
			useAtom(s.filter);
			return null;
		}

		render(<View />);
		const afterMount = subscribeSpy.mock.calls.length;

		await act(async () => {
			bump();
		});
		await act(async () => {
			bump();
		});

		expect(subscribeSpy.mock.calls.length).toBe(afterMount);
	});
});

describe('useAtomSelector', () => {
	it('re-renders only when the selected slice changes', async () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			const name = useAtomSelector(
				s.users,
				users => users.find(u => u.id === 1)?.name,
			);
			return <span data-testid="out">{name}</span>;
		}

		render(<View />);
		renders = 0;

		// Touches the atom but not the selected slice.
		await act(async () => {
			s.users.set(prev => [...prev, { id: 3, name: 'linus' }]);
		});
		expect(renders).toBe(0);
		expect(screen.getByTestId('out').textContent).toBe('ada');

		// Now change the slice itself.
		await act(async () => {
			s.users.set(prev =>
				prev.map(u => (u.id === 1 ? { ...u, name: 'ada l.' } : u)),
			);
		});
		expect(renders).toBe(1);
		expect(screen.getByTestId('out').textContent).toBe('ada l.');
	});

	it('does not resubscribe when passed an inline selector', async () => {
		const s = new UserStore();
		const subscribeSpy = spyOn(s.users, 'subscribe');
		let bump = () => {};

		function View() {
			const [, setN] = useState(0);
			bump = () => setN(n => n + 1);
			// Fresh function identity on every render.
			useAtomSelector(s.users, users => users.length);
			return null;
		}

		render(<View />);
		const afterMount = subscribeSpy.mock.calls.length;

		await act(async () => {
			bump();
		});
		await act(async () => {
			bump();
		});

		expect(subscribeSpy.mock.calls.length).toBe(afterMount);
	});

	it('honours a custom equality function', async () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			const user = useAtomSelector(
				s.users,
				users => users.find(u => u.id === 1),
				(a, b) => a?.name === b?.name,
			);
			return <span data-testid="out">{user?.name}</span>;
		}

		render(<View />);
		renders = 0;

		// New object identity, same name — custom equality should suppress this.
		await act(async () => {
			s.users.set(prev => prev.map(u => ({ ...u })));
		});
		expect(renders).toBe(0);
	});
});

describe('useAtoms', () => {
	it('reads several atoms and re-renders when any changes', async () => {
		const s = new UserStore();
		function View() {
			const [users, filter, loading] = useAtoms(
				s.users,
				s.filter,
				s.loading,
			);
			return (
				<span data-testid="out">{`${users.length}|${filter}|${loading}`}</span>
			);
		}

		render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('2||false');

		await act(async () => {
			s.filter.set('a');
		});
		expect(screen.getByTestId('out').textContent).toBe('2|a|false');

		await act(async () => {
			s.loading.set(true);
		});
		expect(screen.getByTestId('out').textContent).toBe('2|a|true');
	});

	it('renders once on mount', () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			useAtoms(s.users, s.filter);
			return null;
		}

		render(<View />);
		expect(renders).toBe(1);
	});

	it('handles the atom list changing length between renders', async () => {
		const s = new UserStore();
		function View() {
			const [n] = useAtoms(s.filter);
			const all = useAtoms(...(n ? [s.users, s.filter] : [s.filter]));
			return <span data-testid="out">{all.length}</span>;
		}

		render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('1');

		await act(async () => {
			s.filter.set('a');
		});
		expect(screen.getByTestId('out').textContent).toBe('2');
	});

	it('unsubscribes from every atom on unmount', () => {
		const s = new UserStore();
		function View() {
			useAtoms(s.users, s.filter);
			return null;
		}

		const { unmount } = render(<View />);
		unmount();

		expect(s.users.listenerCount).toBe(0);
		expect(s.filter.listenerCount).toBe(0);
	});
});

describe('useAtomSet', () => {
	it('writes without subscribing', async () => {
		const s = new UserStore();
		let renders = 0;
		function View() {
			renders++;
			const setFilter = useAtomSet(s.filter);
			return <button onClick={() => setFilter('active')}>set</button>;
		}

		render(<View />);
		renders = 0;

		await act(async () => {
			s.filter.set('other');
		});

		expect(renders).toBe(0);
		expect(s.filter.listenerCount).toBe(0);
	});
});

describe('useStoreAction', () => {
	it('reports loading while the action is in flight', async () => {
		let resolve!: (value: string) => void;
		const pending = new Promise<string>(r => {
			resolve = r;
		});

		let state!: ReturnType<typeof useStoreAction<[], string>>;
		function View() {
			state = useStoreAction(() => pending);
			return null;
		}

		render(<View />);
		expect(state.loading).toBe(false);

		let inFlight!: Promise<string | undefined>;
		await act(async () => {
			inFlight = state.run();
		});
		expect(state.loading).toBe(true);

		await act(async () => {
			resolve('linus');
			await inFlight;
		});
		expect(state.loading).toBe(false);
		await expect(inFlight).resolves.toBe('linus');
	});

	it('returns the result and applies the store change', async () => {
		const s = new UserStore();
		let run!: (name: string) => Promise<string | undefined>;

		function View() {
			run = useStoreAction((name: string) => s.succeed(name)).run;
			return null;
		}

		render(<View />);

		let result: string | undefined;
		await act(async () => {
			result = await run('linus');
		});

		expect(result).toBe('linus');
		expect(s.users.get()).toHaveLength(3);
	});

	it('captures errors instead of throwing', async () => {
		const s = new UserStore();
		let state = { error: null as Error | null, run: async () => {} };

		function View() {
			const action = useStoreAction(() => s.fail());
			state = { error: action.error, run: async () => void action.run() };
			return null;
		}

		render(<View />);

		await act(async () => {
			await state.run();
		});

		expect(state.error).toBeInstanceOf(Error);
		expect(state.error?.message).toBe('nope');
	});

	it('reset() clears the error', async () => {
		const s = new UserStore();
		let state = {
			error: null as Error | null,
			run: async () => {},
			reset: () => {},
		};

		function View() {
			const action = useStoreAction(() => s.fail());
			state = {
				error: action.error,
				run: async () => void action.run(),
				reset: action.reset,
			};
			return null;
		}

		render(<View />);
		await act(async () => {
			await state.run();
		});
		expect(state.error).toBeInstanceOf(Error);

		await act(async () => {
			state.reset();
		});
		expect(state.error).toBeNull();
	});
});
