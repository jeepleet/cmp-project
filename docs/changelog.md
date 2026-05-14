# Changelog

## 2026-05-14

### Added

- Added a persistent cookie preferences icon to the runtime so visitors can reopen the banner after making a choice.
- Added a Banner setting for placing the preferences icon on the left or right side of the website.
- Added `docs/workflow.md` to document the Draft -> Release workflow, required Markdown updates, and required test guidance.
- Added `docs/phase-gtm-tag-fix.md` to define the new Phase GTM Tag Fix requirements for a stable production GTM install surface.
- Added `window.OwnCMPBootstrap` as the stable GTM-to-runtime handoff for `siteId`, config URL, dataLayer name, and GTM Consent Mode flags.

### Changed

- Renamed the Own CMP consent cookie to `CleanCmpConsent`.
- Runtime now migrates existing legacy `owncmp_consent_:siteId` cookies into `CleanCmpConsent`.
- Disclosure links now point to the CMP-hosted disclosure page and include the current consent ID, so consent history works when the CMP is installed through GTM on another domain.
- Removed the Admin Overview `Runtime / Vanilla JS` metric card.
- Reframed GTM runtime rollout requirements: normal code fixes must not require customer GTM URL edits, temporary cache-busting URLs, manual Cloudflare purges, or template re-imports.
- GTM deployment mode now injects the stable runtime URL without dynamic query parameters.
- GTM deployment mode strips query strings and hashes from the Runtime script URL field before injection.
- GTM template `inject_script` permission now targets only `https://cmp.cleancmp.com/cmp/owncmp.js`.
- Runtime script responses now use `Cache-Control: public, no-cache, must-revalidate`.
- Runtime settings are resolved from `data-*` attributes first, `window.OwnCMPBootstrap` second, and legacy query parameters last.
- Admin GTM snippets now document the `window.OwnCMPBootstrap` handoff and warn against query parameters on the runtime URL.
- Added a GTM template regression test for the stable bootstrap handoff and query-free injected runtime URL.

### Fixed

- Fixed `window.OwnCMP.getConfig()` so it returns the current config instead of reopening the banner.
- Fixed the preferences icon so it updates left/right placement when the public config changes and uses a clearer cookie-style visual.
- Fixed the preferences icon side control so left/right placement is applied explicitly at runtime.
- Replaced the inherited white preferences icon with a colored cookie/check visual.
- Normalized legacy `owncmp_consent_ready`, `owncmp.consent_ready`, and previous `cmp.consent_ready` values to `cmp_consent_ready` so old values do not leak into the dataLayer after the Admin event name has changed.
- Fixed the disclosure history page so banner-view or legacy history records without category decisions render safely instead of throwing `Cannot convert undefined or null to object`.

## 2026-05-13

### Fixed

- Fixed GTM Consent Mode bridge ordering by calling `OwnCMPGtmBridge` before pushing the canonical `owncmp.consent_ready` dataLayer event. GTM can now apply `updateConsentState` before processing that event instead of only affecting later events.
- Added a primary GTM listener path through `OwnCMP.onReady` and `OwnCMP.onChange` using `callInWindow`, while keeping `OwnCMPGtmBridge` as a fallback for Consent Mode updates.
- Added `OwnCMPAddConsentListener` as a stable GTM callback registration hook and moved runtime listener notifications before the consent-ready dataLayer event.
- Added a GTM deployment fallback query parameter, `gtmConsentFallback=true`, so the runtime can push a direct Consent Mode update before the consent-ready event if GTM's sandbox callback update is not reflected in Preview.
- Fixed SQLite backup filename precision so a restore safety backup cannot collide with another backup created in the same second.
- Verified the production backup and restore workflow from Admin.

## 2026-05-12

### Added

- Banner language selector in Admin with preset translations for English, Danish, Swedish, Norwegian, and German.
- Privacy policy URL field in the Banner section.
- Runtime rendering for the configured privacy policy link.
- Localized banner privacy policy link text and GPC notice text from the selected language preset.
- Localized consent category labels and descriptions from the selected banner language preset.
- Localized "View my consent data" banner link and disclosure page text.
- Banner corner style control with round, semi-round, and square options.
- Roadmap Phase 7 for real website go-live, covering hosting, deployment, persistence, monitoring, and live verification.
- Complete Phase 7 Railway + Cloudflare go-live runbook with volume path, environment variables, DNS, cache rules, security rules, snippets, verification, backups, monitoring, and rollback.
- Phase 7 status tracking for GitHub push, Railway service creation, production admin variables, `/app/data` volume, successful deployment, and Railway public Admin verification.
- Added missing public GPC declaration file at `/.well-known/gpc.json`.
- Verified Railway public runtime script, GPC declaration, and published production config endpoints.
- Recorded `cleancmp.com` as the selected Cloudflare production domain for Phase 7.
- Connected `cmp.cleancmp.com` to Railway on port `8080` with DNS-only Cloudflare CNAME and verified HTTPS.
- Enabled Cloudflare proxy for `cmp.cleancmp.com` and verified Admin, runtime script, GPC declaration, and production config through the proxied hostname.
- Configured Cloudflare cache and bypass rules for private/write endpoints, runtime script, active production config, public config fallback for pinned versions, and GPC declaration.
- Verified active production config, pinned production config, and GPC declaration through Cloudflare.
- Upgraded the GTM template from bridge-only to **Own CMP Runtime Loader + Consent Mode Bridge** with runtime URL, site ID, config URL, runtime load toggle, and `inject_script` permission.
- Runtime now accepts GTM-injected query parameters for `siteId`, `configUrl`, `dataLayer`, and `googleConsent`, while preserving hardcoded `data-*` attributes.
- Fixed GTM preview permission failure by allowing read/write global access for `OwnCMPGtmBridge`.
- Hardened runtime banner actions so non-critical GTM bridge, listener, record dispatch, Shopify sync, or cookie cleanup errors cannot prevent the banner from closing.
- Initialized `dataLayer` before emitting Own CMP events when the runtime is injected by GTM.
- Removed direct `OwnCMP.onReady` / `OwnCMP.onChange` listener registration from the GTM template to avoid GTM preview invoking the consent bridge with an undefined or unexpected record.
- Verified GTM Runtime Loader + Consent Mode Bridge on `jeppeskaffe.dk` with a cache-busted runtime URL after Cloudflare/browser cache served an older runtime.

## 2026-05-11

### Added

- Banner position controls for centered or bottom display, with centered as the default for new configs.
- Banner logo upload, preview, removal, and alt text in Admin.
- Runtime rendering for uploaded banner logos.
- Custom banner CSS field in Admin and runtime support for config-defined CSS.
- Shopify Customer Privacy API toggle in the Consent section.
- Runtime sync from explicit Own CMP user choices to Shopify `setTrackingConsent` for analytics, marketing, and preferences.
- Consent record retention policy with `CMP_CONSENT_RETENTION_DAYS` defaulting to 390 days.
- Authenticated retention status endpoint: `GET /api/consent-retention`.
- Authenticated retention purge endpoint: `POST /api/consent-retention/purge`.
- Daily opportunistic purge of expired consent records when new consent records are written.
- Admin Storage panel retention summary with policy, cutoff, expired count, and manual purge control.
- Consent record export endpoint: `GET /api/exports/consent/:siteId`.
- Consent record export support for `days`, custom `from` / `to`, and `json` / `csv` formats.
- Admin Reporting panel JSON and CSV export buttons for the selected site and period.
- Storage status endpoint: `GET /api/storage/status`.
- Admin Storage panel status cards for driver, database size, consent records, and backups.
- Admin Storage details for Node version, data paths, database path, WAL size, record counts, backup totals, and retention state.
- Public immutable config endpoint: `GET /api/public/config/:siteId/:environment/:version`.
- Long-cache headers for version-pinned public config responses.
- `ETag`, `Last-Modified`, and `X-OwnCMP-Config-Version` headers for public config responses.
- Conditional `304 Not Modified` support for cacheable JSON responses and static runtime assets.
- Active and pinned production runtime snippets in the Admin Snippets panel.
- Runtime cache and versioning guidance in README, architecture, status, roadmap, production environment, GTM, WordPress, and Shopify docs.

### Changed

- Admin Storage now uses user-facing data-store wording and hides operational technical details behind a "Technical details" disclosure.
- Removed the Admin Launch panel and launch-checklist API because the section duplicated production docs and added UI noise.
- Custom banner CSS textarea is empty by default.
- Public active config responses now use short public caching with revalidation instead of plain `max-age=60`.
- `/cmp/owncmp.js` now returns cache validators and short public caching.
- Phase 6 status now marks runtime cache/versioning, consent record retention, consent record export, and Admin storage/status as completed.

## 2026-05-10

### Added

- Roadmap Phase 6: Production Deployment Readiness.
- Phase 6 scope covering admin security, HTTPS/session hardening, CSRF protection, rate limiting, backup/restore, deployment guidance, runtime cache/versioning, retention/export, storage status, launch checklist, and final GTM verification.
- Scrypt admin password hash support via `CMP_ADMIN_PASSWORD_HASH`.
- Password hash generation helper at `src/server/hash-password.js`.
- HTTPS-aware admin session cookies that add `Secure` for HTTPS/proxy requests.
- `CMP_FORCE_SECURE_COOKIES=true` override for deployments that must force secure session cookies.
- Per-session CSRF tokens for authenticated admin sessions.
- CSRF protection on admin write endpoints, including save config, publish, rollback, create site, and logout.
- In-memory login rate limiting for repeated failed admin login attempts.
- SQLite backup and restore workflow.
- Admin Storage panel for creating, listing, downloading, and restoring backups.
- Automatic safety backup before restoring a SQLite backup.
- Production environment configuration guide in `docs/production-environment.md`.
- Phase 5 multi-site foundation with a site index at `data/sites/index.json`.
- Site-scoped draft config storage at `data/sites/:siteId/config.json`.
- Authenticated site listing API: `GET /api/sites`.
- Authenticated site creation API: `POST /api/sites`.
- Site-scoped admin config API: `GET /api/config/:siteId` and `PUT /api/config/:siteId`.
- Admin site selector and new-site creation flow with optional cloning from the current site.
- Unsaved-change guard when switching sites or creating a new site.
- Site-scoped Consent Reporting Dashboard in Admin.
- Reporting period selector for the last 7, 30, 90, or 365 days.
- Custom reporting date range selector.
- Consent reporting API: `GET /api/reports/consent/:siteId?days=30`.
- Consent reporting API support for `from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Runtime `banner_shown` records so no-interaction/ignore behavior can be measured.
- Decision action labels for `accept_all`, `reject_all`, and `save_choices` records.
- SQLite storage driver using `data/owncmp.sqlite`.
- One-time JSON-to-SQLite migration for existing local project data.
- JSON fallback mode via `CMP_STORAGE=json`.
- Durable storage documentation in `docs/durable-storage.md`.

### Changed

- Admin draft loading and saving now uses the selected site instead of the legacy single `data/config.json` file.
- Preview public config requests now return the requested site's draft config instead of always returning the default draft.
- `data/config.json` remains as a compatibility mirror for `demo-site`.
- Updated README, architecture, roadmap, and status docs for Phase 5 multi-site support.
- Reporting headline metrics use latest decision per generated consent ID. Ignore is calculated from banner views without a matching decision in the selected period.
- Reporting percentages now use tracked outcomes as the denominator instead of banner views, preventing legacy decision records from showing rates above 100%.
- Storage now defaults to SQLite instead of local JSON files.
- Node engine requirement changed to Node.js 25+ because the SQLite driver uses native `node:sqlite`.
- Project status now marks Phase 5 as completed and Phase 6 as the next milestone.
- Production admin setup now prefers password hashes instead of plaintext `CMP_ADMIN_PASSWORD`.
- Admin session responses now expose whether secure cookies are active for the current request.
- Admin UI now sends `X-CSRF-Token` automatically for unsafe API requests.
- Failed admin login attempts now return `429 Too Many Requests` with `Retry-After` after the configured threshold.
- Backup files are stored under `data/backups`.
- README now links the production environment guide.

## 2026-05-08

### Added

- Initial dependency-free Node backend.
- Admin login and cookie session handling.
- Vanilla admin UI.
- Editable CMP config.
- Public config endpoint.
- Vanilla CMP runtime.
- Demo page.
- Google Consent Mode v2 signal mapping.
- Stable dataLayer event output.
- Cookie cleanup only after explicit denial.
- Publish history snapshots.
- Version list, version preview, and rollback API.
- Admin History tab.
- Pending publish diff in admin Overview.
- Project status document.
- Documentation rule for future changes.
- GTM Consent Mode bridge source pack.
- GTM template field and permission specification.
- GTM bridge installation documentation.
- Runtime support for `data-google-consent="false"`.
- Runtime callback bridge via `window.OwnCMPGtmBridge`.
- Admin snippet for GTM bridge installations.
- Automated GTM `.tpl` template generator in `src/server/build-gtm.js`.
- Importable GTM custom template `gtm/template.tpl` with unit tests.
- Site configuration Import and Export (JSON) in the Admin UI.
- Runtime Test Lab (`public/test-lab.html`) for manual verification.
- Preview environment support in backend and Test Lab.
- Region-specific Consent Mode default overrides in Admin and Runtime.
- Detailed visual Config Diff in the Admin Overview.
- Public site changelog API and "View Changelog" in Test Lab.
- CMP Script versioning and debug info in Test Lab.
- Backend `diffConfigs` logic for automated public changelog generation.
- GPC support resource at `/.well-known/gpc.json`.
- GPC implementation notes in `docs/gpc.md`.
- GTM manual verification checklist in `docs/gtm-verification.md`.
- Server-side Consent Records (Audit Trail) system with JSONL log storage.
- Support for persistent Consent ID (`cid`) across decision updates.
- User Self-Disclosure View (`public/disclosure.html`) for decision history transparency.
- Public `window.OwnCMP.openBanner()` method and Test Lab trigger.
- WCAG 2.1 Accessibility enhancements: Focus trap (visiblity-aware), keyboard navigation (Escape/Tab), and ARIA roles/labels.
- Performance instrumentation and real-time dashboard in the Test Lab.
- CMP API additions: `getPerformanceMetrics()`, `openBanner()`, and `resetConsent()`.
- Active Cookie Scanner in Admin (initial version, requires UX revisit).

### Changed

- Simplified authentication to a single-user model (removed Roles & Permissions).
- Updated `owncmp.js` to allow credentials in Preview mode for local testing.
- Updated `package.json` with `build:gtm` script.
- Audited repository status and updated documentation to match current implementation.
- Restored site ID storage consistency so active config, version history, and changelog paths use the requested `siteId`.
- Reset local demo data back to a clean `demo-site` seed.
- Rebuilt GTM template generation to emit valid GTM export sections and permission value shapes.
- Changed generated GTM template category from unsupported `PRIVACY` to documented `UTILITY`.
- Simplified generated GTM test block to `scenarios: []` until import succeeds in the GTM editor.

### Fixed

- Fixed `/api/public/changelog/:siteId`, which referenced missing helper variables/functions and returned HTTP 500.
- Removed temporary `DEFAULT_SITE_ID` path forcing so published configs, versions, and changelogs use the requested site ID consistently.
- Fixed invalid GTM `.tpl` wrapper format that caused GTM import errors.

### Notes

- Superseded by the 2026-05-10 Phase 5 multi-site entry above.
