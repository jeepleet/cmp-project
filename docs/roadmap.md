# Roadmap

## Phase 1: Local MVP

- Admin login
- Site config editor
- Banner text and theme settings
- Consent categories
- Manual services
- Public config endpoint
- Vanilla CMP runtime
- Google Consent Mode v2 mapping
- Stable dataLayer event
- Publish and rollback-ready config versions
## Phase 2: Operational Quality

- [x] Staging environment preview
- [x] Config diff before publish
- [x] Config version history
- [x] Import/export JSON
- [x] Consent debugger / Test Lab
- [x] Region-specific Consent Mode defaults
- [x] Public changelog for runtime and config schema



## Phase 3: Integration Layer

- [x] GTM custom template
- [x] WordPress snippet/plugin
- [x] Shopify installation guide
- [skipped] Webflow installation guide
- [x] Integration layer finalized

## Phase 4: Compliance and Scale

- [x] Optional server-side consent record storage
- [x] User self-disclosure view
- [x] Accessibility audit
- [x] Performance lab with INP measurements
- [x] GPC support resource at `/.well-known/gpc.json`
- [x] Optional scanner as a helper (Needs revisit for UX/Coverage)

## Phase 5: Operational Scale and Insights

- [x] Multi-site support (site selection, site creation, and site-scoped drafts)
- [x] Durable database migration (SQLite)
- [x] Consent Reporting Dashboard (accept, reject, partial, and ignore rates)
- TCF 2.2 Foundation (Legal vendor list support)
- Admin UI Polish (Dark mode, better error states)

## Later Track: TCF

TCF and Google CMP certification are separate projects. They should not block the first useful version for normal Consent Mode v2 implementations.
