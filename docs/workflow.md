# Own CMP Working Workflow

This is the required workflow for code, documentation, testing, and release work.

## 1. Draft

Restate the bug or feature in concrete terms. Define the intended behavior before editing code.

## 2. Map

Locate the affected runtime, admin, server, GTM, data, test, and documentation files. Identify existing behavior and where the bug is introduced.

## 3. Plan

Choose the smallest safe fix that preserves working behavior. Call out risky paths such as published configs, legacy values, cache behavior, GTM behavior, stored consent, and production deploy steps.

## 4. Develop

Make the scoped code changes locally. Do not mix unrelated refactors into the fix.

## 5. Design

For UI-facing changes, verify placement, copy, visual state, layout, accessibility, and browser behavior. The first visible result should match the Admin settings.

## 6. Analyze

Check edge cases and legacy states. For CMP work this usually includes old config values, stored cookies, missing fields, banner impressions, explicit decisions, GTM-injected runtime URLs, and cross-domain disclosure links.

## 7. Build

Run required build or generation steps when relevant. For GTM template changes, run the GTM build and review the generated output.

## 8. Review

Inspect the diff. Remove timestamp-only or generated noise unless it is intentionally part of the release. Confirm no unrelated user changes were reverted.

## 9. Test

Run automated tests and provide manual local test steps every time. The response must include the exact PowerShell commands, browser URLs, Admin settings, expected UI result, and expected dataLayer result when relevant.

## 10. Overview

Summarize what changed, which files changed, what was verified, and what remains local.

## 11. Production

Production starts only after local verification. Commit and push to GitHub, then confirm Railway deploys the pushed commit. Until that happens, the changes are local only.

## 12. Release

Verify live behavior on the production domain after Railway finishes deploying. Document the release and provide live test steps.

## Live GTM + Cloudflare Testing

When a runtime, Admin config, dataLayer, disclosure, or GTM integration bug is fixed, live testing must account for Cloudflare edge cache, browser cache, and GTM Preview state.

Use this order:

1. Confirm Railway deployed the pushed GitHub commit.
2. Confirm Cloudflare is not forcing a stale one-day cache for the stable runtime URL. The origin should send `Cache-Control: public, no-cache, must-revalidate` for:

```text
https://cmp.cleancmp.com/cmp/owncmp.js
```

3. If GTM Preview reports an `inject_script` permission failure, verify the custom template's **Injects scripts** permission includes only the stable runtime URL above. The GTM tag must not use `?v=...` or any other query string on the Runtime script URL.
4. Confirm the GTM tag still fires on **Consent Initialization - All Pages**.
5. Use GTM Preview on the real website.
6. Clear the website's CMP cookies or use a fresh incognito window.
7. Confirm the runtime script request is loaded from `cmp.cleancmp.com` and the request URL is exactly `https://cmp.cleancmp.com/cmp/owncmp.js`.
8. Confirm `window.OwnCMPBootstrap` contains the expected site ID, active config URL, dataLayer name, and GTM Consent Mode flags.
9. Confirm the public production config request returns the expected Admin settings.
   - The GTM tag's Production config URL should point to the active endpoint, not a pinned version:

```text
https://cmp.cleancmp.com/api/public/config/demo-site/production
```

   - If `window.OwnCMP.getConfig().version` is older than the latest publish, fix the GTM tag's Production config URL before testing anything else.
10. Test Accept, Reject, and Save Choices.
11. Confirm the configured consent-ready event appears in `window.dataLayer`.
12. Confirm Consent Mode updates happen before consent-dependent tags fire.
13. Confirm disclosure/history links open without errors.
14. Do not accept the test if the runtime URL contains a temporary cache-busting query string.

For the current canonical consent-ready event, expect:

```js
event: "cmp_consent_ready"
```

Do not accept a live test as complete if the page still pushes:

```js
event: "owncmp_consent_ready"
```

or:

```js
event: "owncmp.consent_ready"
```

## Required Documentation

Every code change must update Markdown documentation when behavior, workflow, testing, deployment, GTM behavior, Admin behavior, or user-facing runtime behavior changes.

At minimum, update one or more of:

- `README.md`
- `docs/changelog.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/gtm-verification.md`
- `docs/workflow.md`

## Required Test Guidance

Every final response for code changes must include a **How To Test** section. It must explain whether the change is local or live.

Use this release-state language:

- **Local only:** Files changed in `C:\GTM Custom Templates\Own CMP Project`; not pushed to GitHub; not deployed by Railway.
- **Production pending:** Commit exists locally or on GitHub, but Railway/live verification is not complete.
- **Live:** Railway deployed the commit and production behavior was verified.
