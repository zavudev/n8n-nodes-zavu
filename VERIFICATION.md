# n8n verification status

n8n Cloud installs community nodes from the Nodes panel, but only ones n8n has
**verified**. Unverified packages require self-hosted n8n. Verification is
therefore the difference between "our customers on Cloud can use this" and "they
cannot", and it is worth treating as part of shipping rather than as polish.

Checked against n8n's
[verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines)
on 2026-08-11.

## Where this package stands

| Requirement | Status |
|---|---|
| MIT licence | Yes |
| No runtime dependencies | Yes. `dependencies` is empty; only devDependencies and a `n8n-workflow` peer. |
| Package name `n8n-nodes-*` | `n8n-nodes-zavu` |
| `n8n-community-node-package` keyword | Present |
| Nodes and credentials declared in the `n8n` block | Present, and the e2e run proves the paths resolve |
| No environment variables, no filesystem access | Yes. Credentials come from n8n; nothing reads `process.env` or touches disk. |
| One third-party service per package | Zavu only |
| Not a duplicate of an existing node | No Zavu node exists |
| Not a logic or flow-control node | It is an action node and a trigger |
| English only, in the UI and the docs | Yes |
| README with usage, auth and API links | Yes |
| Passes `npx @n8n/scan-community-package` | **Cannot run yet.** The scanner analyses a package by name from the npm registry, so it only works after the first publish. |

## The publishing pipeline

Since 1 May 2026 n8n does not verify nodes published from a laptop: the package
must be published by a GitHub Actions workflow emitting an npm provenance
statement. Provenance binds a package to a **public** repository and commit,
which a private monorepo cannot provide, so the node is mirrored the same way
`packages/skills` and `apps/inbox` already are.

Three workflows, all written and in the repo:

| Workflow | Runs in | Does |
|---|---|---|
| `.github/workflows/n8n-node-publish.yml` | monorepo | Mirrors `apps/n8n-nodes-zavu/` to `zavudev/n8n-nodes-zavu` on every push to `main` that touches it |
| `apps/n8n-nodes-zavu/.github/workflows/ci.yml` | mirror | Lint, test, build on every push and PR, so a bad sync is caught before a release |
| `apps/n8n-nodes-zavu/.github/workflows/publish.yml` | mirror | `npm publish` on a GitHub release, authenticated by trusted publishing |

Publishing uses npm's **trusted publishing** (OIDC), so no npm token is stored
anywhere: `id-token: write` lets GitHub mint the token npm verifies, and
provenance is generated automatically for a public repo (which is why
`--provenance` is deliberately absent from the publish command). It needs npm
11.5.1+ and Node 22.14+, so the workflow upgrades npm rather than trusting the
runner's bundled version.

## What is still needed, and only a human can do it

1. **Create `zavudev/n8n-nodes-zavu`** as a public repository with an initial
   commit on `main`, so the mirror has somewhere to push.
2. **Grant the "Zavu Release Bot" GitHub App** `Contents: read+write` on it. The
   App already has `zavu`, `zavu-cli`, `zavu-skills` and `homebrew-tools`.
3. **Merge to `main`.** The mirror runs and populates the public repo.
4. **Configure the trusted publisher on npmjs.com**, which requires the package
   to exist. For a first publish, either publish once manually and then add the
   trusted publisher, or create the package as a placeholder and let the
   workflow publish the first real version. Settings live under
   *Publish access -> Trusted Publishers*: provider GitHub Actions, owner
   `zavudev`, repository `n8n-nodes-zavu`, workflow `publish.yml`.
5. **Publish a GitHub release** in the mirror to trigger the first publish.
6. **Submit for verification** to n8n. They reserve the right to reject nodes
   that compete with their paid features.

Note that a manual `npm publish` gets the package installable on self-hosted
n8n immediately, but a package whose published versions have no provenance is
not on the path to verification. If Cloud availability matters, let CI do it.

## Sources

- https://docs.n8n.io/integrations/community-nodes/installation-and-management
- https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines
- https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes
