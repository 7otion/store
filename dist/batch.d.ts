type Listener = () => void;
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
export declare function batch(fn: () => void): void;
export declare function scheduleNotify(listener: Listener): void;
export {};
//# sourceMappingURL=batch.d.ts.map