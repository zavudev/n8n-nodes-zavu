/**
 * n8n stores execution data flattened (every value replaced by an index into a
 * string table). Rehydrate it so we can assert on the items the Zavu node
 * actually emitted, not on a log line.
 */
import { execFileSync } from 'node:child_process';

const DB = new URL('./n8n-home/.n8n/database.sqlite', import.meta.url).pathname;

const rows = execFileSync(
	'sqlite3',
	['-json', DB, 'select e.workflowId, e.status, d.data from execution_entity e join execution_data d on d.executionId = e.id order by e.id;'],
	{ maxBuffer: 64 * 1024 * 1024 },
).toString();

function rehydrate(flat, seen = new Map()) {
	const table = flat;
	const resolve = (ref) => {
		if (typeof ref === 'string' && /^\d+$/.test(ref)) {
			const i = Number(ref);
			if (i >= 0 && i < table.length) {
				if (seen.has(i)) return seen.get(i);
				const out = Array.isArray(table[i]) ? [] : typeof table[i] === 'object' && table[i] ? {} : table[i];
				seen.set(i, out);
				const val = table[i];
				if (val && typeof val === 'object') {
					for (const [k, v] of Object.entries(val)) out[k] = resolve(v);
					return out;
				}
				return val;
			}
		}
		return ref;
	};
	return resolve('0');
}

for (const row of JSON.parse(rows)) {
	const flat = JSON.parse(row.data);
	const data = rehydrate(flat);
	const runData = data?.resultData?.runData ?? {};
	const zavu = runData.Zavu?.[0];

	console.log(`\n=== ${row.workflowId} [${row.status}]`);

	if (row.status === 'error') {
		const err = data?.resultData?.error ?? zavu?.error;
		console.log('  error message :', err?.message);
		console.log('  description   :', err?.description);
		continue;
	}

	const items = zavu?.data?.main?.[0] ?? [];
	console.log(`  items emitted : ${items.length}`);
	for (const item of items.slice(0, 3)) {
		console.log('  ' + JSON.stringify(item.json));
	}
}
