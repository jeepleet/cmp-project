# Changelog

## 2026-05-10

### Added

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
