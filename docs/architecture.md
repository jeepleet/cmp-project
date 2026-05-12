# Architecture

## Goals

- Keep the website/admin app separate from the CMP runtime.
- Make the runtime small, dependency-free, cacheable, and safe to load early.
- Emit predictable consent state for GTM and Google Consent Mode v2.
- Make manual service configuration the primary workflow.
- Version every production config.

## Components

### Admin backend

The backend in `src/server` uses native Node modules only. It serves the admin UI, handles login sessions, stores site-scoped draft configs, and publishes immutable public config snapshots.

The default storage driver is SQLite:

```text
data/owncmp.sqlite
```

SQLite is used for site drafts, published configs, immutable versions, changelogs, audit events, and consent records.

The local JSON storage layout is still supported as a fallback when `CMP_STORAGE=json` is set. On first SQLite startup, existing JSON data is imported once into the SQLite database.

Legacy/source JSON paths:

Site draft configs live at:

```text
data/sites/:siteId/config.json
```

The site index lives at:

```text
data/sites/index.json
```

`data/config.json` is kept as a legacy/local compatibility mirror for `demo-site` in JSON mode and as an import source for SQLite migration.

Active production config historically lived at:

```text
data/published/:siteId/:environment.json
```

Immutable version snapshots historically lived at:

```text
data/published/:siteId/versions/:environment/:version.json
```

Rollback copies a selected immutable snapshot back to the active production config and records an audit event.

The runtime contract does not depend on the storage driver. A later Postgres driver can use the same storage function boundary.

### Admin UI

The admin UI in `public/admin` is a vanilla web app. It has a site selector, a new-site flow, and guarded switching when draft changes are unsaved. For the selected site, it edits banner copy, language presets for first-layer text, consent categories, and disclosure text, privacy policy URL, colors, corner style, placement, logo, custom CSS, category defaults, services, regional overrides, and publishes config. It also supports JSON import/export, visual publish diffs, publish history, and rollback.

### Public config endpoint

The runtime fetches:

```text
/api/public/config/:siteId/:environment
```

The response is public by design. It should contain only configuration that is safe for browsers to read.

Active production config responses use short public caching with validators:

- `Cache-Control: public, max-age=60, stale-while-revalidate=300, must-revalidate`
- `ETag`
- `Last-Modified`
- `X-OwnCMP-Config-Version`

Published immutable versions are also exposed at:

```text
/api/public/config/:siteId/:environment/:version
```

Those responses are safe to cache long-term because the version is part of the URL:

```text
Cache-Control: public, max-age=31536000, immutable
```

Use the active URL when a site should automatically receive the newest production publish. Use the version-pinned URL when a launch needs a frozen config that changes only when the snippet is updated.

The special `preview` environment returns the requested site's current draft config and requires an active admin session.

The public changelog endpoint is:

```text
/api/public/changelog/:siteId
```

Unknown site IDs return `404` instead of silently serving another site's config.

### Reporting

The admin reporting endpoint is:

```text
GET /api/reports/consent/:siteId?days=30
GET /api/reports/consent/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD
```

In SQLite mode it reads the `consent_records` table. In JSON fallback mode it reads consent record JSONL files from:

```text
data/records/:siteId/YYYY-MM.log
```

The runtime records `banner_shown` when the banner appears and `decision` when a user chooses Accept, Reject, or Save Choices. Both records share the same generated `cid` when the decision follows that banner view.

Reporting uses latest decision per `cid` for headline Accept, Reject, and Partial counts. Ignore is calculated as banner `cid`s without a matching decision in the selected period. Outcome percentages use tracked outcomes as the denominator: Accept + Reject + Partial + Other + Ignore. Response rate is calculated separately as decisions with a matching banner view divided by banner views. This is a practical no-interaction metric, not a browser-level unique-user identity.

Consent records are subject to a configurable retention policy. The default is 390 days, controlled by `CMP_CONSENT_RETENTION_DAYS`. Expired records are purged at most once per day when new consent records arrive, and admins can run the purge manually from the Storage panel.

Raw consent records can be exported by authenticated admins:

```text
GET /api/exports/consent/:siteId?days=30&format=json
GET /api/exports/consent/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
```

JSON export preserves the full raw record shape. CSV export flattens the common audit fields for spreadsheet review while keeping category and Google consent maps as JSON strings.

### Storage status

Authenticated admins can inspect operational storage state through:

```text
GET /api/storage/status
```

The Admin Storage panel uses this endpoint to show user-facing data-store health, database size, consent record count, backup count, and expandable technical details such as Node version, database path, WAL size, record counts, backup totals, and retention status.

### CMP runtime

`public/cmp/owncmp.js` is the website runtime. It:

- Sets privacy-first Google Consent Mode defaults immediately.
- Reads stored consent if available.
- Shows a banner if there is no valid decision.
- Supports centered default or bottom banner placement.
- Supports round, semi-round, or square banner corner styling.
- Supports an optional banner logo and site-defined custom banner CSS from config.
- Supports configured banner language copy, localized category labels, localized disclosure text, and an optional privacy policy link.
- Updates Google consent state after a user decision.
- Optionally syncs explicit user choices to Shopify Customer Privacy API when enabled.
- Pushes one stable dataLayer event shape.
- Deletes configured cookies only after explicit denial.
- Notifies `window.OwnCMPGtmBridge` when a GTM bridge is installed.
- Supports regional Consent Mode defaults from `googleConsentMode.regionalOverrides`.
- Detects `navigator.globalPrivacyControl` and applies configured GPC-denied categories before user interaction.

### GPC support resource

The static support declaration lives at:

```text
public/.well-known/gpc.json
```

It is served as:

```text
/.well-known/gpc.json
```

When the runtime is used together with the GTM Consent Mode bridge, set:

```html
data-google-consent="false"
```

This keeps Google consent updates inside GTM's consent APIs while the runtime still owns the banner, storage, cookie cleanup, and stable dataLayer event.

### Shopify Customer Privacy API

When enabled in Admin, the runtime loads Shopify's `consent-tracking-api` through `window.Shopify.loadFeatures` when needed and calls:

```js
window.Shopify.customerPrivacy.setTrackingConsent({
  analytics: true,
  marketing: true,
  preferences: true
}, callback);
```

The values are mapped from the visitor's explicit Own CMP choice:

- Own CMP `analytics` -> Shopify `analytics`
- Own CMP `marketing` -> Shopify `marketing`
- Own CMP `personalization` -> Shopify `preferences`

The runtime only syncs explicit user choices. It does not automatically write stored consent back into Shopify on page load, and it does not set `sale_of_data` from the normal cookie banner.

### GTM bridge

The GTM bridge source pack is in `gtm/`.

The generated importable template is `gtm/template.tpl`. The source files are:

- `gtm/own-cmp-consent-mode-template-code.js`
- `gtm/template-fields.json`
- `src/server/build-gtm.js`

The bridge:

- Runs on `Consent Initialization - All Pages`.
- Calls `setDefaultConsentState` for conservative defaults.
- Registers `window.OwnCMPGtmBridge`.
- Listens to `window.OwnCMP.onReady` and `window.OwnCMP.onChange`.
- Calls `updateConsentState` from Own CMP consent records.

## Consent Mode Defaults

The default state is conservative:

```js
{
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "granted",
  personalization_storage: "denied",
  security_storage: "granted"
}
```

These defaults can be edited in config. Region-specific defaults are represented as `googleConsentMode.regionalOverrides`.

## Known Technical Debt

- GTM `.tpl` import and template tests still need manual confirmation inside Google Tag Manager.
- The SQLite driver uses native `node:sqlite`, which currently requires Node.js 25+ and emits Node's experimental warning.
- Postgres is still a later hosted-production option if multi-process or managed database operations become a requirement.

Endpoint: `GET /api/public/cookie-db`
Database: `src/server/cookie-db.json`

Note: This component is in early beta and needs a more comprehensive pattern library.

## Performance Budget

Target runtime budget:

- No framework dependency.
- No blocking network request before setting Google defaults.
- One config fetch.
- One injected style block only when the banner is needed.
- No cookie deletion before explicit denial.
- Long-term target: under 10 KB compressed for the production runtime.
gle defaults.
- One config fetch.
- One injected style block only when the banner is needed.
- No cookie deletion before explicit denial.
- Long-term target: under 10 KB compressed for the production runtime.
