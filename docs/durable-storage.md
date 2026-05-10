# Durable Storage

Last updated: 2026-05-10

## Current Driver

Own CMP uses SQLite by default.

```text
data/owncmp.sqlite
```

The SQLite driver stores:

- Sites and draft configs
- Published production configs
- Immutable published versions
- Public changelog entries
- Admin audit events
- Consent records
- Reporting source data

## Migration Behavior

On first startup with SQLite enabled, the server imports existing local JSON data into SQLite once.

Imported sources:

- `data/config.json`
- `data/sites/:siteId/config.json`
- `data/published/:siteId/:environment.json`
- `data/published/:siteId/versions/:environment/:version.json`
- `data/published/:siteId/changelog.json`
- `data/audit.local.json`
- `data/records/:siteId/YYYY-MM.log`

The JSON files are not deleted. They remain useful as local migration backups.

## Fallback Mode

For local debugging, JSON mode can still be forced before startup:

```powershell
$env:CMP_STORAGE="json"
node src/server/index.js
```

Normal Phase 5 work should use SQLite mode unless debugging old JSON behavior.

## Runtime Requirement

SQLite uses Node's native `node:sqlite` module.

Current requirement:

```text
Node.js >= 25
```

Node currently prints an experimental warning for `node:sqlite`. This does not block local operation, but it should be considered before hosted production use.

## Later Option

Postgres remains a later option if the project needs managed backups, multi-process writes, hosted operations, or larger reporting workloads.
