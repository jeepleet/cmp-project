# Own CMP GTM Consent Mode Bridge

This folder contains the first GTM custom template source pack for Own CMP.

The template is a **bridge**, not the main CMP runtime. The recommended setup is:

1. Load `public/cmp/owncmp.js` directly on the page.
2. Import `gtm/template.tpl` into your GTM container.
3. Fire the template on `Consent Initialization - All Pages`.
4. Set the Own CMP script attribute `data-google-consent="false"` so Google consent updates are handled by GTM's consent APIs.

## Installation

### Import .tpl (Recommended)

1. Open Google Tag Manager.
2. Go to **Templates**.
3. Under **Tag Templates**, click **New**.
4. In the top right menu (three dots), select **Import**.
5. Select the `gtm/template.tpl` file from this repository.
6. Click **Save**.
7. Create a new tag using this template and fire it on **Consent Initialization - All Pages**.

### Build from source

If you modify the source files, rebuild the `.tpl` file:

```powershell
npm run build:gtm
```

The build script combines `gtm/own-cmp-consent-mode-template-code.js` and `gtm/template-fields.json` into the final `gtm/template.tpl`.

## Website Runtime Snippet For GTM Setups

```html
<script
  src="https://your-cmp-domain.example/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production"
  data-google-consent="false">
</script>
```

Use the non-deferred form above before the GTM container snippet when possible. The runtime is intentionally small and sets up `window.OwnCMP` immediately; the config fetch and banner rendering happen asynchronously.

For controlled launches, replace the active production config URL with the pinned version URL shown in Admin:

```html
data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production/20260508T165641Z"
```

Pinned config URLs are immutable and can be cached long-term. Active production URLs update automatically after publish and use short revalidated caching.

## Current Limitations

- `gtm/template.tpl` exists, but it still needs manual import verification inside GTM.
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
