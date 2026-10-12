# Nova migration: Feldspar track

Status: **draft for review**. Tracked in the Feldspar Flux project.

This document covers only Feldspar's part of the Nova migration. The overall plan, with the split of `eyra/mono` into Mica (`novasoftwarefoundation/mica`) and Next (`eyra/next`), is in [eyra/mono `doc/nova-migration/plan.md`](https://github.com/eyra/mono/blob/develop/doc/nova-migration/plan.md). The design, including the protocol, is in [eyra/mono `doc/nova-migration/design.md`](https://github.com/eyra/mono/blob/develop/doc/nova-migration/design.md).

## Summary

- **Feldspar moves to the Nova Software Foundation.** `eyra/feldspar` will be transferred to `novasoftwarefoundation/feldspar`. As a GitHub transfer, it keeps its full history, issues, releases and forks.
- **Feldspar's role grows.** It becomes the bridge for third-party development and experimentation on Mica: light, sandboxed apps that run inside any Mica-based SaaS without Elixir. Data donation for the Port program stays its main use.
- **The protocol becomes a public contract.** Today the interface between Feldspar and its host is implicit in the code on both sides. It becomes the documented, versioned **Mica App Protocol**, with a version handshake and contract tests.
- **The track has three parts:**
  - F1: write the protocol spec and add the version handshake
  - F2: shared contract tests
  - F3: the transfer, after a pre-transfer assessment

  F1 and F2 can start now. F3 is independent of the Mica steps, but must not happen in the same window as the production cutover of Next.
- **Two user authorizations are needed:** the transfer itself, and org access in `novasoftwarefoundation`.

---

## 1. The transfer: `eyra/feldspar` → `novasoftwarefoundation/feldspar`

### What changes

| Area | Today | After the transfer | Action |
|---|---|---|---|
| Repository URL | `github.com/eyra/feldspar` | `github.com/novasoftwarefoundation/feldspar` | GitHub redirects web, git and API URLs from the old name, as long as no new `eyra/feldspar` is created. Update links anyway; don't rely on redirects. |
| Git remotes in clones and forks | `git@github.com:eyra/feldspar.git` | Redirected | Tell researchers they can update with `git remote set-url upstream …`. |
| Forks (67 today) | Fork network of `eyra/feldspar` | Same network, new upstream | Forks keep working. "Sync fork" points to the new upstream. Researchers don't need to do anything. |
| Releases | GitHub Releases `feldspar_<date>_<run>_<branch>.zip`, built by [`.github/workflows/release.yml`](../../.github/workflows/release.yml) on every push to `develop`, `master`, `milestone/*` and `feature/*` | Same releases, under the new URL | Check that release asset download links redirect. Update the pinned release URL in the e2e fixture in `eyra/mono`. |
| Package names | `@eyra/feldspar` (library), `@eyra/data-collector` (private app), Python `port` (wheel bundled into the app) | Unchanged at first | None of them is published to npm or PyPI. They are consumed as a workspace package and inside the released zip, so no registry, token or publishing setup has to move. Renaming the npm scope (e.g. `@novasoftwarefoundation/feldspar`) is optional, and only becomes relevant if the library is ever published. |
| CI workflows | `release.yml`, `gh-pages.yml`, `dependabot-auto-merge.yml` | Unchanged | They use only `GITHUB_TOKEN`. Before the transfer, check whether any repository or environment secrets exist (the API did not list any). Re-enable Actions and check workflow permissions in the new org. |
| GitHub Pages | `gh-pages.yml` deploys from `master` | URL would change to `novasoftwarefoundation.github.io/feldspar`, and Pages URLs do **not** redirect | Pages does not appear to be enabled today. The workflow also publishes `packages/data-collector/build`, while Vite builds to `dist`. Fix or remove the workflow first. |
| Dependency bots | Dependabot (auto-merge workflow) and Renovate ([`renovate.json`](../../renovate.json)) | Need installation in the new org | Install the Renovate app for `novasoftwarefoundation`, and enable Dependabot. Remove one of the two to avoid duplicate PRs. |
| Docs and metadata | Mention Eyra and Next | Nova and Mica wording | [`README.md`](../../README.md): repo description "Easily build custom apps for the Next platform", the link to `next.eyra.co`, the Port program link on `eyra.notion.site`, the CONTRIBUTING link to `eyra/feldspar/blob/master`. Also update [`CONTRIBUTING.md`](../../CONTRIBUTING.md), the GitHub description, topics, `SECURITY` contact and the funding note. Keep "how to use your release in Next" as an example of a Mica-based SaaS. |
| Authorship metadata | [`packages/python/pyproject.toml`](../../packages/python/pyproject.toml) lists an Eyra author e-mail | Optional | Keep, or switch to a Nova maintainers address. |
| Licence | AGPL-3.0 ([`LICENSE`](../../LICENSE)) | Unchanged | Who holds the copyright after the move, and whether a contributor agreement is needed, is a legal question shared with Mica (see the main plan's open questions). |
| Issues, PRs, projects | Under `eyra` | Move with the repository | Org-level GitHub Projects don't move. Flux tracking stays in the Feldspar Flux project. |
| Teams and access | Eyra org teams | Nova org teams | The user decides who gets admin and write access in `novasoftwarefoundation`. |

### Pre-transfer assessment

Unlike Mica, Feldspar keeps its **full history**, so the assessment must cover the whole history, not only the current tree:

- **Secrets scan** of all branches and history, for example with gitleaks or trufflehog. Any finding is rotated *before* the transfer. History can't be cleaned after it's public.
- **Eyra-private material** in history, issues and PR discussions: customer or participant data, internal hosts, test files with real data. Data donation fixtures need special attention.
- **Integrations:** installed GitHub Apps (Renovate, Claude review, others), webhooks, deploy keys, Actions secrets and environments, branch protection, rulesets.
- **Downstream consumers** of `eyra/feldspar` URLs:
  - the e2e fixture in `eyra/mono` (`core/frameworks/e2e/controller.ex`, which pins a release URL)
  - Next's own docs and templates
  - Port program pages
  - researchers' forks and documentation
  - any deployed app that loads assets from GitHub at runtime (expected: none, because apps are uploaded as zips)
- **Stale branches:** decide which branches move as they are. There are many `feature/*` and `milestone/*` branches, and each produces a release.

---

## 2. The Mica App Protocol (public contract)

### Today's protocol (v1, implicit)

Host side: `assets/js/feldspar_app.js` and `systems/feldspar` in `eyra/mono`. App side: [`packages/feldspar/src/live_bridge.ts`](../../packages/feldspar/src/live_bridge.ts), [`packages/feldspar/src/components/script_host_component.tsx`](../../packages/feldspar/src/components/script_host_component.tsx) and [`packages/feldspar/src/framework/types/commands.ts`](../../packages/feldspar/src/framework/types/commands.ts).

| Direction | Message | Transport |
|---|---|---|
| app → host | `{action: "app-loaded"}`, `{action: "resize", height}` | `window.parent.postMessage(…, "*")` |
| host → app | `{action: "live-init", locale}` plus a transferred `MessagePort` | `iframe.contentWindow.postMessage(…, "*", [port])` |
| app → host | `CommandSystemLog`, `CommandSystemDonate {key, json_string}`, `CommandSystemExit {code, info}`, `CommandSystemEvent {name}` | the `MessagePort` |
| host → app | `DonateSuccess {key, status}`, `DonateError {key, status, error}` | the `MessagePort` |
| host → server | `POST /api/feldspar/donate` (multipart `key`, `context`, `data`), `POST /api/feldspar/log` | HTTP, authenticated, rate-limited |

Packaging: a Feldspar app is a zip with `index.html` at its root, uploaded in the SaaS as the "flow application" of a donate task. The SaaS serves it from its own filesystem or from object storage, so the iframe can be cross-origin.

### Changes (F1)

1. **Write the spec.** Document v1 exactly as above, in Mica's docs (the authoritative copy), and link to it from this repository. It includes:
   - packaging and serving
   - every message and its fields
   - the HTTP endpoints, with status codes, rate limits and authentication
   - the recovery behaviour
   - the security model
2. **Version handshake.**
   - The host adds `protocol_version` to `live-init`.
   - The app answers with its supported version in `app-loaded`, or in a new `app-ready` message after `live-init`.
   - A missing version means v1, so old apps and old hosts keep working together.
3. **Origin checks on both sides.**
   - Today `LiveBridge` accepts the first `live-init` from any sender, and both sides post with target `"*"`.
   - v1.1 checks `event.source === window.parent`, plus an allowed host origin passed in the app's URL or configuration.
   - The host checks the iframe's origin.
   - These checks must stay compatible with apps served from object storage.
4. **Opaque upload context.** The host's donation context (assignment, task, participant, panel) becomes an opaque, host-signed token with a documented public subset. The protocol then isn't tied to one kind of host page, and other Mica tools can embed Feldspar apps.
5. **Compatibility promise.** Within a major version, hosts and apps interoperate. New commands are additive. Unknown commands are ignored and logged, not fatal.

### Contract tests (F2)

- **Shared protocol fixtures** are message sequences for these cases:
  - handshake
  - donate success
  - donate network error
  - exit
  - log
  - version mismatch
- **Where they run.** The JS side runs them against `LiveBridge` and the fake bridge in this repository. Mica's CI runs them against the host hook and the controller.
- **Where they live.** In Mica, as part of the spec. Feldspar pins a copy or fetches them by tag.

---

## 3. Impact on researchers and third parties

- **Existing forks and apps keep working.**
  - Forks follow the new upstream.
  - Already-built zips keep working in Next, because the v1 protocol stays valid.
  - Researchers only need to update remotes and links at their convenience.
- **Pulling upstream changes.** Researchers who merge upstream after F1 get the version handshake and origin checks. These are backward compatible with older hosts.
- **New: other Mica-based SaaS products.** A Feldspar app can run in any Mica-based SaaS, not only in Next. Third parties can build and test against the public spec and the contract fixtures without Elixir.
- **Governance.** Feldspar becomes a Nova project, with Port as its program. Contributions follow Nova's process, and the Feldspar coordinator reviews PRs as before.
- **Communication.** Before the transfer, announce it in the README, in a pinned issue or discussion, and through the Port program channels. Include the new URL, the remote update command, and what doesn't change.

---

## 4. Order, verification, rollback

### Order relative to the Mica steps

```
F1 (spec + handshake) ── F2 (contract tests)
F3a (pre-transfer assessment) ── F3b (cleanup: docs, Pages workflow, bots) ── F3c (transfer) ── F3d (link updates)
```

- **F1** can start now. It needs a coordinated change on the host side in `eyra/mono`, shipped in a Next milestone. The host must accept apps without a version first, then apps can start sending one.
- **F2** follows F1 and runs in both CIs. After the Mica repository exists (main plan, step 10), the host-side fixtures move with Mica.
- **F3** does not depend on the Mica split. It can happen before or after it, but **not in the same window as the production cutover of Next to `eyra/next`** (main plan, step 11), so that any regression has one cause.
- After **F3c**, update the pinned release URL in the `eyra/mono` e2e fixture and the links in Next's docs.

### Verification

- **F1:**
  - Data-donation e2e on Next's staging passes with a new app and with an old release zip (pre-handshake).
  - Unit tests in this repository cover the handshake and the origin checks.
- **F2:** Both CIs run the shared fixtures green.
- **F3:**
  - `git clone` via the old URL works (redirect).
  - `release.yml` builds and publishes a release in the new org.
  - Renovate/Dependabot open PRs in the new org.
  - Next's staging donates with a release downloaded from the new URL.
  - The README and links point to the new location.

### Rollback

- **F1/F2:** revert. The version field is optional, so hosts and apps remain compatible.
- **F3:**
  - A GitHub repository can be transferred back to `eyra`. Redirects follow the move again.
  - Releases, issues and forks move with it.
  - Leaked secrets cannot be rolled back; that is why the history scan comes first.

---

## 5. Decisions and authorizations needed

1. **The user authorizes the transfer** of `eyra/feldspar` to `novasoftwarefoundation/feldspar`, after reviewing the pre-transfer assessment.
2. **Org access:** who gets admin, maintain and write in `novasoftwarefoundation/feldspar`, and which GitHub Apps are installed for the Nova org.
3. **Protocol ownership:** the spec lives in Mica and Feldspar implements it. The Feldspar coordinator agrees.
4. **npm scope:** keep `@eyra/feldspar`, or rename to `@novasoftwarefoundation/feldspar` when (if ever) the library is published.
5. **Branch and release policy** after the move: which branches produce releases, and should non-`develop` releases stay pre-releases? Today every branch release is marked pre-release, because the check is `branch != 'main'` while the branches are `develop`/`master`.
6. **Copyright and licence** questions shared with Mica (AGPL-3.0): see the main plan.

<sub>Written by an AI agent (Claude Code · Claude Opus 5.5, herdr-projects nova-migration · t-0001).</sub>
