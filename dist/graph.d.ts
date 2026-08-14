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
export declare const CLEAN = 0;
/** A transitive dependency may have changed. */
export declare const CHECK = 1;
/** A direct dependency changed. */
export declare const DIRTY = 2;
export type NodeState = typeof CLEAN | typeof CHECK | typeof DIRTY;
export declare abstract class ReactiveNode<T> {
    /** Bumps only when the value changes. */
    _version: number;
    _state: NodeState;
    /** Derived nodes that read this one. */
    _observers: Set<Derived<unknown>>;
    _listeners: Set<Listener>;
    /** The version subscribers were last told about. */
    _notifiedVersion: number;
    _name: string;
    protected _value: T;
    constructor(name: string);
    /** No-op for sources. */
    abstract _update(): void;
    get name(): string;
    /** @internal */
    _setName(name: string): void;
    /** Reading inside a computed or effect registers a dependency. */
    get value(): T;
    get(): T;
    /** Reads without registering a dependency. */
    peek(): T;
    subscribe(listener: Listener): Unsubscribe;
    get listenerCount(): number;
    /** Whether this node must be kept eagerly up to date. */
    get _watched(): boolean;
    _notify(): void;
    _markStale(state: NodeState): void;
}
export declare function track(node: ReactiveNode<unknown>): void;
/** Runs `fn` without registering any dependencies. */
export declare function untrack<T>(fn: () => T): T;
export declare abstract class Derived<T> extends ReactiveNode<T> {
    protected _deps: ReactiveNode<unknown>[];
    protected _depVersions: number[];
    /** @internal Non-null only while recomputing. */
    _newDeps: ReactiveNode<unknown>[] | null;
    /** @internal */
    _newDepSet: Set<ReactiveNode<unknown>> | null;
    /** @internal */
    _newDepVersions: number[] | null;
    private _running;
    constructor(name: string);
    /** Produces the new value, or runs the side effect. */
    protected abstract _run(): void;
    _update(): void;
    private _recompute;
    /** Dependencies are re-discovered per run, so an untaken branch is dropped. */
    private _commitDeps;
    /** Unlinks and drops subscribers. The node stays usable and re-runs on next read. */
    dispose(): void;
}
/** @internal */
export declare function enqueue(node: ReactiveNode<unknown>): void;
/** @internal No-op while a batch is open or a flush is already running. */
export declare function flush(): void;
/** Defers recomputation and notification until the outermost batch closes. */
export declare function batch<T>(fn: () => T): T;
export declare function isBatching(): boolean;
/** @internal */
export declare function getCurrentConsumer(): Derived<unknown> | null;
//# sourceMappingURL=graph.d.ts.map