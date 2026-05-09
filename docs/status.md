# Project Status

Last updated: 2026-05-09

## Current Stage

Phase 4: Compliance and Scale (In Progress).

The project has a robust foundation with a dependency-free Node backend, a versioned configuration system, and a lightweight runtime. We have completed the integration layer for GTM, WordPress, and Shopify, and implemented core legal compliance features like GPC support and Server-Side Records.

## Current Features

- **Admin Login:** Native Node cookie-based sessions.
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
- Active event name: `owncmp.consent_ready`
- Active version: `20260508T130000Z`

## Completed Milestones

1. **Local MVP:** Scaffolded the dependency-free app, admin, and runtime.
2. **Operational Quality:** Added version history, rollback, visual diffs, and regional defaults.
3. **Integration Layer:** Built GTM template, WordPress snippet, and Shopify guide.
4. **Transparency & Proof:** Implemented Server-Side Records and User Disclosure View.
5. **GPC Support:** Added runtime detection and public declaration resource.
6. **Maintenance & A11Y:** Established backup points, enforced path consistency, and implemented WCAG 2.1 accessibility enhancements (Focus Trap, ARIA, Keyboard). Fully verified.
7. **Performance Lab:** Integrated performance instrumentation and dashboard.
8. **Scanner Helper:** Implemented "Active Console Scanner" for cookie identification. (Note: Needs UX/DB revisit later).

## Completed Milestones

1. **Local MVP:** Scaffolded the dependency-free app, admin, and runtime.
2. **Operational Quality:** Added version history, rollback, visual diffs, and regional defaults.
3. **Integration Layer:** Built GTM template, WordPress snippet, and Shopify guide.
4. **Transparency & Proof:** Implemented Server-Side Records and User Disclosure View.
5. **GPC Support:** Added runtime detection and public declaration resource.
6. **Maintenance & A11Y:** Implemented WCAG 2.1 accessibility and established backup points.
7. **Performance & Compliance:** Built the Performance Lab and the first Cookie Scanner iteration.

## Current Milestone In Progress

Phase 5: Operational Scale and Insights.

Current focus: Preparing the architecture for multi-site support and durable storage.

## Known Technical Debt / Revisit List

- **Cookie Scanner:** The current console-based scanner needs a better UX and a more extensive cookie database.
- **Manual Verification:** GTM `.tpl` import still needs final confirmation in Google Tag Manager.

## Documentation Rule

Every meaningful project change must update documentation in the same work session.
