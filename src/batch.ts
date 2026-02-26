type Listener = () => void;

let batchDepth = 0;
const pendingListeners = new Set<Listener>();

/**
 * Batch multiple state updates into a single notification pass.
 * Prevents intermediate re-renders when updating several atoms at once.
 *
 * @example
 * batch(() => {
 *   store.firstName.set("John");
 *   store.lastName.set("Doe");
 *   store.age.set(30);
 * });
 * // Components only re-render once
 */
export function batch(fn: () => void): void {
	batchDepth++;
	try {
		fn();
	} finally {
		batchDepth--;
		if (batchDepth === 0) {
			// Drain the queue — snapshot first to handle nested triggers
			const toFlush = [...pendingListeners];
			pendingListeners.clear();
			toFlush.forEach(l => l());
		}
	}
}

export function scheduleNotify(listener: Listener): void {
	if (batchDepth > 0) {
		pendingListeners.add(listener);
	} else {
		listener();
	}
}
