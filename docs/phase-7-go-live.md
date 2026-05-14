# Phase 7: Railway + Cloudflare Go-Live Guide

Last updated: 2026-05-12

## Goal

Phase 7 turns Own CMP from a local project into a production service served from a fast public URL such as:

```text
https://cmp.cleancmp.com
```

Railway will run the Node app and persist the SQLite-backed `data/` directory. Cloudflare will provide DNS, edge caching, TLS at the public edge, and performance/security controls.

Target architecture:

```text
Visitor browser
  -> https://cmp.cleancmp.com/cmp/owncmp.js
  -> Cloudflare DNS + CDN
  -> Railway public edge
  -> Railway Node service
  -> Railway volume mounted at /app/data
```

## Why This Setup

Railway is a good first production host for Own CMP because it removes most server operations: deployments, environment variables, domains, TLS, logs, metrics, and rollbacks are managed from the platform.

Cloudflare is still useful in front because the CMP runtime must be fast. Cloudflare can cache the public runtime script and public config responses close to visitors, while leaving consent writes and admin endpoints uncached.

The important architectural constraint is SQLite. Own CMP currently writes to local files under `data/`, including:

- `data/owncmp.sqlite`
- `data/owncmp.sqlite-wal`
- `data/owncmp.sqlite-shm`
- `data/backups/`
- `data/published/`
- `data/sites/`

On Railway, that means the service must have a volume mounted at:

```text
/app/data
```

Railway places app files under `/app`, so this mount path preserves the existing relative `data/` path without code changes.

## Current Caveat: Node Runtime

The current project uses Node's native `node:sqlite`, and `package.json` currently declares:

```json
"engines": {
  "node": ">=25"
}
```

Node 25 is not an LTS line and reaches end-of-life soon. Before serious production traffic, choose one:

- Short-term launch path: deploy a pinned Node 25 runtime and accept that this is temporary.
- Better path: verify or adjust the storage layer so the app runs on Node 24 LTS.

Do not treat Node 25 as the long-term production runtime.

## Phase 7 Checklist

- [x] Create Railway project and service from `jeepleet/own-cmp`.
- [x] Set production environment variables, including `CMP_ADMIN_EMAIL` and `CMP_ADMIN_PASSWORD_HASH`.
- [x] Attach a Railway volume mounted at `/app/data`.
- [x] Deploy the app on Railway.
- [x] Generate/open the Railway public domain and verify `/admin/` loads.
- [x] Verify `/cmp/owncmp.js` on the Railway domain.
- [x] Deploy and verify `/.well-known/gpc.json` on the Railway domain.
- [x] Publish config and verify public config endpoint on the Railway domain.
- [x] Buy production domain `cleancmp.com` in Cloudflare.
- [x] Add `cmp.cleancmp.com` as a Railway custom domain on port `8080`.
- [x] Create DNS-only Cloudflare CNAME record for `cmp.cleancmp.com`.
- [x] Verify HTTPS on `https://cmp.cleancmp.com`.
- [x] Enable Cloudflare proxy after Railway verifies the domain.
- [x] Verify Admin, runtime script, GPC declaration, and public production config through the proxied Cloudflare hostname.
- [x] Add Cloudflare bypass rule for Admin, consent writes, disclosure history, reports, exports, backups, storage, and authenticated APIs.
- [x] Add Cloudflare cache rule for `/cmp/owncmp.js`.
- [x] Add Cloudflare 60-second cache rule for active production config.
- [x] Add Cloudflare one-year cache rule for public config paths as the pinned-config fallback.
- [x] Add Cloudflare one-day cache rule for `/.well-known/gpc.json`.
- [x] Verify active production config, pinned production config, and GPC declaration return JSON through Cloudflare.
- [x] Confirm admin, consent records, and disclosure history are covered by the cache bypass rule.
- Publish production config from Admin.
- Install snippet on the real website.
- Verify Google Consent Mode / GTM behavior.
- [x] Verify GTM Runtime Loader + Consent Mode Bridge on live test domain `jeppeskaffe.dk`.
- Configure backups, monitoring, and rollback procedures.

## Step 1: Prepare The Repository

Make sure the project has:

```text
package.json
src/server/index.js
public/cmp/owncmp.js
data/
```

Current status: completed. The project is in GitHub at `jeepleet/own-cmp`.

Railway should start the service with:

```text
npm start
```

The existing script is:

```json
"start": "node src/server/index.js"
```

Before deploying, make sure no local-only secrets are committed. The production admin password must be provided through Railway variables, not source files.

## Step 2: Create The Railway Project

In Railway:

1. Create a new project.
2. Add a new service from the GitHub repository.
3. Select the repository containing Own CMP.
4. Use the default service type for a long-running web service.
5. Confirm Railway detects the Node app.
6. Set the service start command to `npm start` if Railway does not infer it.

If Railway's build logs show a Node version lower than the project requires, resolve the runtime before continuing. For a short-term Node 25 launch, use a pinned runtime strategy. For the long-term production track, move the app to Node 24 LTS compatibility.

Current status: completed. Railway detected Node and deployed with Node `25.9.0` from `package.json > engines > node (>=25)`.

## Step 3: Add Persistent Storage

Create a Railway volume and attach it to the Own CMP service.

Set the volume mount path to:

```text
/app/data
```

This is mandatory. If the volume is mounted somewhere else, SQLite data, site configs, published configs, backups, and consent records may be lost on redeploy.

After deployment, verify the Admin Storage panel shows SQLite and a database path under `data/`.

Current status: completed at platform level. Railway mounted a volume for the service. Next manual check is Admin Storage after login.

## Step 4: Set Railway Variables

Set these variables on the Railway service.

Required:

```text
PORT=8787
CMP_ADMIN_EMAIL=admin@example.com
CMP_ADMIN_PASSWORD_HASH=<generated hash>
CMP_FORCE_SECURE_COOKIES=true
CMP_CONSENT_RETENTION_DAYS=390
```

Recommended:

```text
CMP_LOGIN_MAX_ATTEMPTS=5
CMP_LOGIN_WINDOW_MS=900000
CMP_LOGIN_LOCK_MS=900000
```

Do not set `CMP_ADMIN_PASSWORD` in production. Use `CMP_ADMIN_PASSWORD_HASH`.

Generate the password hash locally:

```powershell
$env:CMP_ADMIN_PASSWORD_TO_HASH="a-long-random-production-password"
$hash=(node src/server/hash-password.js)
Remove-Item Env:\CMP_ADMIN_PASSWORD_TO_HASH
$hash
```

Copy the printed hash into Railway as `CMP_ADMIN_PASSWORD_HASH`.

Current status: completed. Railway logs no longer show the default-login warning.

## Step 5: First Railway Deploy Verification

Deploy the service and open the Railway-generated domain first.

Current status: Cloudflare proxy and cache rules configured. Railway deployment is successful, `/admin/` loads, `/cmp/owncmp.js` returns JavaScript, `/.well-known/gpc.json` returns JSON, and `/api/public/config/demo-site/production` plus a pinned production config URL both return JSON through `https://cmp.cleancmp.com`. Cloudflare now bypasses private/write endpoints, caches the runtime script for 1 day, caches active production config for 60 seconds, caches public config paths for 1 year as the pinned-config fallback, and caches the GPC declaration for 1 day.

Verify:

```text
https://<railway-domain>/admin/
https://<railway-domain>/cmp/owncmp.js
https://<railway-domain>/.well-known/gpc.json
https://<railway-domain>/api/public/config/demo-site/production
```

Expected:

- `/admin/` loads the login screen.
- Default credentials no longer work.
- Production credentials work.
- `/cmp/owncmp.js` returns JavaScript.
- `/.well-known/gpc.json` returns JSON.
- Public config returns `200` if a production config is published, or `404` if no production config exists yet.

PowerShell checks:

```powershell
Invoke-WebRequest "https://<railway-domain>/cmp/owncmp.js" -UseBasicParsing
Invoke-WebRequest "https://<railway-domain>/.well-known/gpc.json" -UseBasicParsing
Invoke-WebRequest "https://<railway-domain>/api/public/config/demo-site/production" -UseBasicParsing
```

## Step 6: Configure The Custom Domain In Railway

Use a dedicated subdomain:

```text
cmp.example.com
```

In Railway:

1. Open the Own CMP service.
2. Go to networking or public domain settings.
3. Add custom domain `cmp.example.com`.
4. Railway will provide a CNAME target.
5. Keep that page open while configuring Cloudflare.

## Step 7: Configure Cloudflare DNS

In Cloudflare DNS, add:

```text
Type: CNAME
Name: cmp
Target: <railway-provided-cname>
Proxy status: DNS only at first
```

Start with DNS-only until Railway verifies the domain and issues its certificate.

After Railway shows the domain as verified and HTTPS works directly, switch Cloudflare proxy status to:

```text
Proxied
```

Then set Cloudflare SSL/TLS mode:

```text
Full (strict)
```

Verify:

```text
https://cmp.example.com/admin/
https://cmp.example.com/cmp/owncmp.js
```

## Step 8: Cloudflare Performance Settings

For the `cmp.example.com` hostname:

Enable:

- Brotli
- HTTP/2
- HTTP/3
- TLS 1.3
- Always Use HTTPS

Avoid for the CMP hostname:

- Rocket Loader
- JavaScript deferral tools
- HTML rewriting
- aggressive minification rules that alter `/cmp/owncmp.js`

Reason: the CMP runtime must execute predictably and early. Do not let an optimization layer defer or rewrite it.

## Step 9: Cloudflare Cache Rules

Create Cloudflare Cache Rules in this order.

### Rule 1: Bypass Private And Write Endpoints

Expression:

```text
(http.host eq "cmp.example.com" and (
  starts_with(http.request.uri.path, "/admin") or
  starts_with(http.request.uri.path, "/api/session") or
  starts_with(http.request.uri.path, "/api/login") or
  starts_with(http.request.uri.path, "/api/config") or
  starts_with(http.request.uri.path, "/api/sites") or
  starts_with(http.request.uri.path, "/api/versions") or
  starts_with(http.request.uri.path, "/api/backups") or
  starts_with(http.request.uri.path, "/api/storage") or
  starts_with(http.request.uri.path, "/api/reports") or
  starts_with(http.request.uri.path, "/api/exports") or
  starts_with(http.request.uri.path, "/api/consent-retention") or
  starts_with(http.request.uri.path, "/api/public/record") or
  starts_with(http.request.uri.path, "/api/public/disclosure")
))
```

Action:

```text
Bypass cache
```

### Rule 2: Cache Runtime Script

Expression:

```text
(http.host eq "cmp.example.com" and http.request.uri.path eq "/cmp/owncmp.js")
```

Action:

```text
Eligible for cache with origin revalidation
Edge TTL: Respect origin, or the shortest available TTL with revalidation
Browser TTL: Respect origin
```

The current stable runtime URL should revalidate because GTM installs must not need cache-busting query strings or manual purges after normal runtime fixes. The origin header is:

```text
Cache-Control: public, no-cache, must-revalidate
```

After a separate versioned runtime asset path exists, cache the versioned assets long-term and keep the install-facing loader/current-runtime URL revalidated.


### Rule 3: Cache Active Production Config Briefly

Expression:

```text
(http.host eq "cmp.example.com" and
 starts_with(http.request.uri.path, "/api/public/config/") and
 ends_with(http.request.uri.path, "/production"))
```

Action:

```text
Eligible for cache
Edge TTL: 60 seconds
Browser TTL: Respect origin
```

Reason: active config should be fast, but publishes should propagate quickly.

### Rule 4: Cache Pinned Production Config Long

Expression:

```text
(http.host eq "cmp.example.com" and
 starts_with(http.request.uri.path, "/api/public/config/"))
```

Action:

```text
Eligible for cache
Edge TTL: 1 year
Browser TTL: Respect origin or 1 year
```

Reason: pinned version URLs are immutable.

This project used the broader `starts_with` fallback because regex matching was not available in the current Cloudflare Cache Rules plan. Keep the active production config 60-second rule above this rule so `/api/public/config/:siteId/production` is handled before the broader one-year public config rule.

### Rule 5: Cache GPC Declaration

Expression:

```text
(http.host eq "cmp.example.com" and http.request.uri.path eq "/.well-known/gpc.json")
```

Action:

```text
Eligible for cache
Edge TTL: 1 day
Browser TTL: Respect origin
```

## Step 10: Cloudflare Security Rules

Add a WAF or Security Rule for admin paths if needed.

Recommended for early production:

- Challenge suspicious traffic to `/admin/*`.
- Consider limiting `/admin/*` to expected countries or known IPs if practical.
- Never block `/cmp/owncmp.js`.
- Never block `/api/public/config/*`.
- Never block `/api/public/record`, or consent writes will fail.

## Step 11: Publish Production Config

In Own CMP Admin:

1. Open `https://cmp.example.com/admin/`.
2. Log in with production credentials.
3. Select the production site.
4. Configure banner text, language, privacy URL, categories, services, and Consent Mode.
5. Save draft.
6. Publish config.
7. Copy the active production snippet or pinned production snippet.

For normal rollout:

```html
<script
  src="https://cmp.example.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.example.com/api/public/config/demo-site/production"
  defer>
</script>
```

For direct script plus GTM bridge mode:

```html
<script
  src="https://cmp.example.com/cmp/owncmp.js"
  data-site-id="demo-site"
  data-config-url="https://cmp.example.com/api/public/config/demo-site/production"
  data-google-consent="false">
</script>
```

For GTM-only deployment, import `gtm/template.tpl` and configure:

```text
Load Own CMP runtime: true
Runtime script URL: https://cmp.cleancmp.com/cmp/owncmp.js
Site ID: demo-site
Production config URL: https://cmp.cleancmp.com/api/public/config/demo-site/production
dataLayer name: dataLayer
Trigger: Consent Initialization - All Pages
```

Use pinned config URLs when a launch needs strict change control.

Do not use temporary query strings such as `?v=...` on the Runtime script URL. The GTM template injects the stable URL only and passes `siteId`, config URL, dataLayer name, and Consent Mode flags through `window.OwnCMPBootstrap`.

## Step 12: Install On The Real Website

Install the runtime snippet before marketing/analytics tags rely on consent.

For GTM-based sites:

- Preferred GTM-only path: deploy `gtm/template.tpl` with `Load Own CMP runtime: true`.
- Bridge-only path: hardcode the Own CMP runtime before the GTM container when possible, set `data-google-consent="false"`, and set the GTM template's `Load Own CMP runtime` field to false.
- Verify the GTM template is installed and configured on **Consent Initialization - All Pages**.

For non-GTM sites:

- Let Own CMP manage Google consent directly.
- Keep `data-google-consent` omitted or set to `true`.

## Step 13: Live Verification

Use a clean browser profile or incognito session.

Verify first visit:

- Runtime script loads from `https://cmp.example.com/cmp/owncmp.js`.
- Config loads from `https://cmp.example.com/api/public/config/:siteId/production`.
- Banner appears.
- Persistent cookie preferences icon appears and can reopen the banner.
- Language, privacy link, category labels, buttons, and corner style are correct.
- Accept all closes the banner and writes a decision.
- Reject all closes the banner and writes a decision.
- Preferences opens localized categories and saves a partial decision.
- Disclosure link opens the CMP-hosted localized consent data page with the current consent ID.

Verify network:

- `/cmp/owncmp.js` returns `200`.
- Public config returns `200`.
- `/api/public/record` returns success on decisions.
- The consent cookie is named `CleanCmpConsent`.
- Admin endpoints are not cached.
- Disclosure history endpoints are not cached.

Verify Cloudflare:

- Runtime script should eventually return `cf-cache-status: HIT`.
- Active config may return `HIT` or `REVALIDATED` depending on timing.
- Consent record POST must not be cached.

Verify Consent Mode:

- Open Google Tag Assistant.
- Confirm default consent is denied before choice.
- Confirm update is sent after user choice.
- Confirm tags respect categories.

## Step 14: Backup Plan

Use three backup layers:

1. Own CMP Admin backup before significant changes.
2. Railway volume backup.
3. Off-platform downloaded backup for disaster recovery.

Minimum operating rule:

- Create a backup before deploys.
- Create a backup before config migrations.
- Test restore before the first live launch.
- Store at least one recent backup outside Railway.
- Backup filenames include milliseconds so a restore safety backup cannot overwrite the backup being restored during fast operations.

Current status: production backup and restore were manually verified from Admin.

## Step 15: Monitoring

Monitor these URLs:

```text
https://cmp.cleancmp.com/cmp/owncmp.js
https://cmp.cleancmp.com/.well-known/gpc.json
https://cmp.cleancmp.com/api/public/config/demo-site/production
```

Alert on:

- non-`200` response from runtime script
- non-`200` response from active production config after publish
- Railway service restart loops
- Railway volume near capacity
- elevated `5xx`
- failed backup jobs

Admin login failures are already rate limited in the app, but monitor unusual spikes.

Current status: monitoring is deferred and will be configured later.

## Step 16: Rollback

There are three rollback types.

### Config Rollback

Use Admin publish history / rollback when a banner or consent config is wrong.

This is the safest rollback and should be the normal first choice.

### Runtime Rollback

Use Railway deployment rollback if a code deploy breaks `/cmp/owncmp.js` or the Admin.

After rollback, purge Cloudflare cache for:

```text
https://cmp.example.com/cmp/owncmp.js
```

### Data Restore

Use only when SQLite data is damaged or accidentally deleted.

Order:

1. Stop writes if possible.
2. Create a safety backup of the current state.
3. Restore from the known-good backup.
4. Verify Admin, public config, and records.

## Step 17: Performance Targets

Runtime goals:

- `/cmp/owncmp.js` should be served from Cloudflare cache for most visitors.
- Public active config should be edge cached briefly.
- Pinned configs should be edge cached long-term.
- Consent record writes can be slower because they happen after interaction, but should still be reliable.

Do not cache user-specific or write endpoints to improve speed. Correctness matters more for records and Admin.

## Step 18: Known Limitations

- SQLite means one primary app instance. Do not run multiple Railway replicas against one local SQLite volume.
- Node 25 is temporary. Plan Node 24 LTS compatibility or a storage change.
- Railway volume data must stay under `/app/data`.
- Cloudflare must not defer or rewrite the CMP runtime script.
- Public config cache TTL is a tradeoff: shorter TTL means faster publish propagation; longer TTL means fewer origin hits.

## Phase 7 Done Criteria

Phase 7 is complete when:

- Railway deploy is stable.
- `/app/data` is persistent across deploys.
- Cloudflare serves `cmp.example.com`.
- Runtime script is cached at Cloudflare.
- Active config is cached briefly.
- Pinned config is cached long-term.
- Admin, disclosure history, and consent writes are uncached.
- Backups are tested.
- Rollback is documented and tested.
- Real website snippet is installed.
- GTM / Consent Mode behavior is verified on the live website.
