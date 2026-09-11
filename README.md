# @7otion/store

Class-based state management for **React**, on a lazy, glitch-free reactive graph.

```
Stores are Classes → State is Atoms → Actions are Methods → Derivation is automatic
```

3.4 KB gzipped. React 18 and 19. No dependencies.

---

## Core Concepts

| Concept         | What it is                                                                |
| --------------- | ------------------------------------------------------------------------- |
| `Atom<T>`       | A single reactive value. Writing it notifies only what actually reads it. |
| `Computed<T>`   | A derived value. Tracks its own dependencies; runs only when read.        |
| `effect()`      | A side effect that re-runs when the state it reads changes.               |
| `Store`         | A class that owns atoms, computeds, and actions.                          |
| `StoreRegistry` | Manages store lifetimes and the `onInit` / `onDestroy` hooks.             |

---

## Install

```bash
bun add @7otion/store
```

---

## Quick Start

### 1. Define a Store

```ts
import { Store } from '@7otion/store';

interface User {
	id: number;
	name: string;
	email: string;
}

export class UserStore extends Store {
	// ── State (reactive sources) ─────────────────────────────────────────────
	readonly users = this.atom<User[]>([]);
	readonly query = this.atom('');
	readonly loading = this.atom(false);
	readonly error = this.atom<string | null>(null);

	// ── Derived (no dependency arrays) ───────────────────────────────────────
	readonly matching = this.computed(() =>
		this.users.value.filter(u => u.name.includes(this.query.value)),
	);
	readonly count = this.computed(() => this.matching.value.length);

	// ── Internal (non-reactive) ──────────────────────────────────────────────
	private _cache = new Map<number, User>();

	// ── Lifecycle ────────────────────────────────────────────────────────────
	protected async onInit() {
		this.loading.set(true);
		try {
			this.users.set(await api.getUsers());
		} catch (err) {
			this.error.set(String(err));
		} finally {
			this.loading.set(false);
		}
	}

	// ── Actions (public methods) ─────────────────────────────────────────────
	async createUser(name: string, email: string) {
		const user = await api.createUser({ name, email });
		this.users.set(prev => [...prev, user]); // optimistic
		this._cache.set(user.id, user);
	}

	async deleteUser(id: number) {
		const snapshot = this.users.value;
		this.users.set(prev => prev.filter(u => u.id !== id));

		try {
			await api.deleteUser(id);
			this._cache.delete(id);
		} catch (err) {
			this.users.set(snapshot); // rollback
			this.error.set(String(err));
		}
	}
}

export const userStore = new UserStore();
```

`matching` and `count` declare no dependencies. Whatever `.value` they read while
running is what they depend on, re-discovered on every run — so a computed that
branches stops depending on the arm it didn't take.

### 2. Subscribe in Components

```tsx
import { useAtom, useAtoms, useAtomState, useStoreAction } from '@7otion/store';
import { userStore } from './stores/user-store';

// Re-renders only when `matching` changes
function UserList() {
	const users = useAtom(userStore.matching);
	return (
		<ul>
			{users.map(u => (
				<li key={u.id}>{u.name}</li>
			))}
		</ul>
	);
}

// Read + write, like useState against shared state
function SearchBox() {
	const [query, setQuery] = useAtomState(userStore.query);
	return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// Several nodes at once
function StatusBar() {
	const [loading, error, count] = useAtoms(
		userStore.loading,
		userStore.error,
		userStore.count,
	);
	return (
		<div>
			{loading ? 'Syncing…' : `${count} users`} {error}
		</div>
	);
}

// Async action with loading/error state
function CreateUserForm() {
	const [name, setName] = useState('');
	const {
		run: create,
		loading,
		error,
	} = useStoreAction((n: string) =>
		userStore.createUser(n, 'test@example.com'),
	);

	return (
		<form
			onSubmit={e => {
				e.preventDefault();
				create(name);
			}}
		>
			<input value={name} onChange={e => setName(e.target.value)} />
			<button type="submit" disabled={loading}>
				Add User
			</button>
			{error && <p>{error.message}</p>}
		</form>
	);
}
```

Every hook reads through `useSyncExternalStore`, so concurrent rendering can't
tear, SSR gets a server snapshot, and subscribing costs no extra render.

---

## Two properties worth knowing

### Computeds are lazy

A computed that nothing reads and nothing subscribes to never runs, however
often its sources change.

```ts
class S extends Store {
	readonly rows = this.atom<Row[]>([]);
	readonly expensive = this.computed(() => heavyAggregate(this.rows.value));
}

store.rows.set(next); // `expensive` does not run
store.rows.set(next); // still hasn't run
store.expensive.get(); // runs once, here
```

Subscribing to it (which `useAtom` does) makes it eager, because something is
now waiting on the value.

### Derivation is glitch-free

In a diamond, a single write recomputes the bottom node **once**, from a fully
settled graph — no batching required.

```ts
class S extends Store {
	readonly a = this.atom(1);
	readonly b1 = this.computed(() => this.a.value * 2);
	readonly b2 = this.computed(() => this.a.value * 10);
	readonly c = this.computed(() => this.b1.value + this.b2.value);
}

store.a.set(2);
// `c` runs once and yields 24.
// It never observes an intermediate 4 + 10 = 14 from a half-updated graph.
```

A recompute that lands on the same value stops there: downstream computeds and
React subscribers are not notified at all.

---

## Long lists: `family`

Selecting a row with `useAtomSelector(items, xs => xs.find(...))` re-scans the
whole list in every row on every change — O(n²). Index once, then give each row
its own node:

```ts
class ProjectStore extends Store {
	readonly items = this.atom<Project[]>([]);

	readonly byRef = this.computed(
		() => new Map(this.items.value.map(p => [p.ref, p])),
	);

	/** One cached computed per ref, created on demand. */
	readonly item = this.family((ref: string) => this.byRef.value.get(ref));
}
```

```tsx
function Row({ projectRef }: { projectRef: string }) {
	const project = useAtom(store.item(projectRef)); // only this row re-renders
	return project ? <li>{project.name}</li> : null;
}
```

Every per-key node re-runs on a change, but each is an O(1) index lookup, and
only the key whose value actually moved notifies. Nodes are disposed with the
store; `item.delete(ref)`, `item.clear()` and `item.size` manage the cache by
hand if the key space is unbounded.

---

## Effects

Run a side effect when the state it reads changes. Tracked automatically;
return a cleanup function if you need one.

```ts
class SettingsStore extends Store {
	readonly theme = this.atom('dark');
	readonly intervalMs = this.atom(30_000);

	protected async onInit() {
		// Stopped automatically when the store is destroyed
		this.effect(() => {
			localStorage.setItem('theme', this.theme.value);
		});

		this.effect(() => {
			const id = setInterval(poll, this.intervalMs.value);
			return () => clearInterval(id);
		});
	}
}
```

Standalone, outside a store:

```ts
import { effect } from '@7otion/store';

const stop = effect(() => console.log(store.theme.value));
stop();
```

---

## Persistence

`storedAtom` is an atom that loads itself from storage and saves on every
change. No setter has to remember to write.

```ts
class FilterStore extends Store {
	readonly view = this.storedAtom<View>('app.view', 'grid');
	readonly focusRef = this.storedAtom<string | null>('app.focus', null);

	setView(view: View) {
		this.view.set(view); // persisted
	}
}
```

Values are stored as JSON and it is an `Atom<T>`, so reading, writing,
`equals` and hooks all behave the same.

**Stale values.** Storage outlives the code that wrote it: an option you later
removed, or a shape you changed, still parses. `validate` rejects one, falling
back to the initial value.

```ts
readonly view = this.storedAtom<View>('app.view', 'grid', {
	validate: value => VIEWS.includes(value as View),
});
```

**Where it stores.** `localStorage` is used automatically where it exists.
Anywhere else, give it a backend before the first store is constructed:

```ts
import { configureStorage } from '@7otion/store';

configureStorage({ getItem, setItem, removeItem });
```

`options.storage` overrides the backend for a single atom. Without any
backend the atom still works, warns once, and persists nothing. Adapters are
synchronous, so an async store (React Native's `AsyncStorage`) needs a
hydration step of its own and is not supported.

Keep transient state in a plain `atom` rather than picking fields apart: a
search box belongs in `atom('')` next to the `storedAtom` holding the filters
that should come back.

---

## Batching

Each write settles the graph immediately. Wrap a transaction to settle once:

```ts
import { batch } from '@7otion/store';

batch(() => {
	store.firstName.set('Grace');
	store.lastName.set('Hopper');
});
// `fullName` recomputes once; subscribers are called once.
```

Batching is an optimisation, not a correctness tool — consistency is a property
of the graph either way.

---

## Registry & Lifecycle

```tsx
import { StoreProvider, registry } from '@7otion/store';

registry.register('users', userStore);
registry.register('todos', todoStore);

function App() {
	return (
		<StoreProvider autoInit>
			<Router />
		</StoreProvider>
	);
}
```

`autoInit` calls `onInit()` on mount and `onDestroy()` on unmount. Providers are
refcounted and teardown is deferred by a microtask, so React StrictMode's
throwaway unmount in development doesn't tear the registry down.

`destroyAll()` keeps registrations so the registry can be initialised again;
`clear()` drops the instances too.

For isolated contexts (a second window, a test), pass your own registry:

```tsx
<StoreProvider registry={new StoreRegistry()} autoInit>
```

---

## Hooks Reference

| Hook                              | Re-renders when            | Use for                       |
| --------------------------------- | -------------------------- | ----------------------------- |
| `useAtom(node)`                   | That node changes          | Reading an atom or computed   |
| `useAtomState(atom)`              | The atom changes           | Read + write, like `useState` |
| `useAtomSet(atom)`                | **Never**                  | Write-only components         |
| `useAtomSelector(node, sel, eq?)` | The selected slice changes | Narrowing a large value       |
| `useAtoms(...nodes)`              | Any of them changes        | Reading several at once       |
| `useStoreAction(fn)`              | `loading` / `error` moves  | Async actions with status     |

Selectors and equality functions may be passed inline — they never cause a
re-subscription.

---

## API surface

**Reading** — `.value`, `.get()` (alias), `.peek()` (read without tracking).
**Writing** — `.set(next)`, `.set(prev => next)`, `.value = next`.

> A function passed to `.set()` is always treated as an updater. To store a
> function _as_ the value, assign `.value` directly.

**Persistence** — `this.storedAtom(key, initial, { validate, storage })` loads
from storage and saves on change; `configureStorage(adapter)` sets the backend.

**Options** — both `this.atom()` and `this.computed()` take `{ equals, name }`.
`shallowEqual` is exported for computeds that build a fresh object each run:

```ts
readonly view = this.computed(
	() => ({ name: this.name.value, tags: this.tags.value }),
	{ equals: shallowEqual },
);
```

**Escape hatch** — `untrack(fn)` reads without registering a dependency.

**Debugging** — nodes are named after the fields holding them (`UserStore.users`)
once the store is initialised, so `node.name` is legible in a debugger.

---

## TypeScript Utilities

```ts
import type {
	AtomValue,
	ComputedValue,
	StoreAtoms,
	StoreActions,
} from '@7otion/store';

type Users = AtomValue<typeof userStore.users>; // User[]
type Count = ComputedValue<typeof userStore.count>; // number

type UserAtoms = StoreAtoms<UserStore>; // { users: Atom<User[]>; … }
type UserActions = StoreActions<UserStore>; // { createUser: …; deleteUser: … }
```

---

## Development

```bash
bun install
bun run test
bun run typecheck
bun run build
```

Tests run on bun test v1.3.10 (30e609e0), with a happy-dom DOM preloaded from `test/setup.ts`.
No Node.js installation is required.

---

## Migrating from 0.0.1

`computed` no longer takes a dependency array — dependencies are tracked by
running the function:

```ts
// before
readonly total = this.computed([this.items], () => this.items.value.length);

// after
readonly total = this.computed(() => this.items.value.length);
```

The `equal` option was renamed to `equals`. Everything else — `this.atom()`,
`.value` / `.get()` / `.set()`, `batch()`, the hooks, the registry — is unchanged.

---

## License

MIT
