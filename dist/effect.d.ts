import { type Unsubscribe } from './graph';
export type EffectCleanup = void | (() => void);
export interface EffectOptions {
    name?: string;
}
/**
 * Runs `fn` now and again whenever anything it read changes. A returned
 * function cleans up before the next run and on stop.
 */
export declare function effect(fn: () => EffectCleanup, options?: EffectOptions): Unsubscribe;
//# sourceMappingURL=effect.d.ts.map