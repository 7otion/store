/**
 * Push-pull reactive graph.
 *
 * A write marks direct observers DIRTY and everything further downstream CHECK,
 * recomputing nothing. A read pulls: CHECK resolves its dependencies and
 * compares their versions, recomputing only if one moved. Two consequences —
 * a node nothing reads or subscribes to never runs, and a diamond marks its
 * base once so it recomputes once, from a settled graph.
 */

export type Listener = () => void;
export type Unsubscribe = () => void;
export type EqualFn<T> = (a: T, b: T) => boolean;

export const CLEAN = 0;
/** A transitive dependency may have changed. */
export const CHECK = 1;
/** A direct dependency changed. */
export const DIRTY = 2;

export type NodeState = typeof CLEAN | typeof CHECK | typeof DIRTY;

const MAX_FLUSH_PASSES = 1000;

// ─── Globals ──────────────────────────────────────────────────────────────────

/** The derived node currently running. Reads register against it. */
let currentConsumer: Derived<unknown> | null = null;
let batchDepth = 0;
let flushing = false;

/** Watched nodes touched by writes since the last flush. */
const pendingWatchers = new Set<ReactiveNode<unknown>>();

// ─── Base node ────────────────────────────────────────────────────────────────

export abstract class ReactiveNode<T> {
	/** Bumps only when the value changes. */
	_version = 0;
	_state: NodeState = CLEAN;
	/** Derived nodes that read this one. */
	_observers = new Set<Derived<unknown>>();
	_listeners = new Set<Listener>();
	/** The version subscribers were last told about. */
	_notifiedVersion = 0;
	/** A touch reached this node; its next run bumps the version even if the value is equal. */
	_touched = false;
	_name: string;

	protected _value!: T;

	constructor(name: string) {
		this._name = name;
	}

	/** No-op for sources. */
	abstract _update(): void;

	get name(): string {
		return this._name;
	}

	/** @internal */
	_setName(name: string): void {
		this._name = name;
	}

	// ─── Read ────────────────────────────────────────────────────────────────

	/** Reading inside a computed or effect registers a dependency. */
	get value(): T {
		this._update();
		track(this);
		return this._value;
	}

	get(): T {
		return this.value;
	}

	/** Reads without registering a dependency. */
	peek(): T {
		this._update();
		return this._value;
	}

	// ─── Subscriptions ───────────────────────────────────────────────────────

	subscribe(listener: Listener): Unsubscribe {
		const wasWatched = this._watched;
		this._listeners.add(listener);

		if (!wasWatched) {
			// A lazy node has no dependencies to be marked through until it has
			// run once; aligning the version suppresses a spurious first notify.
			this._update();
			this._notifiedVersion = this._version;
		}

		let active = true;
		return () => {
			if (!active) return;
			active = false;
			this._listeners.delete(listener);
			if (!this._watched) pendingWatchers.delete(this);
		};
	}

	get listenerCount(): number {
		return this._listeners.size;
	}

	/** Whether this node must be kept eagerly up to date. */
	get _watched(): boolean {
		return this._listeners.size > 0;
	}

	// ─── Internal ────────────────────────────────────────────────────────────

	_notify(): void {
		this._update();
		if (this._version === this._notifiedVersion) return;
		this._notifiedVersion = this._version;
		// A listener may subscribe or unsubscribe while we iterate.
		for (const listener of [...this._listeners]) listener();
	}

	_markStale(state: NodeState, touched = false): void {
		const newlyTouched = touched && !this._touched;
		if (newlyTouched) this._touched = true;

		if (this._state >= state) {
			// Already stale, but the touch has not been passed down yet.
			if (newlyTouched) {
				for (const observer of this._observers) {
					observer._markStale(CHECK, true);
				}
			}
			return;
		}

		const wasClean = this._state === CLEAN;
		this._state = state;
		if (this._watched) pendingWatchers.add(this);

		// A CHECK → DIRTY upgrade needs no descent: everything below is already
		// at least CHECK, which is enough to make it verify on the next pull.
		if (wasClean || newlyTouched) {
			for (const observer of this._observers) {
				observer._markStale(CHECK, touched);
			}
		}
	}
}

// ─── Dependency tracking ──────────────────────────────────────────────────────

export function track(node: ReactiveNode<unknown>): void {
	const consumer = currentConsumer;
	if (consumer === null) return;

	const seen = consumer._newDepSet;
	if (seen === null || seen.has(node)) return;

	seen.add(node);
	consumer._newDeps!.push(node);
	consumer._newDepVersions!.push(node._version);
}

/** Runs `fn` without registering any dependencies. */
export function untrack<T>(fn: () => T): T {
	const prev = currentConsumer;
	currentConsumer = null;
	try {
		return fn();
	} finally {
		currentConsumer = prev;
	}
}

// ─── Derived nodes ────────────────────────────────────────────────────────────

export abstract class Derived<T> extends ReactiveNode<T> {
	protected _deps: ReactiveNode<unknown>[] = [];
	protected _depVersions: number[] = [];

	/** @internal Non-null only while recomputing. */
	_newDeps: ReactiveNode<unknown>[] | null = null;
	/** @internal */
	_newDepSet: Set<ReactiveNode<unknown>> | null = null;
	/** @internal */
	_newDepVersions: number[] | null = null;

	private _running = false;

	constructor(name: string) {
		super(name);
		this._state = DIRTY;
	}

	/** Produces the new value, or runs the side effect. */
	protected abstract _run(): void;

	_update(): void {
		if (this._state === CLEAN) return;

		if (this._state === CHECK) {
			for (let i = 0; i < this._deps.length; i++) {
				const dep = this._deps[i]!;
				dep._update();
				if (dep._version !== this._depVersions[i]) {
					this._state = DIRTY;
					break;
				}
			}
			if (this._state === CHECK) {
				this._state = CLEAN;
				return;
			}
		}

		this._recompute();
	}

	private _recompute(): void {
		if (this._running) {
			throw new Error(
				`Cycle detected: "${this.name}" depends on its own value.`,
			);
		}

		this._running = true;
		const prevConsumer = currentConsumer;
		currentConsumer = this as Derived<unknown>;
		this._newDeps = [];
		this._newDepSet = new Set();
		this._newDepVersions = [];

		try {
			this._run();
			// A throwing run stays DIRTY, so the next read retries.
			this._state = CLEAN;
		} finally {
			currentConsumer = prevConsumer;
			this._running = false;
			this._touched = false;
			this._commitDeps();
		}
	}

	/** Dependencies are re-discovered per run, so an untaken branch is dropped. */
	private _commitDeps(): void {
		const nextDeps = this._newDeps ?? [];
		const nextSet = this._newDepSet ?? new Set();

		for (const old of this._deps) {
			if (!nextSet.has(old)) {
				old._observers.delete(this as Derived<unknown>);
			}
		}
		for (const dep of nextDeps) {
			dep._observers.add(this as Derived<unknown>);
		}

		this._deps = nextDeps;
		this._depVersions = this._newDepVersions ?? [];
		this._newDeps = null;
		this._newDepSet = null;
		this._newDepVersions = null;
	}

	/** Unlinks and drops subscribers. The node stays usable and re-runs on next read. */
	dispose(): void {
		for (const dep of this._deps) {
			dep._observers.delete(this as Derived<unknown>);
		}
		this._deps = [];
		this._depVersions = [];
		this._listeners.clear();
		this._observers.clear();
		this._state = DIRTY;
		this._notifiedVersion = this._version;
		pendingWatchers.delete(this as ReactiveNode<unknown>);
	}
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

/** @internal */
export function enqueue(node: ReactiveNode<unknown>): void {
	pendingWatchers.add(node);
}

/** @internal No-op while a batch is open or a flush is already running. */
export function flush(): void {
	if (batchDepth > 0 || flushing) return;

	flushing = true;
	try {
		let passes = 0;
		while (pendingWatchers.size > 0) {
			if (++passes > MAX_FLUSH_PASSES) {
				pendingWatchers.clear();
				throw new Error(
					`Updates did not settle after ${MAX_FLUSH_PASSES} passes — ` +
						'a subscriber or effect is writing state that re-triggers itself.',
				);
			}
			const wave = [...pendingWatchers];
			pendingWatchers.clear();
			for (const node of wave) node._notify();
		}
	} finally {
		flushing = false;
	}
}

/** Defers recomputation and notification until the outermost batch closes. */
export function batch<T>(fn: () => T): T {
	batchDepth++;
	try {
		return fn();
	} finally {
		batchDepth--;
		if (batchDepth === 0) flush();
	}
}

export function isBatching(): boolean {
	return batchDepth > 0;
}

/** @internal */
export function getCurrentConsumer(): Derived<unknown> | null {
	return currentConsumer;
}
