# GTM Template Verification

Last updated: 2026-05-14

## Status

Manual verification previously passed on `https://jeppeskaffe.dk` after importing the runtime loader template and using a cache-busted runtime script URL. The current Phase GTM Tag Fix changes the template to inject the stable runtime URL only and pass settings through `window.OwnCMPBootstrap`. This new template still needs live GTM Preview verification without a temporary `?v=...` runtime URL.

The repository contains a generated importable template at:

```text
gtm/template.tpl
```

The template includes source code and test scenarios, but the import and test result must be confirmed inside Google Tag Manager.

## Manual Verification Steps

1. Open Google Tag Manager.
2. Open a test container.
3. Go to **Templates**.
4. Under **Tag Templates**, click **New**.
5. Use the top-right menu and select **Import**.
6. Select `gtm/template.tpl`.
7. Save the template.
8. Open the template tests.
9. Run all tests.
10. Create a tag from the template.
11. Configure the tag:

```text
Load Own CMP runtime: true
Runtime script URL: https://cmp.cleancmp.com/cmp/owncmp.js
Site ID: demo-site
Production config URL: https://cmp.cleancmp.com/api/public/config/demo-site/production
dataLayer name: dataLayer
```

Do not add query parameters to the Runtime script URL. The template writes `window.OwnCMPBootstrap`, strips query strings and hashes from the Runtime script URL field, and injects the exact stable URL above.

12. Fire it on **Consent Initialization - All Pages**.
13. Preview a test website with this GTM container.
14. Confirm the template sets default consent immediately.
15. Confirm the template injects `https://cmp.cleancmp.com/cmp/owncmp.js`.
16. Confirm the banner appears.
17. Accept, reject, and save partial choices.
18. Confirm GTM receives consent updates through `updateConsentState`.
19. Confirm the Own CMP dataLayer event fires.
20. Open the preferences view and click the disclosure/history link.
21. Confirm the disclosure page loads without `Cannot convert undefined or null to object`.

## Live Website Test With Cloudflare

After pushing to GitHub and waiting for Railway to deploy:

1. In GTM Preview, open the live website.
2. If GTM Preview reports an `inject_script` permission error, open the custom template permissions and confirm **Injects scripts** allows the exact stable runtime URL:

```text
https://cmp.cleancmp.com/cmp/owncmp.js
```

The final injected URL must not include `siteId`, `configUrl`, `googleConsent`, `gtmConsentFallback`, or any other query parameter.

3. In browser DevTools, open **Network** and filter for `owncmp.js`.
4. Confirm the request URL is exactly `https://cmp.cleancmp.com/cmp/owncmp.js`.
5. In the Console, confirm `window.OwnCMPBootstrap` contains the expected `siteId`, `configUrl`, `dataLayerName`, `googleConsent: false`, and `gtmConsentFallback: true`.
6. Filter Network for `/api/public/config/` and confirm the production config request succeeds.
   - The active production config URL must be:

```text
https://cmp.cleancmp.com/api/public/config/demo-site/production
```

   - Do not use a pinned version URL for normal live testing, such as:

```text
https://cmp.cleancmp.com/api/public/config/demo-site/production/20260512T115959Z
```

   - If `window.OwnCMP.getConfig().version` is older than the latest Admin publish, the GTM tag is still loading an old config URL or a pinned config version.
7. Clear `CleanCmpConsent` and any legacy `owncmp_consent*` cookies for the website, or use a fresh incognito window.
8. Reload through GTM Preview.
9. Confirm the banner appears.
10. Confirm the persistent preferences icon follows the Admin left/right setting and renders as a colored cookie/check icon.
11. Save or accept consent.
12. In DevTools Console, run:

```js
window.dataLayer.filter((entry) => entry && entry.event)
```

13. Confirm the consent-ready event is:

```js
event: "cmp_consent_ready"
```

14. Confirm no consent-ready event uses:

```js
event: "owncmp_consent_ready"
```

or:

```js
event: "owncmp.consent_ready"
```

15. In GTM Preview, confirm Consent Mode updates are present before consent-dependent tags fire.
16. Open preferences again and click the disclosure/history link.
17. Confirm the disclosure page renders history without `Cannot convert undefined or null to object`.
18. Confirm no temporary `?v=...` value was used in the GTM runtime URL.

## Expected Result

- The `.tpl` imports without errors.
- Template permissions are accepted.
- `inject_script` permission allows only `https://cmp.cleancmp.com/cmp/owncmp.js`.
- `access_globals` allows read/write/execute on `OwnCMPBootstrap` and `OwnCMPGtmBridge`, and execute on `OwnCMPAddConsentListener`, `OwnCMP.onReady`, and `OwnCMP.onChange`.
- Built-in template tests pass.
- A tag using the template can be created and assigned to **Consent Initialization - All Pages**.
- In GTM deployment mode, the template injects the runtime script.
- In bridge-only mode, the hardcoded runtime script works when `Load Own CMP runtime` is false and `data-google-consent="false"` is present on the script.
- For stored and explicit consent decisions, the template receives updates through `OwnCMPAddConsentListener`; older listener APIs and `OwnCMPGtmBridge` remain fallbacks before the configured consent-ready event is pushed. The current default event name is `cmp_consent_ready`. GTM deployment mode passes `gtmConsentFallback=true` through `window.OwnCMPBootstrap` so the runtime can push a direct Consent Mode update before the same event if needed.
- On live website tests, the GTM template should inject the runtime, display the banner, accept/save a choice, write the Own CMP consent cookie, push `cmp_consent_ready`, and open disclosure history without client-side errors.

## Result Log

- 2026-05-08: Pending user verification.
- 2026-05-08: First import attempt failed in GTM. The generated file used invalid export structure (`___PERMISSIONS___`, lowercase field types, missing Terms of Service section, and non-export permission value keys). Generator was corrected and `gtm/template.tpl` was regenerated.
- 2026-05-13: Template regenerated as **Own CMP Runtime Loader + Consent Mode Bridge** with runtime URL, site ID, config URL, runtime load toggle, and `inject_script` permission.
- 2026-05-13: Updated `OwnCMPGtmBridge` global permission from write-only to read/write/execute (`any`) after GTM preview reported a readwrite permission check failure.
- 2026-05-13: Hardened runtime click handling so bridge, listener, record, or cleanup errors cannot freeze the banner UI before it closes.
- 2026-05-13: Removed direct `OwnCMP.onReady` / `OwnCMP.onChange` listener registration from the GTM template. In GTM deployment mode, `OwnCMPGtmBridge` is registered before the runtime is injected, and the runtime calls it directly for stored and explicit decisions.
- 2026-05-13: Verified on `https://jeppeskaffe.dk` with `https://cmp.cleancmp.com/cmp/owncmp.js?v=20260513-gtm-fix-1`. The banner rendered, button actions worked, the consent cookie was written, and `owncmp.consent_ready` appeared in `dataLayer`.
- 2026-05-13: Fixed runtime bridge ordering so `OwnCMPGtmBridge` receives the consent record before `owncmp.consent_ready` is pushed. This resolves GTM Preview showing no on-page update for the consent event.
- 2026-05-13: Reintroduced runtime listener registration through `callInWindow("OwnCMP.onReady", ...)` and `callInWindow("OwnCMP.onChange", ...)` after the injected runtime has loaded. This follows Google's consent template callback pattern and keeps `OwnCMPGtmBridge` as a fallback.
- 2026-05-13: Added `OwnCMPAddConsentListener` as a stable, `this`-independent GTM registration hook and moved runtime listener notifications before the canonical dataLayer event.
- 2026-05-13: Added `gtmConsentFallback=true` for GTM-deployed runtime URLs so the runtime can push a direct Consent Mode update before `owncmp.consent_ready` if the sandbox callback path does not surface as an on-page update in GTM Preview.
- 2026-05-14: Runtime and Admin now normalize `owncmp_consent_ready`, `owncmp.consent_ready`, and `cmp.consent_ready` to the canonical `cmp_consent_ready` event. Local runtime behavior tests verify left-side preferences icon placement and event migration.
- 2026-05-14: Added the live GTM + Cloudflare testing checklist, including cache purge, temporary runtime cache-busting, dataLayer verification, Consent Mode verification, and disclosure history verification.
- 2026-05-14: Added a diagnostic for old live configs: if `window.OwnCMP.getConfig().version` is behind the latest Admin publish, check the GTM tag's Production config URL and remove pinned version URLs.
- 2026-05-14: Rebuilt the GTM template so GTM deployment mode sets `window.OwnCMPBootstrap` and injects the stable runtime URL without query parameters. `inject_script` permission now covers only `https://cmp.cleancmp.com/cmp/owncmp.js`.
