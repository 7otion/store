import type { Atom } from './atom';
import { type Unsubscribe } from './graph';
/**
 * A class an atom may be about. One that knows what else shows through it, an
 * ORM model say, answers `affectedBy` itself.
 */
export type HeldClass = (abstract new (...args: any[]) => object) & {
    affectedBy?(instance: object): boolean;
};
/** @internal */
export declare function affects(held: HeldClass, instance: object): boolean;
/** Tells the store which instances changed in place. */
export type ChangeReport = (changed: readonly object[]) => void;
/** Subscribes a report callback and returns the unsubscribe. */
export type ChangeSource = (report: ChangeReport) => Unsubscribe;
/**
 * Sets the source whose reports republish atoms made with `atomOf`. Replaces
 * any previous source; `null` disconnects.
 */
export declare function configureChangeSource(source: ChangeSource | null): void;
/** @internal */
export declare function registerHolder(atom: Atom<unknown>): void;
/** @internal */
export declare function unregisterHolder(atom: Atom<unknown>): void;
//# sourceMappingURL=change-source.d.ts.map