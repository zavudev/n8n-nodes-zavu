# End-to-end tests

Runs the built package inside a real n8n and asserts on what actually happened.

```bash
npm run build
npm run test:e2e
```

Needs `n8n` on PATH (`npm i -g n8n`), `sqlite3`, and Node 20+. Nothing else: no
Zavu account, no API key, no messages sent, no money spent.

## Why this exists

The unit tests check the node against the Zavu backend's own schemas, which is
the right way to catch the node and the API drifting apart. What they cannot
catch is everything at the n8n boundary, because there they only prove that the
code agrees with the assumptions in the test file.

Two bugs got through the unit tests and were caught here on the first run:

- **API errors arrived as "Bad request - please check your parameters".** n8n's
  request helper already wraps failures in a `NodeApiError` carrying the API's
  message; the node wrapped it a second time and threw all of it away. The unit
  test passed because it hand-built the error shape the node expected.
- **`npm run build` could produce an empty `dist/`.** An incremental `tsc`
  sharing its buildinfo with a preceding `--noEmit` typecheck concluded nothing
  had changed and emitted nothing after the clean, packing a 9 kB tarball that
  installs fine and fails at load. The harness now refuses to run if the tarball
  has no compiled nodes.

## How it works

`run.sh` builds a throwaway n8n in `$TMPDIR/zavu-n8n-e2e`:

1. Packs the package and installs the tarball into `.n8n/nodes`, then writes the
   `installed_packages` / `installed_nodes` rows. That is what the Community
   Nodes UI does, and it matters: the `custom/` folder would register the nodes
   under the package name `CUSTOM`, exercising neither the `n8n` block in
   `package.json` nor the node type ids a real workflow references.
2. Points the credential's **Base URL** at `mock-zavu.mjs` on 127.0.0.1:8787, a
   stand-in for `api.zavu.dev` that copies the real response envelopes, cursor
   pagination and `{code, message}` error body, and records every request.
3. Runs five workflows through `n8n execute` covering a send, a template send,
   paginated listing, batch email validation, and a 400.
4. Publishes the trigger workflow, starts the server, and lets activation
   register the webhook against the mock. `WEBHOOK_URL` is a public-looking
   HTTPS address because Zavu refuses anything else; deliveries then go to
   localhost, which is what a tunnel does in production.
5. Delivers four webhooks: correctly signed, an unsubscribed event, a body
   tampered with after signing, and one with no signature at all.
6. Deactivates the workflow and checks the sender's webhook is cleared.

`assert.mjs` then turns the run into pass/fail from two sources of evidence: the
mock's recording of what left n8n, and n8n's own execution database for what it
produced.

## What this does not cover

- **The real API.** Every response here comes from the mock. The node's agreement
  with production is covered by the unit tests, which import the backend's
  `messageRequestSchema`, `signWebhookPayload` and `WEBHOOK_EVENTS` directly.
- **A real delivery.** Nothing reaches a carrier, an inbox, or a phone.
- **The n8n UI.** Parameters are set in the workflow JSON, so this proves the
  node executes correctly, not that the fields are laid out well.

To close the first two, run it against a dev deployment: point `baseUrl` in
`credentials.json` at that deployment, put a real key in `apiKey`, and drop the
mock from `run.sh`.
