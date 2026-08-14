import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Permits act() outside a test renderer.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	cleanup();
});

/** Settles queued microtasks, including the registry's deferred teardown. */
export function flushMicrotasks(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}
