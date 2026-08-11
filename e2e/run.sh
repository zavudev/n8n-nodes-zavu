#!/usr/bin/env bash
# End-to-end run of the Zavu nodes inside a real n8n.
#
# Unit tests prove the node builds the right request. They cannot prove n8n
# loads the package, hands the credential over, calls the webhook hooks on
# activation, or renders an API error legibly. Those live at this boundary, and
# two real bugs were found here that every unit test had passed.
#
# Everything is isolated: its own n8n user folder, its own SQLite database, and
# a mock Zavu API on 127.0.0.1:8787 that the credential points at. No Zavu
# account, no API key, no money, no messages sent.
#
#   ./e2e/run.sh
#
# Requires: n8n on PATH (npm i -g n8n), sqlite3, node 20+.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$(cd "$HERE/.." && pwd)"
BASE_URL="https://n8n-e2e.example.test"

# Deliberately outside the package. npm walks up looking for a project root, so
# an n8n home nested inside apps/n8n-nodes-zavu/ makes `npm install` write its
# dependency into THIS package's package.json instead of the sandbox's.
WORK="${TMPDIR:-/tmp}/zavu-n8n-e2e"

export N8N_USER_FOLDER="$WORK/n8n-home"
export N8N_ENCRYPTION_KEY="e2e-encryption-key-do-not-reuse"
export WEBHOOK_URL="$BASE_URL"
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_TEMPLATES_ENABLED=false
export N8N_SECURE_COOKIE=false
export N8N_PERSONALIZATION_ENABLED=false
export N8N_LOG_LEVEL=warn

OUT="$WORK/out"
rm -rf "$WORK"
mkdir -p "$N8N_USER_FOLDER/.n8n/nodes" "$OUT"
export RECORD="$OUT/requests.json"

cleanup() { kill ${N8N_PID:-0} ${MOCK_PID:-0} 2>/dev/null; }
trap cleanup EXIT

echo "== packing and installing the community package"
TARBALL="$(cd "$PKG" && npm pack --silent --pack-destination "$OUT")"
# An empty dist/ packs and installs without complaint and only fails at load
# time, so check the tarball carries the nodes before trusting the run.
tar -tzf "$OUT/$TARBALL" | grep -q "package/dist/nodes/Zavu/Zavu.node.js" \
  || { echo "FATAL: the tarball has no compiled nodes. Run 'npm run build' first."; exit 1; }
( cd "$N8N_USER_FOLDER/.n8n/nodes" && npm init -y >/dev/null 2>&1 \
  && npm install "$OUT/$TARBALL" --no-audit --no-fund --silent )
echo "   $TARBALL"

echo "== starting the mock Zavu API"
node "$HERE/mock-zavu.mjs" > "$OUT/mock.log" 2>&1 &
MOCK_PID=$!
until curl -s -o /dev/null "http://127.0.0.1:8787/v1/me"; do sleep 0.2; done

echo "== importing the credential and workflows"
n8n import:credentials --input="$HERE/credentials.json" >/dev/null 2>&1
n8n import:workflow --input="$HERE/workflows.json" >/dev/null 2>&1

# Installing into .n8n/nodes is only half of what the Community Nodes UI does;
# these rows are the other half, and without them n8n never loads the package
# under its real name.
VERSION="$(node -p "require('$PKG/package.json').version")"
sqlite3 "$N8N_USER_FOLDER/.n8n/database.sqlite" <<SQL >/dev/null
INSERT OR REPLACE INTO installed_packages
  (packageName, installedVersion, authorName, authorEmail, createdAt, updatedAt)
VALUES ('n8n-nodes-zavu', '$VERSION', 'Zavu', 'support@zavu.dev',
        STRFTIME('%Y-%m-%d %H:%M:%f','NOW'), STRFTIME('%Y-%m-%d %H:%M:%f','NOW'));
INSERT OR REPLACE INTO installed_nodes (name, type, latestVersion, package)
VALUES ('Zavu', 'n8n-nodes-zavu.zavu', 1, 'n8n-nodes-zavu'),
       ('Zavu Trigger', 'n8n-nodes-zavu.zavuTrigger', 1, 'n8n-nodes-zavu');
SQL

echo "== running the action workflows"
for wf in wfSend wfList wfEmail wfTemplate wfError; do
  n8n execute --id="$wf" > "$OUT/$wf.log" 2>&1
  printf "   %-12s exit=%s\n" "$wf" "$?"
done

echo "== publishing the trigger workflow"
# n8n 2.x renamed activation to publishing. Setting workflow_entity.active in
# SQLite looks like it works and silently activates nothing.
n8n publish:workflow --id=wfTrigger >/dev/null 2>&1

echo "== starting n8n"
n8n start > "$OUT/n8n.log" 2>&1 &
N8N_PID=$!
until curl -s -o /dev/null "http://127.0.0.1:5678/healthz"; do sleep 1; done
sleep 4   # activation registers the webhook a moment after the port opens

curl -s -X POST "http://127.0.0.1:5678/rest/owner/setup" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@example.com","firstName":"E","lastName":"Two","password":"Password123"}' \
  -c "$OUT/cookies.txt" -o /dev/null

REGISTERED="$(node -e "
const rs = require('$RECORD');
const p = rs.filter(r => r.method === 'PATCH' && r.body && r.body.webhookUrl).pop();
console.log(p ? p.body.webhookUrl : '');
")"
echo "   sender webhook registered as ${REGISTERED:-<none>}"
[ -n "$REGISTERED" ] || { echo "FATAL: the trigger never registered its webhook"; exit 1; }
LOCAL_URL="${REGISTERED/$BASE_URL/http://127.0.0.1:5678}"

echo "== delivering webhooks"
for scenario in inbound wrong-event tampered; do
  printf "   %-12s " "$scenario"
  node "$HERE/deliver-webhook.mjs" "$LOCAL_URL" "$scenario"
done
printf "   %-12s " "unsigned"
curl -s -o /dev/null -w '{"scenario":"unsigned","status":%{http_code}}\n' \
  -X POST "$LOCAL_URL" -H "Content-Type: application/json" \
  -d '{"type":"message.inbound","data":{"text":"unsigned"}}'
sleep 2

echo "== deactivating (the sender's webhook should be cleared)"
curl -s -b "$OUT/cookies.txt" -X POST \
  "http://127.0.0.1:5678/rest/workflows/wfTrigger/deactivate" -o /dev/null
sleep 3

echo
node "$HERE/assert.mjs" "$RECORD" "$N8N_USER_FOLDER/.n8n/database.sqlite"
