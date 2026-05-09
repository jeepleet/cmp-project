# Changelog

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

- Current project stage is early Phase 4.
- Next recommended work is manual GTM `.tpl` verification, then server-side consent records.
