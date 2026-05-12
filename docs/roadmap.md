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

## Phase 6: Production Deployment Readiness

- [x] Secure admin authentication hardening
- [x] HTTPS-aware session cookies
- [x] CSRF protection for admin write endpoints
- [x] Login rate limiting
- [x] SQLite backup and restore workflow
- [x] Production environment configuration guide
- [x] Runtime cache and versioning strategy
- [x] Consent record retention policy
- [x] Consent record export by site and date range
- [x] Storage/status screen in Admin
- Final GTM `.tpl` import and template verification

## Phase 7: Real Website Go-Live

- Select production hosting model and region
- Resolve production Node runtime strategy: verify Node 24 LTS compatibility or pin a supported deployment image deliberately
- Containerize or otherwise package the Node runtime for repeatable deploys
- Provision persistent storage for `data/owncmp.sqlite`, backups, and published configs
- Configure HTTPS, domain, reverse proxy, and security headers
- Configure production environment variables and secret handling
- Establish automated backup export and restore testing
- Add uptime monitoring, log retention, and basic alerting
- Create deployment and rollback runbook
- Publish first production config and install the runtime snippet on a real website
- Verify GTM Consent Mode bridge on the live domain
- Verify public config caching, disclosure page, GPC resource, and consent record writes
- Document operational ownership and maintenance schedule

## Later Track: Product Polish

- Admin UI polish (dark mode, better error states)
- Scanner UX and cookie database expansion
- Broader reporting views

## Later Track: TCF

TCF and Google CMP certification are separate projects. They should not block the first useful version for normal Consent Mode v2 implementations.
