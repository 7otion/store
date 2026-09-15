import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Store } from '../src/store';
import { useAtom, useAtomSelector, useAtoms } from '../src/hooks';
import { batch } from '../src/graph';
import { configureChangeSource } from '../src/change-source';

class Person {
	constructor(public name: string) {}
}

class Employee extends Person {}

class Tag {
	constructor(public label: string) {}
}

/** Knows that a change to a Tag shows through it, the way a model with relations would. */
class Team {
	constructor(public tags: Tag[] = []) {}

	static affectedBy(instance: object): boolean {
		return instance instanceof Team || instance instanceof Tag;
	}
}

class People extends Store {
	readonly people = this.atomOf(Person, [new Person('ada')]);
	readonly tags = this.atomOf(Tag);
	readonly teams = this.atomOf(Team);
	readonly focused = this.atomOf(Person, null as Person | null);
	readonly plain = this.atom<number>(0);

	readonly first = this.computed(() => this.people.value[0] ?? null);
	readonly names = this.computed(() =>
		this.people.value.map(person => person.name),
	);
}

afterEach(() => {
	configureChangeSource(null);
});

describe('touch', () => {
	it('notifies subscribers although the value is the same object', () => {
		const s = new People();
		const listener = mock();
		s.people.subscribe(listener);

		const before = s.people.peek();
		s.people.touch();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(s.people.peek()).toBe(before);
	});

	it('passes through a computed returning the same instance', () => {
		const s = new People();
		const listener = mock();
		s.first.subscribe(listener);
		const ada = s.first.peek();

		ada!.name = 'Ada';
		s.people.touch();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(s.first.peek()).toBe(ada);
	});

	it('is a change for a computed that recomputes a fresh value', () => {
		const s = new People();
		const listener = mock();
		s.names.subscribe(listener);

		s.people.peek()[0]!.name = 'Ada';
		s.people.touch();

		expect(s.names.peek()).toEqual(['Ada']);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('a plain write still stops at an equal computed result', () => {
		const s = new People();
		const listener = mock();
		s.first.subscribe(listener);

		// Same first element, new array: the computed holds its version.
		s.people.set(prev => [...prev]);

		expect(listener).toHaveBeenCalledTimes(0);
	});
});

describe('touch and React', () => {
	it('useAtom re-renders with the same array', async () => {
		const s = new People();
		function View() {
			const people = useAtom(s.people);
			return <span data-testid="out">{people[0]!.name}</span>;
		}

		render(<View />);
		expect(screen.getByTestId('out').textContent).toBe('ada');

		await act(async () => {
			s.people.peek()[0]!.name = 'Ada';
			s.people.touch();
		});
		expect(screen.getByTestId('out').textContent).toBe('Ada');
	});

	it('useAtom through a computed returning the same instance', async () => {
		const s = new People();
		function View() {
			const first = useAtom(s.first);
			return <span data-testid="out">{first?.name}</span>;
		}

		render(<View />);
		await act(async () => {
			s.people.peek()[0]!.name = 'Ada';
			s.people.touch();
		});
		expect(screen.getByTestId('out').textContent).toBe('Ada');
	});

	it('useAtomSelector re-renders when it selects the touched instance', async () => {
		const s = new People();
		let renders = 0;
		function View() {
			renders++;
			const first = useAtomSelector(s.people, people => people[0]!);
			return <span data-testid="out">{first.name}</span>;
		}

		render(<View />);
		await act(async () => {
			s.people.peek()[0]!.name = 'Ada';
			s.people.touch();
		});
		expect(screen.getByTestId('out').textContent).toBe('Ada');
		expect(renders).toBe(2);
	});

	it('useAtomSelector still skips an equal primitive selection', async () => {
		const s = new People();
		let renders = 0;
		function View() {
			renders++;
			const count = useAtomSelector(s.people, people => people.length);
			return <span data-testid="out">{count}</span>;
		}

		render(<View />);
		await act(async () => {
			s.people.touch();
		});
		expect(renders).toBe(1);
	});

	it('useAtoms re-renders on a touch of any node', async () => {
		const s = new People();
		function View() {
			const [people, plain] = useAtoms(s.people, s.plain);
			return (
				<span data-testid="out">
					{people[0]!.name}:{plain}
				</span>
			);
		}

		render(<View />);
		await act(async () => {
			s.people.peek()[0]!.name = 'Ada';
			s.people.touch();
		});
		expect(screen.getByTestId('out').textContent).toBe('Ada:0');
	});
});

describe('change source', () => {
	function fakeSource() {
		let report: ((changed: readonly object[]) => void) | null = null;
		const unsubscribe = mock();
		return {
			source: (cb: (changed: readonly object[]) => void) => {
				report = cb;
				return unsubscribe;
			},
			report: (changed: readonly object[]) => report!(changed),
			unsubscribe,
		};
	}

	it('touches every atom about a reported class, once, in one flush', () => {
		const s = new People();
		const fake = fakeSource();
		configureChangeSource(fake.source);

		const people = mock();
		const tags = mock();
		const focused = mock();
		const plain = mock();
		s.people.subscribe(people);
		s.tags.subscribe(tags);
		s.focused.subscribe(focused);
		s.plain.subscribe(plain);

		fake.report([new Person('x'), new Person('y')]);

		expect(people).toHaveBeenCalledTimes(1);
		expect(focused).toHaveBeenCalledTimes(1);
		expect(tags).toHaveBeenCalledTimes(0);
		expect(plain).toHaveBeenCalledTimes(0);
	});

	it('matches subclasses', () => {
		const s = new People();
		const fake = fakeSource();
		configureChangeSource(fake.source);

		const people = mock();
		s.people.subscribe(people);

		fake.report([new Employee('x')]);
		expect(people).toHaveBeenCalledTimes(1);
	});

	it('asks a class that knows what shows through it', () => {
		const s = new People();
		const fake = fakeSource();
		configureChangeSource(fake.source);

		const teams = mock();
		const people = mock();
		s.teams.subscribe(teams);
		s.people.subscribe(people);

		fake.report([new Tag('x')]);

		expect(teams).toHaveBeenCalledTimes(1);
		expect(people).toHaveBeenCalledTimes(0);
	});

	it('a report inside a batch settles once with it', () => {
		const s = new People();
		const fake = fakeSource();
		configureChangeSource(fake.source);

		const names = mock();
		s.names.subscribe(names);

		batch(() => {
			fake.report([new Person('x')]);
			fake.report([new Person('y')]);
		});

		expect(names).toHaveBeenCalledTimes(1);
	});

	it('replacing the source unsubscribes the previous one', () => {
		const first = fakeSource();
		const second = fakeSource();

		configureChangeSource(first.source);
		configureChangeSource(second.source);
		expect(first.unsubscribe).toHaveBeenCalledTimes(1);

		configureChangeSource(null);
		expect(second.unsubscribe).toHaveBeenCalledTimes(1);
	});

	it('a destroyed store no longer republishes', async () => {
		const s = new People();
		const fake = fakeSource();
		configureChangeSource(fake.source);

		const people = mock();
		s.people.subscribe(people);

		await s._destroy();
		fake.report([new Person('x')]);

		expect(people).toHaveBeenCalledTimes(0);
	});
});
