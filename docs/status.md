# Project Status

Last updated: 2026-05-12

## Current Stage

Phase 6: Production Deployment Readiness (Next).

The project has completed the Phase 5 operational scale slice: multi-site support, consent reporting, and SQLite-backed durable storage. The next phase is preparing the CMP to run on a real website with secure admin operations, backup/restore, deployment documentation, runtime cache/versioning, and launch verification.

## Current Features

- **Admin Login:** Native Node cookie-based sessions with scrypt password-hash support.
- **Multi-Site Admin:** Site selector, new-site creation, and optional cloning from the current site.
- **Site-Scoped Drafts:** Draft configs are stored per site under `data/sites/:siteId/config.json`.
- **Reporting Dashboard:** Site-scoped accept, reject, partial, and ignore metrics with daily breakdowns.
- **Consent Retention:** Configurable consent record retention with status and manual purge controls.
- **Config Management:** Draft editor with automatic versioning, Visual Diff before publishing, active config URLs, and pinned immutable config URLs.
- **Banner Editor:** Customizable copy, language presets for first-layer text, consent categories, and disclosure text, privacy policy URL, colors, corner style, center/default or bottom layout, logo upload, logo alt text, and custom CSS.
- **Consent Logic:** Google Consent Mode v2 mapping with Regional Overrides (e.g. EEA) and optional Shopify Customer Privacy API sync.
- **Manual Services:** Service-to-category assignment with automatic cookie cleanup patterns.
- **Proof of Consent:** Server-side append-only records (JSONL) with persistent Consent IDs (CID).
- **Transparency:** User Self-Disclosure view showing historical decisions trail.
- **Global Privacy Control:** Runtime detection and public support declaration at `/.well-known/gpc.json`.
- **Integrations:** Verified GTM Bridge (`.tpl`), WordPress PHP snippet, and Shopify Liquid guide.
- **Dev Tools:** Runtime Test Lab with environment switching (Production vs Preview).
- **Import/Export:** Full site configuration JSON export and import.

## Current Local Config

- Site ID: `demo-site`
- Site name: `Demo Site`
- Active environment: `production`
- Active event name: `cmp.consent_ready`
- Active version: `20260508T165641Z`

## Completed Milestones

1. **Local MVP:** Scaffolded the dependency-free app, admin, and runtime.
2. **Operational Quality:** Added version history, rollback, visual diffs, and regional defaults.
3. **Integration Layer:** Built GTM template, WordPress snippet, and Shopify guide.
4. **Transparency & Proof:** Implemented Server-Side Records and User Disclosure View.
5. **GPC Support:** Added runtime detection and public declaration resource.
6. **Maintenance & A11Y:** Established backup points, enforced path consistency, and implemented WCAG 2.1 accessibility enhancements (Focus Trap, ARIA, Keyboard). Fully verified.
7. **Performance Lab:** Integrated performance instrumentation and dashboard.
8. **Scanner Helper:** Implemented "Active Console Scanner" for cookie identification. (Note: Needs UX/DB revisit later).
9. **Phase 5 Scale:** Implemented multi-site support, consent reporting with ignore metrics, and SQLite durable storage.

## Current Milestone

Phase 6: Production Deployment Readiness.

Current focus: continue Phase 6 production hardening. Admin auth hardening, HTTPS-aware session cookies, CSRF protection, login rate limiting, SQLite backup/restore, the production environment guide, runtime cache/versioning, consent record retention, consent record export, and Admin storage/status are implemented; next item is final GTM `.tpl` import and template verification.

Phase 5 implemented:

- Site index API: `GET /api/sites`
- Site creation API: `POST /api/sites`
- Site-scoped admin config API: `GET/PUT /api/config/:siteId`
- Site-scoped preview configs at `/api/public/config/:siteId/preview`
- Admin site selector and new-site flow
- Existing publish, rollback, changelog, snippets, and consent records remain keyed by `siteId`
- Reporting API: `GET /api/reports/consent/:siteId?days=30`
- Custom reporting ranges: `GET /api/reports/consent/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Runtime banner impression records for the ignore metric
- SQLite storage driver using `data/owncmp.sqlite`
- One-time import from existing JSON files into SQLite
- JSON fallback via `CMP_STORAGE=json`

Phase 6 implemented:

- Public immutable config endpoint: `GET /api/public/config/:siteId/:environment/:version`
- Active production config caching with `ETag`, `Last-Modified`, and `X-OwnCMP-Config-Version`
- Immutable one-year caching for version-pinned public config URLs
- Runtime script caching with validators
- Admin Snippets panel shows both active and pinned production install snippets
- Consent record retention policy via `CMP_CONSENT_RETENTION_DAYS` with a default of 390 days
- Authenticated retention status API: `GET /api/consent-retention`
- Authenticated retention purge API: `POST /api/consent-retention/purge`
- Admin Storage panel shows retention policy, cutoff, expired count, and manual purge control
- Consent record export API: `GET /api/exports/consent/:siteId?days=30&format=json`
- Consent record export supports custom `from=YYYY-MM-DD&to=YYYY-MM-DD` ranges and `json` or `csv` format
- Admin Reporting panel has JSON and CSV export buttons for the selected site and period
- Storage status API: `GET /api/storage/status`
- Admin Storage panel shows data store, database size, consent record count, backup count, and technical details behind an expandable section

Phase 7 planned scope:

- Railway hosting, `/app/data` volume persistence, Node runtime strategy, and deployment packaging
- Cloudflare DNS, proxied custom domain, runtime/config cache rules, cache bypasses, and production security controls
- Backup automation, off-platform backup handling, and restore testing
- Monitoring, logs, alerts, deployment runbook, and rollback runbook
- Live website install, GTM bridge verification, public config caching verification, disclosure page verification, GPC verification, and consent record write verification

Phase 6 planned scope:

- [x] Secure admin authentication hardening with `CMP_ADMIN_PASSWORD_HASH`
- [x] HTTPS-aware session cookies
- [x] CSRF protection for admin writes
- [x] Login rate limiting
- [x] SQLite backup and restore workflow
- [x] Production environment configuration guide
- [x] Runtime cache and versioning strategy
- [x] Consent record retention policy
- [x] Consent record export by site/date range
- [x] Admin storage/status screen
- Final GTM `.tpl` import and template verification

Reporting definition:

- **Accept:** Latest decision for a generated consent ID grants all optional categories.
- **Reject:** Latest decision for a generated consent ID denies all optional categories.
- **Partial:** Latest decision grants some optional categories and denies others.
- **Ignore:** A banner was shown, but no matching decision record exists for that generated consent ID in the selected period.
- **Outcome percentage:** Accept, Reject, Partial, and Ignore percentages use tracked outcomes as the denominator, not banner views. This prevents legacy decision records from producing rates above 100%.
- **Response rate:** Decisions with a matching banner view divided by banner views.

## Known Technical Debt / Revisit List

- **Cookie Scanner:** The current console-based scanner needs a better UX and a more extensive cookie database.
- **Manual Verification:** GTM `.tpl` import still needs final confirmation in Google Tag Manager.
- **Storage Driver:** SQLite uses native `node:sqlite`, which requires Node.js 25+ and currently emits Node's experimental warning.
- **Postgres:** Not implemented yet. SQLite is the first durable storage target.

## Documentation Rule

Every meaningful project change must update documentation in the same work session.
