# n8n-nodes-zavu

Zavu nodes for [n8n](https://n8n.io). One API for SMS, WhatsApp, Telegram, Email,
Instagram, Messenger and Voice — wired into n8n as an action node and a trigger.

Two nodes ship in this package:

- **Zavu** — send messages, run broadcasts, manage contacts, conversations,
  templates, senders, phone numbers, AI agents and voice calls.
- **Zavu Trigger** — start a workflow when a message arrives, a delivery status
  changes, a conversation opens, or a call ends.

The Zavu node is also exposed as a tool, so an n8n AI Agent can send a WhatsApp
message or look up a conversation on its own.

## Install

**From the n8n UI** (self-hosted): **Settings → Community Nodes → Install**, enter
`n8n-nodes-zavu`, and confirm.

**Manually**, in your n8n user folder (`~/.n8n`):

```bash
npm install n8n-nodes-zavu
```

Restart n8n afterwards.

**n8n Cloud** installs community nodes from the Nodes panel, but only ones n8n
has verified. This package is not verified yet, so it currently needs
self-hosted n8n. See [VERIFICATION.md](VERIFICATION.md) for where it stands
against n8n's checklist.

## Credentials

Create a **Zavu API** credential with a project API key from **Dashboard →
Settings → API Keys**.

| Field | Notes |
|---|---|
| API Key | `zv_live_…` for production, `zv_test_…` for test mode |
| Base URL | `https://api.zavu.dev`. Only change it to point at a non-production deployment. |

Use **Test** on the credential to confirm the key resolves to a project — it calls
`GET /v1/me` and nothing else.

A `zv_test_` key runs in test mode: sends are simulated against the WhatsApp
sandbox rather than reaching the recipient, and voice calls are not available at
all. Use a live key for anything that must actually be delivered.

## Zavu node

| Resource | Operations |
|---|---|
| Message | Send · Get · Get Many · Get Attachments · React · Show Typing Indicator |
| Conversation | Get · Get Many · Get Messages · Mark as Read |
| Contact | Create · Get · Get by Phone · Get Many · Update · Delete · Add Channel · Merge |
| Template | Create · Get · Get Many · Delete · Submit for Approval |
| Broadcast | Create · Add Contacts · Send · Get · Get Many · Get Progress · Cancel · Delete |
| Sender | Create · Get · Get Many · Update · Delete |
| Agent | Create · Get · Get Many · Update · Delete · Test · Connect Sender · Disconnect Sender |
| Voice Call | Create · Get · Get Many · Hang Up |
| Phone Number | Search Available · Purchase · Get · Get Many · Update · Release |
| Utility | Validate Phone · Validate Email · Submit URL · Get Balance · Get Account |
| Custom API Call | Any endpoint, same credential and error handling |

Every list operation paginates with the API's cursor, so **Return All** genuinely
walks to the end rather than stopping at the first 100.

Responses are unwrapped: the node emits the entity itself, so `{{ $json.id }}`
works the same whichever resource produced it. List operations emit one n8n item
per element.

### Sending

**Channel** defaults to `Auto`, which lets Zavu route on the sender's
capabilities and the recipient. Any non-text message type goes over WhatsApp
regardless of what is selected here.

**To** accepts a phone number in E.164, an email address, a numeric chat ID
(Telegram, Instagram, Messenger) or a WhatsApp business-scoped user ID.

Message types the node builds for you: text, image, video, audio, document,
sticker, location, contact card, buttons, list, CTA URL button, location request,
contact info request, and template.

Two of these are worth calling out because the API treats them differently:
`Location Request` and `Contact Info Request` are WhatsApp-only and carry their
whole prompt in **Text**; they take no other content.

### Broadcasts from a list

**Broadcast → Add Contacts** can read one recipient per incoming item, which is
the shape a spreadsheet or database node produces. Recipients are sent in batches
of 1000 (the endpoint's limit), so a 5000-row sheet works in one node.

Sending a broadcast requires both identity (KYC) and business (KYB) verification
on the team, and passes through content review. Drafts need neither.

## Zavu Trigger

Pick a **sender** and the **events** to react to. On activation the node points
that sender's webhook at n8n; on deactivation it puts back whatever was there
before, or clears it if there was nothing.

Three things about Zavu webhooks decide how this node behaves, and all three are
surfaced rather than worked around:

**Zavu only delivers to HTTPS.** A local n8n hands out
`http://localhost:5678/…`, which the API refuses. The node checks the URL before
registering and tells you to expose n8n over HTTPS (a tunnel, or `WEBHOOK_URL`
set to your public address) instead of failing with a 400 about a URL you never
typed.

**A sender has exactly one webhook URL.** If the sender already points somewhere
else, activation stops and names the URL currently configured. Turn on **Replace
Existing Webhook** to repoint it here — that receiver stops getting anything
until you deactivate this trigger, at which point its URL is restored.

**The webhook secret is only revealed once.** Zavu mints and returns a secret when
it configures a webhook on a sender that had none; for a sender that already had
one, the existing secret is kept and never re-shown. The node stores what it is
given and verifies every delivery against it. When it has no secret it says so on
the first delivery rather than accepting unsigned traffic while reporting
"Verify Signature: true" — paste the secret into **Webhook Secret**, or turn
verification off deliberately.

Signature verification accepts both schemes Zavu emits (`v1` and `v2`), prefers
`v2` when a delivery carries both, and rejects replays older than the tolerance.
It is pinned against the backend's own signer by the test suite.

If you would rather configure the webhook yourself in the dashboard, turn off
**Register Webhook Automatically**; the node then only listens.

### What the trigger emits

The webhook payload as sent, including `id`, `type`, `timestamp`, `senderId`,
`projectId` and `data`. Deliveries whose `type` is not in the node's event list
are answered 200 and dropped — a sender's other subscribers do not fire this
workflow.

## Example: reply to every inbound WhatsApp message

1. **Zavu Trigger** — sender: your number, events: `Message: Inbound`.
2. **Zavu** — Message → Send, To `{{ $json.data.from }}`, Channel WhatsApp, and
   under Options set **Sender** to `{{ $json.senderId }}` so the reply leaves
   from the number the contact already knows.

For a slow reply (an LLM, a lookup), put **Message → Show Typing Indicator** with
`{{ $json.data.messageId }}` in front of it. The indicator clears when the reply
lands, or after 25 seconds.

## Development

```bash
npm install
npm run build      # tsc + copy icons and codex JSON into dist/
npm run lint       # n8n community-node rules
npm test           # unit tests
npm run test:e2e   # runs the built package inside a real n8n
```

The unit tests check this package against the Zavu backend rather than against
its own assumptions: message bodies are validated with the API's request schema,
the signature verifier is exercised with the API's signer, and the trigger's
event list is compared to the backend's list of dispatchable events. A change on
either side that would break a customer's workflow fails here first.

`npm run test:e2e` covers what unit tests structurally cannot: that n8n loads the
package, passes the credential, registers and tears down the sender's webhook on
activation, verifies signatures, and surfaces an API error legibly. It needs
`n8n` on PATH and no Zavu account. See [e2e/README.md](e2e/README.md).

To try the nodes in a local n8n:

```bash
npm run build
npm link
cd ~/.n8n/custom && npm link n8n-nodes-zavu
```

Then restart n8n. Remember that the trigger needs an HTTPS webhook URL to
register automatically.

## Links

- [Zavu documentation](https://docs.zavu.dev)
- [API reference](https://docs.zavu.dev/api-reference)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
