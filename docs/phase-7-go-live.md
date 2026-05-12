# Phase 7: Real Website Go-Live

Last updated: 2026-05-12

## Goal

Phase 7 turns Own CMP from a local/admin project into a production service that can run safely on real websites.

## Recommended Hosting Shape

Start with a single small EU VPS and Docker:

- Ubuntu LTS server in an EU region
- Docker Compose
- Caddy or nginx as HTTPS reverse proxy
- Persistent local disk for `data/`
- Automated off-server backups
- Uptime monitoring for `/cmp/owncmp.js` and `/api/public/config/:siteId/production`

This matches the current architecture because Own CMP writes SQLite, published configs, audit data, and backups to the local `data/` directory. A VPS keeps that model simple and avoids platform filesystem surprises.

## Minimum Production Components

- Domain such as `cmp.example.com`
- Production Node runtime strategy: either verify Node 24 LTS compatibility or pin a known-good runtime image until the storage layer is adjusted
- TLS certificate with automatic renewal
- Reverse proxy forwarding to the Node app
- `CMP_ADMIN_EMAIL`
- `CMP_ADMIN_PASSWORD_HASH`
- `CMP_FORCE_SECURE_COOKIES=true` unless proxy headers are verified
- `CMP_CONSENT_RETENTION_DAYS`
- Persistent `data/` directory
- Backup job that copies SQLite backups off the server
- Log retention for Node and reverse proxy logs
- Uptime checks and alert destination

## Deployment Checklist

- Package app with Docker or a documented systemd Node service.
- Mount persistent storage at the app `data/` directory.
- Configure HTTPS and verify `X-Forwarded-Proto: https`.
- Set production admin credentials and remove default credentials.
- Create a backup before each deploy.
- Test restore from backup before first live launch.
- Publish the first production config from Admin.
- Install the runtime snippet on the real website.
- Verify the banner appears for a fresh visitor.
- Verify accept, reject, partial, and ignore records.
- Verify the disclosure page loads localized text and historical records.
- Verify `/.well-known/gpc.json`.
- Verify GTM Consent Mode bridge behavior in Tag Assistant.
- Verify public config cache headers for active and pinned URLs.
- Document rollback steps.

## Later Scale Path

The first production version can run well on SQLite. Move to managed Postgres only when you need multi-instance app servers, stronger database operations, or higher availability than a single-node SQLite deployment can reasonably provide.
