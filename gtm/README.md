# Own CMP GTM Runtime Loader + Consent Mode Bridge

This folder contains the first GTM custom template source pack for Own CMP.

The template can now run in two modes:

- **GTM deployment mode:** the template injects the Own CMP runtime script and handles Google Consent Mode defaults/updates through GTM consent APIs.
- **Bridge-only mode:** the website hardcodes `public/cmp/owncmp.js`, and the template only handles Google Consent Mode updates. Use this when a site owner wants the runtime to load before GTM or cannot inject it from GTM.

For most GTM-only installations, use GTM deployment mode.

In both modes, the template registers its consent update callback with `window.OwnCMPAddConsentListener` when the runtime is available. Older runtime listener APIs (`window.OwnCMP.onReady` and `window.OwnCMP.onChange`) and `window.OwnCMPGtmBridge` remain fallback paths. In GTM deployment mode, the template sets `window.OwnCMPBootstrap` and injects the stable runtime URL without query parameters. The bootstrap includes the direct Consent Mode fallback flag, allowing the runtime to push a direct Consent Mode update before the canonical consent-ready dataLayer event if the sandbox callback path does not surface in Preview.

## Installation

### Import .tpl (Recommended)

1. Open Google Tag Manager.
2. Go to **Templates**.
3. Under **Tag Templates**, click **New**.
4. In the top right menu (three dots), select **Import**.
5. Select the `gtm/template.tpl` file from this repository.
6. Click **Save**.
7. Create a new tag using this template.
8. Fire it on **Consent Initialization - All Pages**.
9. Set:

```text
Load Own CMP runtime: true
Runtime script URL: https://cmp.cleancmp.com/cmp/owncmp.js
Site ID: demo-site
Production config URL: https://cmp.cleancmp.com/api/public/config/demo-site/production
dataLayer name: dataLayer
```

For controlled launches, use the pinned production config URL from Admin instead of the active production config URL.
Do not add cache-busting query parameters to the runtime script URL. The template strips query strings and hashes from that field before injection, passes runtime settings through `window.OwnCMPBootstrap`, and the `inject_script` permission is intentionally limited to the stable runtime URL.

### Build from source

If you modify the source files, rebuild the `.tpl` file:

```powershell
npm run build:gtm
```

The build script combines `gtm/own-cmp-consent-mode-template-code.js` and `gtm/template-fields.json` into the final `gtm/template.tpl`.

## Bridge-Only Website Runtime Snippet

```html
<script
  src="https://cmp.cleancmp.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.cleancmp.com/api/public/config/demo-site/production"
  data-google-consent="false">
</script>
```

Use this only when the runtime is hardcoded on the website and the GTM template is set to:

```text
Load Own CMP runtime: false
```

Place the hardcoded script before the GTM container snippet when possible. The runtime is intentionally small and sets up `window.OwnCMP` immediately; the config fetch and banner rendering happen asynchronously.

For controlled launches, replace the active production config URL with the pinned version URL shown in Admin:

```html
data-config-url="https://cmp.cleancmp.com/api/public/config/demo-site/production/20260508T165641Z"
```

Pinned config URLs are immutable and can be cached long-term. Active production URLs update automatically after publish and use short revalidated caching.

## Current Limitations

- `gtm/template.tpl` exists, but it still needs manual import verification inside GTM after the runtime loader change.
- The generated `.tpl` currently uses an empty `scenarios: []` test block to keep import validation simple. Add editor-native unit tests after import succeeds.
- Region-specific defaults are supported in the runtime config and admin UI; the GTM bridge still uses one optional comma-separated region field for its own defaults.

## Import Format Notes

The generated `.tpl` must use GTM export section names and value shapes exactly:

- `___TERMS_OF_SERVICE___`
- `___INFO___`
- `___TEMPLATE_PARAMETERS___`
- `___SANDBOXED_JS_FOR_WEB_TEMPLATE___`
- `___WEB_PERMISSIONS___`
- `___TESTS___`
- `___NOTES___`

Earlier local builds used `___PERMISSIONS___`, lowercase field types, and non-export permission value keys. Those builds are not valid GTM import files.

## Official References

- Consent template APIs: https://developers.google.com/tag-platform/tag-manager/templates/consent-apis
- Custom template permissions: https://developers.google.com/tag-platform/tag-manager/templates/permissions
- Custom template import/export: https://developers.google.com/tag-platform/tag-manager/templates
