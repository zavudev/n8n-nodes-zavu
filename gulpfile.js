const path = require('path');
const { task, src, dest } = require('gulp');

// tsc emits .js/.d.ts only. n8n loads the icon and the codex JSON from the same
// folder as the compiled node, so both have to be copied in after every build.
task('build:icons', copyAssets);

function copyAssets() {
	const nodeSource = path.resolve('nodes', '**', '*.{png,svg,json}');
	const nodeDestination = path.resolve('dist', 'nodes');

	return src(nodeSource, { encoding: false }).pipe(dest(nodeDestination));
}
