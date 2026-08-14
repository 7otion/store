import { Derived, type Unsubscribe } from './graph';

export type EffectCleanup = void | (() => void);

export interface EffectOptions {
	name?: string;
}

class EffectNode extends Derived<void> {
	/** @internal */
	readonly _type = 'effect' as const;

	private _fn: () => EffectCleanup;
	private _cleanup: EffectCleanup;
	private _stopped = false;

	constructor(fn: () => EffectCleanup, options?: EffectOptions) {
		super(options?.name ?? 'effect');
		this._fn = fn;
		this._update();
	}

	/** Always watched, which is what makes an effect eager. */
	override get _watched(): boolean {
		return !this._stopped;
	}

	protected _run(): void {
		this._runCleanup();
		this._cleanup = this._fn();
	}

	/** No value to compare — being stale is reason enough to run. */
	override _notify(): void {
		if (this._stopped) return;
		this._update();
	}

	override dispose(): void {
		this._stopped = true;
		this._runCleanup();
		super.dispose();
	}

	private _runCleanup(): void {
		const cleanup = this._cleanup;
		this._cleanup = undefined;
		if (typeof cleanup === 'function') cleanup();
	}
}

/**
 * Runs `fn` now and again whenever anything it read changes. A returned
 * function cleans up before the next run and on stop.
 */
export function effect(
	fn: () => EffectCleanup,
	options?: EffectOptions,
): Unsubscribe {
	const node = new EffectNode(fn, options);
	return () => node.dispose();
}
