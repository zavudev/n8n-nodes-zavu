/**
 * Turns the run into a pass/fail. Reads what actually left n8n (the mock's
 * recording) and what n8n actually produced (its execution database), so every
 * check is evidence rather than a log line that looked fine.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [recordPath, dbPath] = process.argv.slice(2);
const requests = JSON.parse(readFileSync(recordPath, 'utf8')).filter(
	(r) => r.userAgent === 'n8n-nodes-zavu',
);

const rows = JSON.parse(
	execFileSync(
		'sqlite3',
		[
			'-json',
			dbPath,
			'select e.id, e.workflowId, e.status, d.data from execution_entity e join execution_data d on d.executionId = e.id order by e.id;',
		],
		{ maxBuffer: 64 * 1024 * 1024 },
	).toString() || '[]',
);

/** n8n stores execution data flattened; rehydrate it to read the items. */
function rehydrate(flat) {
	const seen = new Map();
	const resolve = (ref) => {
		if (typeof ref === 'string' && /^\d+$/.test(ref)) {
			const i = Number(ref);
			if (i >= 0 && i < flat.length) {
				if (seen.has(i)) return seen.get(i);
				const val = flat[i];
				if (val && typeof val === 'object') {
					const out = Array.isArray(val) ? [] : {};
					seen.set(i, out);
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

const runs = rows.map((row) => {
	const data = rehydrate(JSON.parse(row.data));
	const runData = data?.resultData?.runData ?? {};
	const nodeName = Object.keys(runData).find((n) => n.startsWith('Zavu'));
	const items = runData[nodeName]?.[0]?.data?.main?.[0] ?? [];
	return {
		id: row.id,
		workflow: row.workflowId,
		status: row.status,
		items: items.map((i) => i.json),
		error: data?.resultData?.error,
	};
});

const run = (wf) => runs.find((r) => r.workflow === wf);
const sent = (method, pathIncludes) =>
	requests.filter((r) => r.method === method && r.path.includes(pathIncludes));

let failures = 0;
function check(name, condition, detail = '') {
	const ok = Boolean(condition);
	if (!ok) failures++;
	console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail && !ok ? `\n        ${detail}` : ''}`);
}

console.log('n8n loads the package');
check('the Zavu node executed at all', runs.some((r) => r.workflow === 'wfSend'));

console.log('\ncredential and request wiring');
check(
	'the API key from the credential is sent as a bearer token',
	requests.every((r) => r.auth === 'Bearer zv_test_e2e_key'),
);
const send = sent('POST', '/v1/messages')[0];
check('the sender goes in the Zavu-Sender header, not the body', send?.sender === 'snd_e2e_primary' && send?.body?.['Zavu-Sender'] === undefined);
check(
	'the send body matches the API contract',
	send?.body?.to === '+56912345678' && send?.body?.channel === 'whatsapp' && send?.body?.text,
	JSON.stringify(send?.body),
);
check('metadata is flattened to a string map', send?.body?.metadata?.source === 'n8n-e2e');
check('the idempotency key is passed through', send?.body?.idempotencyKey === 'e2e-run-1');

const templateSend = sent('POST', '/v1/messages').find((r) => r.body?.messageType === 'template');
check(
	'template variables are keyed the way the API expects',
	templateSend?.body?.content?.templateVariables?.['1'] === 'Jane',
	JSON.stringify(templateSend?.body?.content),
);

console.log('\nresponses');
check('a send emits the message itself, not the envelope', run('wfSend')?.items[0]?.id === 'msg_e2e_1');
check(
	'Return All walks every page',
	run('wfList')?.items.length === 3,
	`got ${run('wfList')?.items.length} items`,
);
check(
	'pagination passes the cursor back verbatim',
	sent('GET', '/v1/messages').some((r) => r.query?.cursor === 'page2'),
);
check(
	'email validation emits one item per address',
	run('wfEmail')?.items.length === 2 && run('wfEmail')?.items[1]?.verdict === 'risky',
);

console.log('\nerrors');
const errRun = run('wfError');
check('a 400 fails the node', errRun?.status === 'error');
check(
	"the API's own message reaches the user",
	/24-hour window is not open/.test(
		`${errRun?.error?.description ?? ''} ${(errRun?.error?.messages ?? []).join(' ')}`,
	),
	`message=${errRun?.error?.message} description=${errRun?.error?.description}`,
);

console.log('\ntrigger lifecycle');
const registration = sent('PATCH', '/v1/senders').find((r) => r.body?.webhookUrl);
check('activation registers the webhook on the sender', Boolean(registration));
check(
	'it subscribes only to the selected events',
	JSON.stringify(registration?.body?.webhookEvents) === '["message.inbound"]',
);
check(
	'it sets webhookActive, without which nothing is ever delivered',
	registration?.body?.webhookActive === true,
);

const triggerRuns = runs.filter((r) => r.workflow === 'wfTrigger');
const ok = triggerRuns.find((r) => r.status === 'success');
check('a correctly signed delivery runs the workflow', Boolean(ok));
check(
	'the payload reaches the workflow intact',
	ok?.items[0]?.type === 'message.inbound' && ok?.items[0]?.data?.from === '+56912345678',
);
check(
	'an event the workflow did not subscribe to starts nothing',
	triggerRuns.length === 3,
	`expected 3 executions (1 ok + 2 rejected), got ${triggerRuns.length}`,
);
check(
	'a tampered body is rejected, visibly',
	triggerRuns.some((r) => /signature mismatch/.test(r.error?.message ?? '')),
);
check(
	'an unsigned delivery is rejected, visibly',
	triggerRuns.some((r) => /no X-Zavu-Signature header/.test(r.error?.message ?? '')),
);

const cleared = sent('PATCH', '/v1/senders').find((r) => r.body?.webhookUrl === null);
check('deactivation clears the webhook it installed', Boolean(cleared));

console.log(
	`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`,
);
process.exit(failures === 0 ? 0 : 1);
