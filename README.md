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

For production-style use, generate and set a password hash instead of a plaintext password:

```powershell
$env:CMP_ADMIN_EMAIL="you@example.com"
$env:CMP_ADMIN_PASSWORD_TO_HASH="a-long-random-password"
$env:CMP_ADMIN_PASSWORD_HASH=(node src/server/hash-password.js)
Remove-Item Env:\CMP_ADMIN_PASSWORD_TO_HASH
node src/server/index.js
```

`CMP_ADMIN_PASSWORD` is still accepted as a local fallback, but `CMP_ADMIN_PASSWORD_HASH` is the Phase 6 production path.

Admin session cookies are HTTPS-aware. Local `http://localhost` keeps the cookie usable without `Secure`; HTTPS requests, common reverse-proxy headers like `X-Forwarded-Proto: https`, or `$env:CMP_FORCE_SECURE_COOKIES="true"` add the `Secure` attribute automatically.

Admin write requests also require a per-session CSRF token. The Admin UI handles this automatically after login; direct API scripts must send the `X-CSRF-Token` value returned by `/api/login` or `/api/session`.

Failed admin logins are rate limited in memory. Defaults are 5 failed attempts per email/IP pair within 15 minutes, followed by a 15 minute lockout. These can be adjusted with `CMP_LOGIN_MAX_ATTEMPTS`, `CMP_LOGIN_WINDOW_MS`, and `CMP_LOGIN_LOCK_MS`.

SQLite backups can be created, downloaded, and restored from the Admin Storage panel. Backups are stored in `data/backups`, and restore creates a safety backup first.

Consent records are retained for 390 days by default. Override this with `CMP_CONSENT_RETENTION_DAYS`, or set it to `0` only when retention purging is handled outside Own CMP.

## Storage

Own CMP now uses SQLite by default:

```text
data/owncmp.sqlite
```

On first startup, existing local JSON data is imported into SQLite once. The old JSON files remain as migration/source backups, but normal reads and writes use SQLite.

Requirements:

- Node.js 25 or newer for native `node:sqlite`
- Optional local fallback: set `$env:CMP_STORAGE="json"` before starting the server

## Current Scope

This first version is dependency-free on purpose:

- Native Node backend with cookie sessions
- SQLite storage by default with one-time JSON migration
- SQLite backup and restore controls
- Vanilla admin UI
- Vanilla CMP runtime at `public/cmp/owncmp.js`
- Versioned publish endpoint
- Publish history and rollback
- Publish diff in the admin overview
- Multi-site admin selection and site creation
- Site-scoped draft configs
- Consent Reporting Dashboard with accept, reject, partial, ignore, and custom date-range metrics
- Banner editor with language presets for banner, categories, and disclosure text, privacy policy URL, corner style, center/default or bottom placement, logo upload, and custom CSS
- Import/export JSON
- Region-specific Consent Mode overrides
- Optional Shopify Customer Privacy API sync
- Runtime Test Lab
- Public site changelog endpoint
- Site-scoped reporting endpoint
- Consent record retention policy and manual purge control
- Consent record export by site/date range as JSON or CSV
- Admin storage/status screen
- GPC support resource at `/.well-known/gpc.json`
- GTM Consent Mode bridge source pack and generated `.tpl`
- WordPress and Shopify integration guides
- Performance Lab and real-time INP dashboard
- (Next) Phase 6: production deployment readiness
- Public config endpoint
- Demo page

The runtime does not delete cookies on first load. Cookie cleanup only runs after an explicit user choice denies a category.

## Project Docs

- Current status: `docs/status.md`
- Changelog: `docs/changelog.md`
- Architecture: `docs/architecture.md`
- Durable storage: `docs/durable-storage.md`
- Production environment: `docs/production-environment.md`
- Phase 7 go-live: `docs/phase-7-go-live.md`
- Roadmap: `docs/roadmap.md`
- GTM bridge: `gtm/README.md`
- GTM verification: `docs/gtm-verification.md`
- GPC support: `docs/gpc.md`
- User Transparency: `public/disclosure.html`
- WordPress guide: `docs/integration-wordpress.md`
- Shopify guide: `docs/integration-shopify.md`

Documentation rule: every meaningful project change must update the docs in the same work session.

## Runtime Snippet

Use the active production URL when the site should automatically receive the latest published config:

```html
<script
  src="https://your-cmp-domain.example/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production"
  defer>
</script>
```

Use a pinned production URL when a launch should stay on one immutable config version until the snippet is updated:

```html
<script
  src="https://your-cmp-domain.example/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://your-cmp-domain.example/api/public/config/demo-site/production/20260508T165641Z"
  defer>
</script>
```

Active config responses are short-cacheable and revalidated with `ETag` / `Last-Modified`. Pinned config responses are immutable and cacheable for one year.

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
