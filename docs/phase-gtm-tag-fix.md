# Phase GTM Tag Fix

## Purpose

The GTM template must behave like a real production integration, not a developer workaround.

After a website owner installs the Own CMP GTM template once, normal runtime fixes, Admin config changes, consent event fixes, disclosure fixes, and visual bug fixes must go live from the Own CMP platform without asking the website owner to edit GTM URLs, re-import the template, purge Cloudflare manually, or use temporary cache-busting query strings.

## Non-Negotiable Requirements

- End users install the GTM template once.
- End users do not edit the Runtime script URL for normal code fixes.
- End users do not add temporary `?v=...` cache-busting values to GTM tags.
- End users do not purge Cloudflare to receive normal runtime fixes.
- End users do not re-import the GTM template unless the template contract itself changes.
- Published Admin config changes must be fetched from the active production config endpoint, not pinned config URLs.
- Runtime code updates must propagate through our hosting/cache strategy.
- GTM Preview must not fail `inject_script` because of dynamically constructed query-string URLs.
- GTM Consent Mode updates must still happen before consent-dependent tags run.
- The dataLayer event must match the active Admin config, currently `cmp_consent_ready`.
- Disclosure/history links must work cross-domain without client-side errors.

## Previous Problem

The previous GTM template built a final injected runtime URL by appending query parameters inside the sandboxed GTM template:

```text
https://cmp.cleancmp.com/cmp/owncmp.js?...&siteId=...&configUrl=...&googleConsent=false&gtmConsentFallback=true
```

This is fragile in GTM because `inject_script` permission checks apply to the final script URL passed to `injectScript`. It also encouraged testing with temporary cache-busted runtime URLs and manual Cloudflare purges.

That is not acceptable for production users.

Current local implementation: the GTM template now writes `window.OwnCMPBootstrap` and injects the stable runtime URL without query parameters. Live GTM Preview verification is still pending.

## Target Architecture

### Stable GTM Injection

The GTM template should inject one stable script URL:

```text
https://cmp.cleancmp.com/cmp/loader.js
```

or, if we keep the current file name:

```text
https://cmp.cleancmp.com/cmp/owncmp.js
```

The injected URL must not require GTM to append dynamic query parameters.

### Configuration Handoff

The GTM template should pass installation settings through a stable handoff that does not alter the injected script URL.

Acceptable options:

- Set a known global object before injection, such as `window.OwnCMPBootstrap`.
- Use a stable registration function exposed by a small loader.
- Use a dedicated bootstrap endpoint whose URL remains static and whose response resolves site/config internally.

The runtime must receive:

- `siteId`
- active production config URL
- dataLayer name
- whether GTM owns Google Consent Mode updates
- whether direct fallback consent updates are enabled

But those values should not make the injected script URL fail GTM permissions.

Current bootstrap shape:

```js
window.OwnCMPBootstrap = {
  siteId: "demo-site",
  configUrl: "https://cmp.cleancmp.com/api/public/config/demo-site/production",
  dataLayerName: "dataLayer",
  googleConsent: false,
  gtmConsentFallback: true
};
```

### Cache Strategy

The install-facing GTM script must be deployment-safe:

- The stable loader should use `Cache-Control: no-cache` or a very short TTL with revalidation.
- Versioned runtime assets can be cached long-term.
- The loader or manifest should point to the current runtime version.
- Deploying a runtime fix should update the loader/manifest automatically.
- Cloudflare rules should be configured once so normal releases do not require manual purge.

Current local server behavior for `/cmp/owncmp.js`:

```text
Cache-Control: public, no-cache, must-revalidate
```

### Active Config Strategy

The GTM template must use the active config endpoint for normal installs:

```text
https://cmp.cleancmp.com/api/public/config/:siteId/production
```

Pinned config URLs are only for intentional rollback, audit, or controlled frozen installs. They must not be used for normal live GTM deployments.

## Implementation Plan

1. [x] Introduce a stable GTM loader design.
2. [x] Stop appending config query parameters to the `injectScript` URL.
3. [x] Add runtime support for reading bootstrap settings from a stable global or registration object.
4. [x] Keep backwards compatibility for existing direct script installs using `data-*` attributes and existing query parameters.
5. [x] Update the GTM template to inject only the stable script URL.
6. [x] Restrict `inject_script` permission to the stable URL.
7. [x] Add server cache headers and Cloudflare documentation for no-manual-purge runtime rollout.
8. [x] Add tests for:
   - URL builder does not append dynamic query params to injected script URL.
   - runtime reads bootstrap settings correctly.
   - active config endpoint is used by default.
   - dataLayer event is `cmp_consent_ready`.
   - disclosure history works after GTM deployment.
9. [ ] Verify in GTM Preview on the live website.
10. [ ] Publish the GTM template only after the live test works without temporary URLs.

## Acceptance Criteria

- A website owner can leave the GTM tag unchanged after installation.
- A new runtime fix deployed through GitHub/Railway becomes available without changing the GTM tag.
- The live website loads the active config version after Admin publish.
- No temporary `?v=...` runtime URL is required.
- No manual Cloudflare purge is required for normal runtime fixes.
- GTM Preview has no `inject_script` permission errors.
- `window.OwnCMP.getConfig().version` matches the latest active production config.
- `window.OwnCMP.getConfig().dataLayer.eventName` returns `cmp_consent_ready`.
- `window.dataLayer` receives `cmp_consent_ready`.
- The preferences icon follows Admin placement and design.
- The disclosure history page opens without `Cannot convert undefined or null to object`.

## Out Of Scope

- Requiring customers to fix our runtime deploy process by editing GTM.
- Requiring customers to purge Cloudflare for normal releases.
- Keeping pinned config URLs as the default GTM install mode.
- Treating GTM Preview workarounds as production architecture.
