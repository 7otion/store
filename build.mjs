import { rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

rmSync('dist', { recursive: true, force: true });

// Declarations first, so bad types block the JS. Run through the current
// runtime, which needs no `tsc` on PATH and works under both node and bun.
const require = createRequire(import.meta.url);
execFileSync(
	process.execPath,
	[require.resolve('typescript/bin/tsc'), '--emitDeclarationOnly'],
	{ stdio: 'inherit' },
);

const shared = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	minify: true,
	sourcemap: true,
	target: 'es2022',
	external: ['react', 'react-dom', 'react/jsx-runtime'],
};

await Promise.all([
	build({ ...shared, format: 'cjs', outfile: 'dist/index.js' }),
	build({ ...shared, format: 'esm', outfile: 'dist/index.mjs' }),
]);

console.log('Build complete.');
