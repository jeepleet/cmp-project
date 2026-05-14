# Production Environment

Last updated: 2026-05-11

## Purpose

This guide defines the minimum environment setup before Own CMP is used on a real website.

Own CMP should be deployed behind HTTPS. The Node server can run behind a reverse proxy, but the public browser-facing URL must be HTTPS so admin sessions, config delivery, and the runtime script are not exposed over plain HTTP.

## Runtime Requirements

- Node.js 25 or newer for the current native SQLite implementation
- Writable `data/` directory
- Persistent disk for `data/owncmp.sqlite`
- HTTPS at the public edge
- Reverse proxy should forward `X-Forwarded-Proto: https`

For a real go-live plan, see `docs/phase-7-go-live.md`.

## Required Environment Variables

Set a real admin email:

```powershell
$env:CMP_ADMIN_EMAIL="admin@example.com"
```

Generate and set a password hash:

```powershell
$env:CMP_ADMIN_PASSWORD_TO_HASH="a-long-random-password"
$env:CMP_ADMIN_PASSWORD_HASH=(node src/server/hash-password.js)
Remove-Item Env:\CMP_ADMIN_PASSWORD_TO_HASH
```

Start the server:

```powershell
node src/server/index.js
```

Do not use `CMP_ADMIN_PASSWORD` for real deployment. It is a local fallback only.

## Recommended Environment Variables

Port:

```powershell
$env:PORT="8787"
```

Force secure cookies if the reverse proxy does not send HTTPS headers:

```powershell
$env:CMP_FORCE_SECURE_COOKIES="true"
```

Tune login rate limiting if needed:

```powershell
$env:CMP_LOGIN_MAX_ATTEMPTS="5"
$env:CMP_LOGIN_WINDOW_MS="900000"
$env:CMP_LOGIN_LOCK_MS="900000"
```

Set consent record retention if the default does not match your policy:

```powershell
$env:CMP_CONSENT_RETENTION_DAYS="390"
```

Set `CMP_CONSENT_RETENTION_DAYS="0"` only for local debugging or when retention is handled outside Own CMP. Production deployments should have an explicit retention period.

## Storage

Default storage is SQLite:

```text
data/owncmp.sqlite
```

The `data/` directory must survive restarts and deployments. Do not deploy Own CMP to a filesystem that is wiped on each release unless `data/` is mounted as persistent storage.

Backups are stored under:

```text
data/backups/
```

Create a backup from Admin before deploys, config migrations, or code upgrades.

## Reverse Proxy Requirements

The proxy should:

- terminate HTTPS
- forward traffic to the Node server
- preserve the host header
- send `X-Forwarded-Proto: https`
- allow `GET`, `POST`, `PUT`, and `OPTIONS`
- serve `/.well-known/gpc.json`
- serve `/cmp/owncmp.js`
- allow public access to `/api/public/config/:siteId/production`
- allow public access to `/api/public/config/:siteId/production/:version`
- protect `/admin/` at the application login layer

## Public URLs

For a production site that should always use the latest published production config, use the active production URL:

```html
<script
  src="https://cmp.example.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.example.com/api/public/config/demo-site/production"
  defer>
</script>
```

For a controlled launch, use a pinned production version URL from the Admin Snippets panel:

```html
<script
  src="https://cmp.example.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.example.com/api/public/config/demo-site/production/20260508T165641Z"
  defer>
</script>
```

When using the GTM bridge with the active production URL:

```html
<script
  src="https://cmp.example.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.example.com/api/public/config/demo-site/production"
  data-google-consent="false">
</script>
```

Pinned direct-script GTM bridge installs use the same versioned config URL and keep `data-google-consent="false"`.

## Runtime Cache and Versioning

Own CMP has two public config URL modes:

- Active production: `/api/public/config/:siteId/production`
- Pinned production: `/api/public/config/:siteId/production/:version`

Active production responses use short public caching with `ETag`, `Last-Modified`, and `X-OwnCMP-Config-Version`. This keeps normal updates quick after publish while still allowing browser and proxy revalidation.

Pinned production responses are immutable and can be cached for one year because a publish version never changes. Use pinned URLs when a release needs an explicit change-control step.

The runtime script at `/cmp/owncmp.js` is the stable GTM install URL and uses validators with:

```text
Cache-Control: public, no-cache, must-revalidate
```

Keep this URL stable for GTM installs. The GTM template passes install settings through `window.OwnCMPBootstrap`, not query parameters, so normal runtime fixes should deploy through revalidation instead of customer-side URL edits.

## Consent Record Retention

Own CMP keeps proof-of-consent records for 390 days by default. The retention window is controlled by:

```text
CMP_CONSENT_RETENTION_DAYS
```

Expired records are purged at most once per day when new consent records are written. Admins can also view the policy, cutoff date, and expired record count in the Admin Storage panel, then run a manual purge if needed.

Retention endpoints:

```text
GET  /api/consent-retention
POST /api/consent-retention/purge
```

Both endpoints require an authenticated admin session. The purge endpoint also requires a valid CSRF token.

## Consent Record Export

Admins can export raw consent records from the Reporting panel or through:

```text
GET /api/exports/consent/:siteId?days=30&format=json
GET /api/exports/consent/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
```

Exports are authenticated, generated on demand, and sent with `Cache-Control: no-store`.

## Storage Status

Admins can inspect storage health from the Admin Storage panel or through:

```text
GET /api/storage/status
```

The status view shows data-store health, database size, consent record count, backup count, and expandable technical details such as Node version, data paths, SQLite WAL size, and key record counts.

## Prelaunch Checklist

- `CMP_ADMIN_EMAIL` is set.
- `CMP_ADMIN_PASSWORD_HASH` is set.
- Default login no longer works.
- Admin session cookie is `Secure` over the public URL.
- Admin save/publish actions work after login.
- CSRF failures return `403` when token is missing.
- Failed login attempts eventually return `429`.
- `data/owncmp.sqlite` exists on persistent disk.
- Admin Storage status shows the expected storage driver and database size.
- A backup can be created and downloaded from Admin.
- Consent record retention days are set for the deployment.
- Admin Storage shows the retention policy and expired record count.
- Consent record JSON and CSV export work for the selected reporting period.
- Public config endpoint returns the expected production config.
- Pinned public config endpoint returns the expected immutable version.
- Public config responses include `ETag` and `X-OwnCMP-Config-Version`.
- Runtime script loads from the public HTTPS URL.
- `/.well-known/gpc.json` is reachable.
- GTM template import verification is completed before a GTM-based launch.

## Known Caveat

The current SQLite driver uses Node's native `node:sqlite`, which requires Node.js 25+ and currently emits an experimental warning. This is acceptable for the current self-hosted track, but should be reviewed before a larger hosted production rollout.
