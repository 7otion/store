import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	esbuild: { jsx: 'automatic' },
	test: {
		environment: 'happy-dom',
		globals: true,
		// A relative path trips vite-node's file:// resolution on Windows.
		setupFiles: [
			fileURLToPath(new URL('./test/setup.ts', import.meta.url)),
		],
		include: ['test/**/*.test.{ts,tsx}'],
	},
});
