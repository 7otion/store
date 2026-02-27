import { build } from 'esbuild';

const external = [
	'react',
	'react-dom',
	'react/jsx-runtime',
];

const shared = {
	entryPoints: ['src/index.ts'],
	bundle: true,
	minify: true,
	external,
};

await Promise.all([
	build({ ...shared, format: 'cjs', outfile: 'dist/index.js' }),
	build({ ...shared, format: 'esm', outfile: 'dist/index.mjs' }),
]);

console.log('Build complete.');
