class-based state management for **React** apps.

```
Stores are Classes → State is Atoms → Actions are Methods → DB stays in sync
```

---

## Core Concepts

| Concept         | What it is                                                               |
| --------------- | ------------------------------------------------------------------------ |
| `Atom<T>`       | A single reactive value. Setting it notifies only subscribed components. |
| `Computed<T>`   | A derived value that auto-updates when its source atoms change.          |
| `Store`         | A class that owns atoms, computeds, and actions.                         |
| `ListStore<T>`  | A base store for DB-backed entity lists (inherit from this).             |
| `StoreRegistry` | Manages store lifetimes and `onInit`/`onDestroy` lifecycle.              |

---

## Quick Start

### 1. Define a Store

```ts
import { Store, batch } from 'tauristore';
import { invoke } from '@tauri-apps/api';

interface User {
	id: number;
	name: string;
	email: string;
}

export class UserStore extends Store {
	// ── State (reactive) ────────────────────────────────────────────────────
	readonly users = this.atom<User[]>([]);
	readonly loading = this.atom(false);
	readonly error = this.atom<string | null>(null);

	// ── Computed (derived, auto-updating) ────────────────────────────────────
	readonly count = this.computed([this.users], () => this.users.value.length);

	// ── Internal (non-reactive, no subscribers) ──────────────────────────────
	private _cache = new Map<number, User>();

	// ── Lifecycle (Repository Pattern) ──────────────────────────────────────
	protected async onInit() {
		this.loading.set(true);
		try {
			const users = await invoke<User[]>('get_users');
			this.users.set(users);
		} catch (err) {
			this.error.set(String(err));
		} finally {
			this.loading.set(false);
		}
	}

	// ── Actions (public methods) ──────────────────────────────────────────────
	async createUser(name: string, email: string) {
		const user = await invoke<User>('create_user', { name, email });

		// Optimistic update — UI is instant, DB is eventually consistent
		this.users.set(prev => [...prev, user]);
		this._cache.set(user.id, user);
	}

	async deleteUser(id: number) {
		const snapshot = this.users.value;
		this.users.set(prev => prev.filter(u => u.id !== id)); // optimistic

		try {
			await invoke('delete_user', { id });
			this._cache.delete(id);
		} catch (err) {
			this.users.set(snapshot); // rollback
			this.error.set(String(err));
		}
	}
}

// App-wide singleton — lives as long as the Tauri window
export const userStore = new UserStore();
```

### 2. Subscribe in Components

```tsx
import {
	useAtom,
	useAtomSelector,
	useAtoms,
	useAtomState,
	useStoreAction,
} from 'tauristore';
import { userStore } from './stores/user-store';

// Fine-grained: re-renders ONLY when `users` changes
function UserList() {
	const users = useAtom(userStore.users);
	return (
		<ul>
			{users.map(u => (
				<UserRow key={u.id} id={u.id} />
			))}
		</ul>
	);
}

// Even more fine-grained: re-renders only when THIS user's data changes
function UserRow({ id }: { id: number }) {
	const user = useAtomSelector(
		userStore.users,
		users => users.find(u => u.id === id),
		(a, b) => a?.name === b?.name && a?.email === b?.email,
	);

	const { run: remove, loading } = useStoreAction(() =>
		userStore.deleteUser(id),
	);

	if (!user) return null;
	return (
		<li>
			{user.name} — {user.email}
			<button onClick={remove} disabled={loading}>
				Delete
			</button>
		</li>
	);
}

// Subscribe to multiple atoms at once — single hook, multiple sources
function StatusBar() {
	const [loading, error, count] = useAtoms(
		userStore.loading,
		userStore.error,
		userStore.count,
	);

	return (
		<div>
			{loading ? 'Syncing...' : `${count} users`} {error}
		</div>
	);
}

// Write-only: never re-renders due to store changes
function CreateUserForm() {
	const [name, setName] = useState('');
	const {
		run: create,
		loading,
		error,
	} = useStoreAction((name: string) =>
		userStore.createUser(name, 'test@example.com'),
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

---

## Store Inheritance — Avoid Code Duplication

The real power: put shared logic in a base store, extend it everywhere.

```ts
// Base store for any DB-backed list
abstract class ListStore<T extends { id: number }> extends Store {
  readonly items   = this.atom<T[]>([]);
  readonly loading = this.atom(false);
  readonly error   = this.atom<string | null>(null);
  readonly count   = this.computed([this.items], () => this.items.value.length);

  protected _upsert(item: T) {
    this.items.set(prev => {
      const i = prev.findIndex(x => x.id === item.id);
      if (i === -1) return [...prev, item];
      const next = [...prev]; next[i] = item; return next;
    });
  }

  protected _remove(id: number) {
    this.items.set(prev => prev.filter(x => x.id !== id));
  }
}

// Get loading/error/count/upsert/remove for free
class ProjectStore extends ListStore<Project> {
  readonly byStatus = this.computed(
    [this.items],
    () => groupBy(this.items.value, "status")
  );

  async fetchProjects() { ... }
  async archiveProject(id: number) { ... }
}

class InvoiceStore extends ListStore<Invoice> {
  readonly total = this.computed(
    [this.items],
    () => this.items.value.reduce((sum, i) => sum + i.amount, 0)
  );

  async fetchInvoices() { ... }
}
```

---

## Batch Updates

Prevent intermediate re-renders when updating multiple atoms at once:

```ts
import { batch } from 'tauristore';

// Without batch: 3 separate re-renders
store.firstName.set('John');
store.lastName.set('Doe');
store.age.set(30);

// With batch: exactly 1 re-render
batch(() => {
	store.firstName.set('John');
	store.lastName.set('Doe');
	store.age.set(30);
});
```

---

## Registry & Lifecycle

For managing store lifetimes and the `onInit`/`onDestroy` hooks:

```tsx
import { StoreProvider, registry } from 'tauristore';
import { userStore } from './stores/user-store';
import { todoStore } from './stores/todo-store';

// Register stores
registry.register('users', userStore);
registry.register('todos', todoStore);

// Wrap your app — autoInit calls onInit() for all registered stores
function App() {
	return (
		<StoreProvider autoInit>
			<Router />
		</StoreProvider>
	);
}
```

---

## Hooks Reference

| Hook                                   | Re-renders when         | Use for                            |
| -------------------------------------- | ----------------------- | ---------------------------------- |
| `useAtom(atom)`                        | Atom value changes      | Reading a single atom              |
| `useAtomState(atom)`                   | Atom value changes      | Read + write (like useState)       |
| `useAtomSet(atom)`                     | **Never**               | Write-only components              |
| `useAtomSelector(atom, selector, eq?)` | Selected slice changes  | Expensive computations, list items |
| `useAtoms(...atoms)`                   | Any of the atoms change | Reading multiple atoms             |
| `useStoreAction(fn)`                   | `loading`/`error` state | Async actions with status          |

---

## TypeScript Utilities

```ts
import type {
	AtomValue,
	ComputedValue,
	StoreAtoms,
	StoreActions,
} from 'tauristore';

// Unwrap atom/computed types
type Users = AtomValue<typeof userStore.users>; // User[]
type Count = ComputedValue<typeof userStore.count>; // number

// Extract all atoms or actions from a store type
type UserAtoms = StoreAtoms<UserStore>; // { users: Atom<User[]>; loading: Atom<boolean>; ... }
type UserActions = StoreActions<UserStore>; // { createUser: ...; deleteUser: ...; }
```
