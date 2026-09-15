import type { Atom } from './atom';
import { batch, type Unsubscribe } from './graph';

/**
 * A class an atom may be about. One that knows what else shows through it, an
 * ORM model say, answers `affectedBy` itself.
 */
export type HeldClass = (abstract new (...args: any[]) => object) & {
	affectedBy?(instance: object): boolean;
};

/** @internal */
export function affects(held: HeldClass, instance: object): boolean {
	return held.affectedBy
		? held.affectedBy(instance)
		: instance instanceof held;
}

/** Tells the store which instances changed in place. */
export type ChangeReport = (changed: readonly object[]) => void;

/** Subscribes a report callback and returns the unsubscribe. */
export type ChangeSource = (report: ChangeReport) => Unsubscribe;

const holders = new Set<Atom<unknown>>();
let disconnect: Unsubscribe | null = null;

/**
 * Sets the source whose reports republish atoms made with `atomOf`. Replaces
 * any previous source; `null` disconnects.
 */
export function configureChangeSource(source: ChangeSource | null): void {
	disconnect?.();
	disconnect = source ? source(republish) : null;
}

/** Touches every atom holding one of the instances, in one flush. */
function republish(changed: readonly object[]): void {
	batch(() => {
		for (const atom of holders) {
			if (atom._holdsAny(changed)) atom.touch();
		}
	});
}

/** @internal */
export function registerHolder(atom: Atom<unknown>): void {
	holders.add(atom);
}

/** @internal */
export function unregisterHolder(atom: Atom<unknown>): void {
	holders.delete(atom);
}
