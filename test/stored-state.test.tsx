import { afterEach, describe, expect, it } from 'bun:test';
import { act, render, screen } from '@testing-library/react';
import { useStoredState } from '../src/hooks';

function Counter({ storeKey, initial }: { storeKey: string; initial: number }) {
	const [count, setCount] = useStoredState(storeKey, initial);
	return (
		<button onClick={() => setCount(prev => prev + 1)}>
			{storeKey}:{count}
		</button>
	);
}

afterEach(() => {
	localStorage.clear();
});

describe('useStoredState', () => {
	it('starts from the initial value and persists a change', async () => {
		render(<Counter storeKey="count" initial={0} />);
		expect(screen.getByRole('button').textContent).toBe('count:0');

		await act(async () => {
			screen.getByRole('button').click();
		});

		expect(screen.getByRole('button').textContent).toBe('count:1');
		expect(localStorage.getItem('count')).toBe('1');
	});

	it('loads a value written before mount', () => {
		localStorage.setItem('count', '7');
		render(<Counter storeKey="count" initial={0} />);
		expect(screen.getByRole('button').textContent).toBe('count:7');
	});

	it('keeps components on the same key in sync', async () => {
		render(
			<>
				<Counter storeKey="shared" initial={0} />
				<Counter storeKey="shared" initial={0} />
			</>,
		);

		const [first, second] = screen.getAllByRole('button');
		await act(async () => {
			first!.click();
		});

		expect(first!.textContent).toBe('shared:1');
		expect(second!.textContent).toBe('shared:1');
	});

	it('keeps different keys independent', async () => {
		render(
			<>
				<Counter storeKey="a" initial={0} />
				<Counter storeKey="b" initial={0} />
			</>,
		);

		const [a, b] = screen.getAllByRole('button');
		await act(async () => {
			a!.click();
		});

		expect(a!.textContent).toBe('a:1');
		expect(b!.textContent).toBe('b:0');
	});

	it('reloads from storage after the last subscriber unmounts', () => {
		const first = render(<Counter storeKey="count" initial={0} />);
		expect(screen.getByRole('button').textContent).toBe('count:0');
		first.unmount();

		// Written while nothing holds the key; a retained atom would miss it.
		localStorage.setItem('count', '42');

		render(<Counter storeKey="count" initial={0} />);
		expect(screen.getByRole('button').textContent).toBe('count:42');
	});
});
