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

## Backups

Admin users can create, download, and restore backups from the Admin Storage panel.

The Admin Storage panel also exposes a storage status summary backed by:

```text
GET /api/storage/status
```

The status response includes the active storage driver, Node version, data and backup directories, backup totals, retention status, record counts, and SQLite file details when SQLite is active.

SQLite backups are stored under:

```text
data/backups/
```

Backup filenames use this pattern:

```text
owncmp-sqlite-YYYYMMDDTHHMMSSmmmZ.sqlite
```

Older backups using `owncmp-sqlite-YYYYMMDDTHHMMSSZ.sqlite` remain valid for listing, download, and restore.

Before a restore, Own CMP automatically creates a safety backup of the current SQLite database. This makes accidental restores reversible as long as the backup directory is preserved.

Backup and restore endpoints:

```text
GET  /api/backups
POST /api/backups
GET  /api/backups/:filename/download
POST /api/backups/:filename/restore
```

All backup mutation endpoints require an authenticated admin session and a valid CSRF token.

## Consent Record Retention

Consent records are retained for 390 days by default. The value can be changed with:

```powershell
$env:CMP_CONSENT_RETENTION_DAYS="390"
```

Use `0` to disable Own CMP retention purging. This should normally be limited to local debugging or deployments where retention is handled outside this application.

Expired records are purged at most once per day when a new consent record is written. Admin users can also view the policy and run a purge from the Admin Storage panel.

Retention endpoints:

```text
GET  /api/consent-retention
POST /api/consent-retention/purge
```

In SQLite mode, expired rows are deleted from the `consent_records` table. In JSON fallback mode, expired JSONL entries are removed from `data/records/:siteId/YYYY-MM.log`; malformed lines are preserved.

## Consent Record Export

Authenticated admins can export raw consent records for a site and date range:

```text
GET /api/exports/consent/:siteId?days=30&format=json
GET /api/exports/consent/:siteId?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
```

Supported formats:

- `json`: full export envelope with raw records.
- `csv`: spreadsheet-friendly columns for timestamp, site, CID, record type, action, source, config version, categories, Google consent, and user agent.

The Admin Reporting panel uses the selected reporting period for JSON and CSV exports.

## Runtime Requirement

SQLite uses Node's native `node:sqlite` module.

Current requirement:

```text
Node.js >= 25
```

Node currently prints an experimental warning for `node:sqlite`. This does not block local operation, but it should be considered before hosted production use.

## Later Option

Postgres remains a later option if the project needs managed backups, multi-process writes, hosted operations, or larger reporting workloads.
