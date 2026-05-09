# Own CMP

A lightweight, self-hostable CMP starter focused on Google Consent Mode v2, predictable GTM behavior, manual service setup, and fast runtime loading.

## Start

```powershell
node src/server/index.js
```

Open:

- Admin: `http://localhost:8787/admin/`
- Demo site: `http://localhost:8787/demo.html`
- Public config: `http://localhost:8787/api/public/config/demo-site/production`

Default local login:

- Email: `admin@example.com`
- Password: `change-me-now`

For real use, set:

```powershell
$env:CMP_ADMIN_EMAIL="you@example.com"
$env:CMP_ADMIN_PASSWORD="a-long-random-password"
node src/server/index.js
```

## Current Scope

This first version is dependency-free on purpose:

- Native Node backend with cookie sessions
- Vanilla admin UI
- Vanilla CMP runtime at `public/cmp/owncmp.js`
- Versioned publish endpoint
- Publish history and rollback
- Publish diff in the admin overview
- Import/export JSON
- Region-specific Consent Mode overrides
- Runtime Test Lab
- Public site changelog endpoint
- GPC support resource at `/.well-known/gpc.json`
- GTM Consent Mode bridge source pack and generated `.tpl`
- WordPress and Shopify integration guides
- Performance Lab and real-time INP dashboard
- (In Progress) Phase 5: Multi-site support and durability
- Public config endpoint
- Demo page

The runtime does not delete cookies on first load. Cookie cleanup only runs after an explicit user choice denies a category.

## Project Docs

- Current status: `docs/status.md`
- Changelog: `docs/changelog.md`
- Architecture: `docs/architecture.md`
- Roadmap: `docs/roadmap.md`
- GTM bridge: `gtm/README.md`
- GTM verification: `docs/gtm-verification.md`
- GPC support: `docs/gpc.md`
- User Transparency: `public/disclosure.html`
- WordPress guide: `docs/integration-wordpress.md`
- Shopify guide: `docs/integration-shopify.md`

Documentation rule: every meaningful project change must update the docs in the same work session.

## Runtime Snippet

```html
<script
  src="https://your-cmp-domain.example/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production"
  defer>
</script>
```

## GTM Bridge Snippet

When using the GTM Consent Mode bridge, let GTM manage Google consent updates:

```html
<script
  src="https://your-cmp-domain.example/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production"
  data-google-consent="false">
</script>
```

Template source and the generated importable template are in `gtm/`.

## Consent Event

The runtime pushes one canonical event shape when an existing or explicit user decision is available:

```js
dataLayer.push({
  event: "owncmp.consent_ready",
  owncmp: {
    siteId: "demo-site",
    hasDecision: true,
    source: "user",
    categories: {
      necessary: true,
      analytics: true,
      marketing: false,
      personalization: false
    },
    googleConsent: {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
      functionality_storage: "granted",
      personalization_storage: "denied",
      security_storage: "granted"
    }
  }
});
```

## Notes

This is not legal advice and it is not yet a TCF-certified CMP. If you need Google publisher ads in the EEA, UK, or Switzerland through AdSense, Ad Manager, or AdMob, TCF certification is a separate later track.
rtification is a separate later track.
