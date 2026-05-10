# Project Status

Last updated: 2026-05-10

## Current Stage

Phase 5: Operational Scale and Insights (In Progress).

The project has moved past the first compliance/integration slice and is now focused on operational scale. Phase 5 now includes multi-site support, the consent reporting dashboard, and SQLite-backed durable storage.

## Current Features

- **Admin Login:** Native Node cookie-based sessions.
- **Multi-Site Admin:** Site selector, new-site creation, and optional cloning from the current site.
- **Site-Scoped Drafts:** Draft configs are stored per site under `data/sites/:siteId/config.json`.
- **Reporting Dashboard:** Site-scoped accept, reject, partial, and ignore metrics with daily breakdowns.
- **Config Management:** Draft editor with automatic versioning and Visual Diff before publishing.
- **Banner Editor:** Customizable copy, colors (theme), and layout (position).
- **Consent Logic:** Google Consent Mode v2 mapping with Regional Overrides (e.g. EEA).
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

## Current Milestone In Progress

Phase 5: Operational Scale and Insights.

Current focus: Finish manual verification of SQLite-backed durable storage before starting the next Phase 5 item.

Implemented in this slice:

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
