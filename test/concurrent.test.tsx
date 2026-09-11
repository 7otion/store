import { StrictMode, startTransition } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { Store } from '../src/store';
import { useAtom, useAtomState } from '../src/hooks';

class CounterStore extends Store {
	readonly n = this.atom(0);
	readonly label = this.computed(() => `n=${this.n.value}`);
}

describe('concurrent rendering', () => {
	it('keeps every subscriber in a commit on the same value', async () => {
		const s = new CounterStore();

		function Reader({ id }: { id: number }) {
			const n = useAtom(s.n);
			const label = useAtom(s.label);
			return <span data-testid={`r${id}`}>{`${n}:${label}`}</span>;
		}

		function App() {
			return (
				<>
					{Array.from({ length: 10 }, (_, i) => (
						<Reader key={i} id={i} />
					))}
				</>
			);
		}

		render(<App />);

		await act(async () => {
			startTransition(() => {
				s.n.set(1);
			});
		});

		// Ten components reading one atom and one computed in a single commit.
		const texts = Array.from(
			{ length: 10 },
			(_, i) => screen.getByTestId(`r${i}`).textContent,
		);
		expect(new Set(texts).size).toBe(1);
		expect(texts[0]).toBe('1:n=1');
	});

	it('settles on the latest value after interleaved transition writes', async () => {
		const s = new CounterStore();

		function View() {
			const n = useAtom(s.n);
			return <span data-testid="out">{n}</span>;
		}

		render(<View />);

		await act(async () => {
			startTransition(() => s.n.set(1));
			startTransition(() => s.n.set(2));
			s.n.set(3);
		});

		expect(screen.getByTestId('out').textContent).toBe('3');
	});

	it('subscribes correctly through a StrictMode double mount', async () => {
		const s = new CounterStore();

		function View() {
			const n = useAtom(s.n);
			return <span data-testid="out">{n}</span>;
		}

		const { unmount } = render(
			<StrictMode>
				<View />
			</StrictMode>,
		);

		await act(async () => {
			s.n.set(5);
		});
		expect(screen.getByTestId('out').textContent).toBe('5');

		// StrictMode's throwaway mount must not leave a stray subscription.
		expect(s.n.listenerCount).toBe(1);

		unmount();
		expect(s.n.listenerCount).toBe(0);
	});
});

describe('useAtomState', () => {
	it('reads and writes like useState', async () => {
		const s = new CounterStore();

		function View() {
			const [n, setN] = useAtomState(s.n);
			return (
				<button data-testid="btn" onClick={() => setN(v => v + 1)}>
					{n}
				</button>
			);
		}

		render(<View />);
		expect(screen.getByTestId('btn').textContent).toBe('0');

		await act(async () => {
			screen.getByTestId('btn').click();
		});
		expect(screen.getByTestId('btn').textContent).toBe('1');
		expect(s.n.get()).toBe(1);
	});
});

describe('store computeds in React', () => {
	it('subscribes to a store computed and unsubscribes on unmount', async () => {
		const s = new CounterStore();

		function View() {
			const label = useAtom(s.label);
			return <span data-testid="out">{label}</span>;
		}

		const { unmount } = render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('n=0');

		await act(async () => {
			s.n.set(4);
		});
		expect(screen.getByTestId('out').textContent).toBe('n=4');

		unmount();
		expect(s.label.listenerCount).toBe(0);
	});
});
