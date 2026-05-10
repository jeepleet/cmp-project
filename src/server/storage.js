import fsSync from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.local.json");
const SITES_DIR = path.join(DATA_DIR, "sites");
const SITES_INDEX_FILE = path.join(SITES_DIR, "index.json");
const DB_FILE = path.join(DATA_DIR, "owncmp.sqlite");
const STORAGE_DRIVER = String(process.env.CMP_STORAGE || "sqlite").toLowerCase();
const USE_SQLITE = STORAGE_DRIVER !== "json";

const require = createRequire(import.meta.url);
let sqliteDb = null;

export const DEFAULT_SITE_ID = "demo-site";

export const DEFAULT_CONFIG = {
  siteId: DEFAULT_SITE_ID,
  siteName: "Demo Site",
  environment: "production",
  schemaVersion: 1,
  version: "draft",
  lastPublishedAt: null,
  consentCookieName: "owncmp_consent",
  consentTtlDays: 180,
  banner: {
    title: "Privacy choices",
    body: "We use cookies and similar technologies for analytics, marketing, and personalization. Choose what you allow.",
    acceptAllText: "Accept all",
    rejectAllText: "Reject all",
    preferencesText: "Preferences",
    saveText: "Save choices",
    closeText: "Close",
    position: "bottom",
    language: "en",
    theme: {
      background: "#ffffff",
      text: "#1d1f24",
      border: "#d9dee7",
      primary: "#0f766e",
      neutral: "#374151"
    }
  },
  googleConsentMode: {
    enabled: true,
    mode: "advanced",
    waitForUpdateMs: 500,
    defaultState: {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      personalization_storage: "denied",
      security_storage: "granted"
    },
    categoryMap: {
      necessary: ["functionality_storage", "security_storage"],
      analytics: ["analytics_storage"],
      marketing: ["ad_storage", "ad_user_data", "ad_personalization"],
      personalization: ["personalization_storage"]
    },
    regionalOverrides: [
      {
        region: ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "GB", "CH", "LI", "NO"],
        displayName: "EEA + UK + CH",
        state: {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          analytics_storage: "denied",
          functionality_storage: "granted",
          personalization_storage: "denied",
          security_storage: "granted"
        }
      }
    ],
    recordConsent: true
  },
  dataLayer: {
    eventName: "owncmp.consent_ready"
  },
  gpc: {
    enabled: true,
    showNotice: true,
    denyCategories: ["marketing", "personalization"]
  },
  cookieCleanup: {
    mode: "on_explicit_denial"
  },
  categories: [
    {
      id: "necessary",
      label: "Necessary",
      description: "Required for security, consent storage, and basic site functionality.",
      required: true,
      default: true
    },
    {
      id: "analytics",
      label: "Analytics",
      description: "Helps measure traffic and improve the site.",
      required: false,
      default: false
    },
    {
      id: "marketing",
      label: "Marketing",
      description: "Supports advertising measurement, remarketing, and campaign attribution.",
      required: false,
      default: false
    },
    {
      id: "personalization",
      label: "Personalization",
      description: "Stores choices and content preferences beyond strictly necessary settings.",
      required: false,
      default: false
    }
  ],
  services: [
    {
      id: "ga4",
      name: "Google Analytics 4",
      category: "analytics",
      enabled: false,
      cookies: ["_ga", "_ga_*"],
      notes: "Enable when GA4 is implemented."
    },
    {
      id: "google-ads",
      name: "Google Ads",
      category: "marketing",
      enabled: false,
      cookies: ["_gcl_*", "_gac_*"],
      notes: "Enable when Google Ads conversion or remarketing tags are implemented."
    }
  ],
  updatedAt: new Date().toISOString()
};

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(SITES_DIR, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

function getDb() {
  if (sqliteDb) return sqliteDb;

  fsSync.mkdirSync(DATA_DIR, { recursive: true });
  const { DatabaseSync } = require("node:sqlite");
  sqliteDb = new DatabaseSync(DB_FILE);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      site_id TEXT PRIMARY KEY,
      site_name TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'production',
      draft_json TEXT NOT NULL,
      updated_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS published_configs (
      site_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      version TEXT NOT NULL,
      config_json TEXT NOT NULL,
      last_published_at TEXT,
      last_activated_at TEXT,
      PRIMARY KEY (site_id, environment)
    );

    CREATE TABLE IF NOT EXISTS published_versions (
      site_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      version TEXT NOT NULL,
      config_json TEXT NOT NULL,
      last_published_at TEXT,
      last_activated_at TEXT,
      PRIMARY KEY (site_id, environment, version)
    );

    CREATE TABLE IF NOT EXISTS changelog (
      site_id TEXT NOT NULL,
      version TEXT NOT NULL,
      published_at TEXT NOT NULL,
      change_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (site_id, version)
    );

    CREATE TABLE IF NOT EXISTS audit (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      cid TEXT,
      type TEXT,
      action TEXT,
      source TEXT,
      config_version TEXT,
      categories_json TEXT,
      record_json TEXT NOT NULL,
      ts TEXT NOT NULL,
      ua TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_consent_site_ts ON consent_records (site_id, ts);
    CREATE INDEX IF NOT EXISTS idx_consent_site_cid ON consent_records (site_id, cid);
  `);

  return sqliteDb;
}

function jsonText(value) {
  return JSON.stringify(value ?? null);
}

function parseJsonText(value, fallback = null) {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function sqliteGetMeta(key) {
  return getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value || null;
}

function sqliteSetMeta(key, value) {
  getDb().prepare(`
    INSERT INTO meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

function sqliteUpsertSiteConfig(config) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO sites (site_id, site_name, environment, draft_json, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id) DO UPDATE SET
      site_name = excluded.site_name,
      environment = excluded.environment,
      draft_json = excluded.draft_json,
      updated_at = excluded.updated_at
  `).run(
    config.siteId,
    config.siteName,
    config.environment || "production",
    jsonText(config),
    config.updatedAt || now,
    now
  );
}

function sqliteWritePublishedConfig(config) {
  getDb().prepare(`
    INSERT INTO published_configs (site_id, environment, version, config_json, last_published_at, last_activated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, environment) DO UPDATE SET
      version = excluded.version,
      config_json = excluded.config_json,
      last_published_at = excluded.last_published_at,
      last_activated_at = excluded.last_activated_at
  `).run(
    config.siteId,
    config.environment || "production",
    config.version || "draft",
    jsonText(config),
    config.lastPublishedAt || null,
    config.lastActivatedAt || config.lastPublishedAt || null
  );
}

function sqliteWritePublishedVersion(config) {
  getDb().prepare(`
    INSERT INTO published_versions (site_id, environment, version, config_json, last_published_at, last_activated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, environment, version) DO UPDATE SET
      config_json = excluded.config_json,
      last_published_at = excluded.last_published_at,
      last_activated_at = excluded.last_activated_at
  `).run(
    config.siteId,
    config.environment || "production",
    config.version || "draft",
    jsonText(config),
    config.lastPublishedAt || null,
    config.lastActivatedAt || config.lastPublishedAt || null
  );
}

function sqliteAppendChangelog(siteId, entry) {
  getDb().prepare(`
    INSERT INTO changelog (site_id, version, published_at, change_count, summary)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(site_id, version) DO UPDATE SET
      published_at = excluded.published_at,
      change_count = excluded.change_count,
      summary = excluded.summary
  `).run(siteId, entry.version, entry.publishedAt, entry.changeCount || 0, entry.summary || "");
}

function sqliteAppendConsentRecord(siteId, record) {
  getDb().prepare(`
    INSERT INTO consent_records
      (site_id, cid, type, action, source, config_version, categories_json, record_json, ts, ua)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    siteId,
    record.cid || null,
    record.type || (record.categories ? "decision" : "unknown"),
    record.action || null,
    record.source || null,
    record.configVersion || null,
    record.categories ? jsonText(record.categories) : null,
    jsonText(record),
    record.ts || new Date().toISOString(),
    record.ua || null
  );
}

function safeSegment(value) {
  const segment = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error("Invalid path segment");
  }
  return segment;
}

function normalizeConfig(input, options = {}) {
  const touch = options.touch !== false;
  const config = structuredClone(input || {});
  config.siteId = safeSegment(config.siteId || DEFAULT_SITE_ID);
  config.siteName = String(config.siteName || "Untitled Site").slice(0, 120);
  config.environment = "production";
  config.schemaVersion = 1;
  config.updatedAt = touch ? new Date().toISOString() : (config.updatedAt || new Date().toISOString());

  if (!config.banner) config.banner = structuredClone(DEFAULT_CONFIG.banner);
  if (!config.googleConsentMode) {
    config.googleConsentMode = structuredClone(DEFAULT_CONFIG.googleConsentMode);
  } else {
    // Ensure all sub-fields exist even if googleConsentMode was already there
    if (!config.googleConsentMode.defaultState) {
      config.googleConsentMode.defaultState = structuredClone(DEFAULT_CONFIG.googleConsentMode.defaultState);
    }
    if (!config.googleConsentMode.categoryMap) {
      config.googleConsentMode.categoryMap = structuredClone(DEFAULT_CONFIG.googleConsentMode.categoryMap);
    }
    if (!Array.isArray(config.googleConsentMode.regionalOverrides)) {
      config.googleConsentMode.regionalOverrides = [];
    }
    config.googleConsentMode.enabled = config.googleConsentMode.enabled ?? DEFAULT_CONFIG.googleConsentMode.enabled;
    config.googleConsentMode.mode = config.googleConsentMode.mode ?? DEFAULT_CONFIG.googleConsentMode.mode;
    config.googleConsentMode.waitForUpdateMs = config.googleConsentMode.waitForUpdateMs ?? DEFAULT_CONFIG.googleConsentMode.waitForUpdateMs;
    config.googleConsentMode.recordConsent = config.googleConsentMode.recordConsent ?? DEFAULT_CONFIG.googleConsentMode.recordConsent;
  }

  config.googleConsentMode.regionalOverrides = config.googleConsentMode.regionalOverrides.map(override => ({
    region: Array.isArray(override.region) ? override.region.map(r => String(r).toUpperCase().trim()).filter(Boolean) : [],
    displayName: String(override.displayName || "Custom Region").slice(0, 80),
    state: {
      ...DEFAULT_CONFIG.googleConsentMode.defaultState,
      ...(override.state || {})
    }
  }));

  if (!config.dataLayer) config.dataLayer = structuredClone(DEFAULT_CONFIG.dataLayer);
  if (!config.gpc) config.gpc = structuredClone(DEFAULT_CONFIG.gpc);
  if (!config.cookieCleanup) config.cookieCleanup = structuredClone(DEFAULT_CONFIG.cookieCleanup);
  if (!Array.isArray(config.categories)) config.categories = structuredClone(DEFAULT_CONFIG.categories);
  if (!Array.isArray(config.services)) config.services = [];

  config.categories = config.categories.map((category) => ({
    id: safeSegment(category.id),
    label: String(category.label || category.id).slice(0, 80),
    description: String(category.description || "").slice(0, 240),
    required: Boolean(category.required),
    default: Boolean(category.required || category.default)
  }));

  const categoryIds = new Set(config.categories.map((category) => category.id));
  config.services = config.services.map((service) => ({
    id: safeSegment(service.id || service.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
    name: String(service.name || "Unnamed service").slice(0, 120),
    category: categoryIds.has(service.category) ? service.category : "analytics",
    enabled: Boolean(service.enabled),
    cookies: Array.isArray(service.cookies)
      ? service.cookies.map((cookie) => String(cookie).trim()).filter(Boolean).slice(0, 50)
      : [],
    notes: String(service.notes || "").slice(0, 500)
  }));

  return config;
}

export async function ensureInitialData() {
  if (USE_SQLITE) {
    await ensureSqliteInitialData();
    return;
  }

  await ensureDataDir();
  const legacy = await readJson(CONFIG_FILE, null);
  const seed = normalizeConfig(legacy || DEFAULT_CONFIG, { touch: !legacy });
  const draftPath = siteDraftPath(seed.siteId);
  const draft = await readJson(draftPath, null);

  if (!legacy) {
    await writeJson(CONFIG_FILE, seed);
  }

  if (!draft) {
    await writeJson(draftPath, seed);
  }

  await upsertSiteIndex(draft || seed);
}

export async function listSites() {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteListSites();
  }

  await ensureInitialData();
  const index = await readJson(SITES_INDEX_FILE, { sites: [] });
  const sites = [];

  for (const entry of index.sites || []) {
    const siteId = safeSegment(entry.siteId);
    const draft = await readJson(siteDraftPath(siteId), null);
    if (!draft) continue;
    const config = normalizeConfig(draft, { touch: false });
    const current = await readJson(currentPublishedPath(siteId, config.environment || "production"), null);
    sites.push(siteSummary(config, current));
  }

  sites.sort((a, b) => a.siteName.localeCompare(b.siteName));
  return sites;
}

export async function createSite(input = {}) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteCreateSite(input);
  }

  await ensureInitialData();
  const siteId = safeSegment(input.siteId);
  const existing = await readJson(siteDraftPath(siteId), null);
  if (existing) {
    throw new Error("Site ID already exists");
  }

  const cloneSource = input.cloneFrom ? await getConfig(input.cloneFrom) : null;
  const base = cloneSource || DEFAULT_CONFIG;
  const now = new Date().toISOString();
  const config = normalizeConfig({
    ...structuredClone(base),
    siteId,
    siteName: String(input.siteName || siteId).slice(0, 120),
    version: "draft",
    lastPublishedAt: null,
    lastActivatedAt: null,
    restoredAt: null,
    restoredFromVersion: null,
    updatedAt: now
  });

  await writeJson(siteDraftPath(siteId), config);
  await upsertSiteIndex(config);
  await appendAudit("site.created", {
    siteId,
    clonedFrom: input.cloneFrom || null
  });

  return config;
}

export async function getConfig(siteId = DEFAULT_SITE_ID) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetConfig(siteId);
  }

  await ensureInitialData();
  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const config = await readJson(siteDraftPath(safeSiteId), null);
  if (config) return normalizeConfig(config, { touch: false });

  if (safeSiteId === DEFAULT_SITE_ID) {
    const legacy = await readJson(CONFIG_FILE, null);
    if (legacy) return normalizeConfig(legacy, { touch: false });
  }

  return null;
}

export async function saveConfig(input, siteId = null) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteSaveConfig(input, siteId);
  }

  const config = normalizeConfig({
    ...(input || {}),
    siteId: siteId || input?.siteId || DEFAULT_SITE_ID
  });

  await writeJson(siteDraftPath(config.siteId), config);
  if (config.siteId === DEFAULT_SITE_ID) {
    await writeJson(CONFIG_FILE, config);
  }
  await upsertSiteIndex(config);
  await appendAudit("config.saved", {
    siteId: config.siteId,
    version: config.version
  });
  return config;
}

export async function appendConsentRecord(siteId, record) {
  if (USE_SQLITE) {
    await ensureInitialData();
    const safeId = safeSegment(siteId);
    sqliteAppendConsentRecord(safeId, {
      ts: new Date().toISOString(),
      ...record
    });
    return;
  }

  const safeId = safeSegment(siteId);
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const dir = path.join(DATA_DIR, "records", safeId);
  await fs.mkdir(dir, { recursive: true });
  
  const logPath = path.join(dir, `${month}.log`);
  const entry = JSON.stringify({
    ts: now.toISOString(),
    ...record
  }) + "\n";
  
  await fs.appendFile(logPath, entry);
}

export async function getConsentHistory(siteId, cid) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetConsentHistory(siteId, cid);
  }

  const safeId = safeSegment(siteId);
  const safeCid = String(cid || "").trim();
  if (!safeCid) return [];

  const dir = path.join(DATA_DIR, "records", safeId);
  const history = [];

  try {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith(".log")).sort().reverse();
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line);
          if (record.cid === safeCid) {
            history.push(record);
          }
        } catch (_) {
          // Skip broken lines
        }
      }
      if (history.length >= 100) break;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return history.sort((a, b) => new Date(b.ts || b.createdAt).getTime() - new Date(a.ts || a.createdAt).getTime());
}

export async function getConsentReport(siteId, options = {}) {
  await ensureInitialData();
  const safeId = safeSegment(siteId);
  const range = resolveReportRange(options);
  const records = await readConsentRecords(safeId, range.from);

  const impressions = new Map();
  const decisions = new Map();
  const uncategorizedDecisions = [];
  const daily = new Map();

  for (const record of records) {
    const ts = new Date(record.ts || record.createdAt || 0);
    if (Number.isNaN(ts.getTime()) || ts < range.from || ts > range.to) continue;

    const cid = String(record.cid || "").trim();
    const type = record.type || (record.categories ? "decision" : "unknown");

    if (type === "banner_shown") {
      if (cid && !impressions.has(cid)) impressions.set(cid, record);
      continue;
    }

    if (type === "decision") {
      if (cid) {
        const existing = decisions.get(cid);
        if (!existing || new Date(existing.ts || existing.createdAt || 0) <= ts) {
          decisions.set(cid, record);
        }
      } else {
        uncategorizedDecisions.push(record);
      }
    }
  }

  const actionCounts = {
    accept: 0,
    reject: 0,
    partial: 0,
    other: 0
  };
  let matchedDecisions = 0;

  for (const decision of decisions.values()) {
    const action = classifyDecision(decision);
    if (actionCounts[action] === undefined) actionCounts.other += 1;
    else actionCounts[action] += 1;
    if (impressions.has(String(decision.cid || "").trim())) matchedDecisions += 1;
    addDailyDecision(daily, decision, action);
  }

  for (const decision of uncategorizedDecisions) {
    const action = classifyDecision(decision);
    if (actionCounts[action] === undefined) actionCounts.other += 1;
    else actionCounts[action] += 1;
    addDailyDecision(daily, decision, action);
  }

  let ignored = 0;
  for (const impression of impressions.values()) {
    const bucket = dailyBucket(daily, new Date(impression.ts || impression.createdAt));
    bucket.impressions += 1;
  }

  for (const [cid, impression] of impressions) {
    if (decisions.has(cid)) continue;
    ignored += 1;
    dailyBucket(daily, new Date(impression.ts || impression.createdAt)).ignores += 1;
  }

  const uniqueImpressions = impressions.size;
  const uniqueDecisions = decisions.size + uncategorizedDecisions.length;
  const totalOutcomes = actionCounts.accept + actionCounts.reject + actionCounts.partial + actionCounts.other + ignored;
  return {
    siteId: safeId,
    period: range.label,
    days: range.days,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    since: range.from.toISOString(),
    generatedAt: new Date().toISOString(),
    totals: {
      impressions: uniqueImpressions,
      decisions: uniqueDecisions,
      matchedDecisions,
      outcomes: totalOutcomes,
      accepts: actionCounts.accept,
      rejects: actionCounts.reject,
      partials: actionCounts.partial,
      others: actionCounts.other,
      ignores: ignored,
      legacyDecisions: uncategorizedDecisions.length
    },
    rates: {
      accept: rate(actionCounts.accept, totalOutcomes),
      reject: rate(actionCounts.reject, totalOutcomes),
      partial: rate(actionCounts.partial, totalOutcomes),
      ignore: rate(ignored, totalOutcomes),
      response: rate(matchedDecisions, uniqueImpressions),
      decision: rate(uniqueDecisions, totalOutcomes)
    },
    daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}

export async function publishConfig(input) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqlitePublishConfig(input);
  }

  const config = normalizeConfig(input);
  delete config.restoredAt;
  delete config.restoredFromVersion;
  const publishedAt = new Date();
  const version = publishedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const published = {
    ...config,
    version,
    lastPublishedAt: publishedAt.toISOString(),
    lastActivatedAt: publishedAt.toISOString()
  };

  const siteId = safeSegment(published.siteId);
  const environment = safeSegment(published.environment || "production");
  const publishedPath = currentPublishedPath(siteId, environment);
  const versionPath = publishedVersionPath(siteId, environment, version);
  const changelogPath = path.join(DATA_DIR, "published", siteId, "changelog.json");

  // Generate changelog entry
  const previous = await readJson(publishedPath, null);
  const changes = diffConfigs(previous, published);
  const changelog = await readJson(changelogPath, []);
  
  if (changes.length > 0) {
    changelog.unshift({
      version,
      publishedAt: publishedAt.toISOString(),
      changeCount: changes.length,
      summary: changes.slice(0, 5).map(c => c.path).join(", ") + (changes.length > 5 ? "..." : "")
    });
  }

  await writeJson(versionPath, published);
  await writeJson(publishedPath, published);
  await writeJson(changelogPath, changelog.slice(0, 50));
  await writeJson(siteDraftPath(siteId), published);
  if (siteId === DEFAULT_SITE_ID) {
    await writeJson(CONFIG_FILE, published);
  }
  await upsertSiteIndex(published);
  await appendAudit("config.published", {
    siteId,
    environment,
    version
  });

  return published;
}

export async function getPublishedConfig(siteId, environment = "production") {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetPublishedConfig(siteId, environment);
  }

  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const publishedPath = currentPublishedPath(safeSiteId, safeEnvironment);
  try {
    const raw = await fs.readFile(publishedPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

export async function listPublishedVersions(siteId, environment = "production") {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteListPublishedVersions(siteId, environment);
  }

  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const dir = publishedVersionsDir(safeSiteId, safeEnvironment);
  const versions = [];

  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf8");
        const config = JSON.parse(raw);
        versions.push(versionSummary(config));
      } catch (e) {
        console.warn(`[Storage] Skipping corrupted version file: ${file}`);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const current = await getPublishedConfig(safeSiteId, safeEnvironment);
  if (current?.lastPublishedAt && current?.version && !versions.some((item) => item.version === current.version)) {
    versions.push(versionSummary(current));
  }

  versions.sort((a, b) => String(b.lastPublishedAt || b.version).localeCompare(String(a.lastPublishedAt || a.version)));

  return versions.map((item) => ({
    ...item,
    active: current?.version === item.version
  }));
}

export async function getPublishedVersion(siteId, environment = "production", version) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetPublishedVersion(siteId, environment, version);
  }

  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const safeVersion = safeSegment(version);
  const config = await readJson(publishedVersionPath(safeSiteId, safeEnvironment, safeVersion), null);
  if (config) return config;

  const current = await getPublishedConfig(safeSiteId, safeEnvironment);
  if (current?.version === safeVersion) return current;
  return null;
}

export async function rollbackToVersion(siteId, environment = "production", version) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteRollbackToVersion(siteId, environment, version);
  }

  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const target = await getPublishedVersion(safeSiteId, safeEnvironment, version);
  if (!target) return null;

  const activatedAt = new Date().toISOString();
  const restored = {
    ...target,
    lastActivatedAt: activatedAt,
    restoredFromVersion: target.version,
    restoredAt: activatedAt
  };

  await writeJson(currentPublishedPath(safeSiteId, safeEnvironment), restored);
  await writeJson(siteDraftPath(safeSiteId), restored);
  if (safeSiteId === DEFAULT_SITE_ID) {
    await writeJson(CONFIG_FILE, restored);
  }
  await upsertSiteIndex(restored);
  await appendAudit("config.rolled_back", {
    siteId: safeSiteId,
    environment: safeEnvironment,
    version: target.version
  });

  return restored;
}

export async function appendAudit(type, details = {}) {
  if (USE_SQLITE) {
    await ensureDataDir();
    sqliteAppendAudit(type, details);
    return;
  }

  await ensureDataDir();
  const audit = await readJson(AUDIT_FILE, []);
  audit.unshift({
    id: cryptoRandomId(),
    type,
    details,
    createdAt: new Date().toISOString()
  });
  await writeJson(AUDIT_FILE, audit.slice(0, 200));
}

export async function getAuditLog() {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetAuditLog();
  }

  await ensureDataDir();
  return readJson(AUDIT_FILE, []);
}

export async function getPublicChangelog(siteId) {
  if (USE_SQLITE) {
    await ensureInitialData();
    return sqliteGetPublicChangelog(siteId);
  }

  const safeId = safeSegment(siteId);
  return readJson(path.join(DATA_DIR, "published", safeId, "changelog.json"), []);
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function currentPublishedPath(siteId, environment) {
  return path.join(DATA_DIR, "published", safeSegment(siteId), `${safeSegment(environment)}.json`);
}

function siteDraftPath(siteId) {
  return path.join(SITES_DIR, safeSegment(siteId), "config.json");
}

function publishedVersionsDir(siteId, environment) {
  return path.join(DATA_DIR, "published", safeSegment(siteId), "versions", safeSegment(environment));
}

function publishedVersionPath(siteId, environment, version) {
  return path.join(publishedVersionsDir(siteId, environment), `${safeSegment(version)}.json`);
}

function diffConfigs(before, after) {
  if (!before || !after) return [];

  const beforeFlat = flattenForDiff(stripVolatile(before));
  const afterFlat = flattenForDiff(stripVolatile(after));
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();

  return keys
    .filter((key) => beforeFlat[key] !== afterFlat[key])
    .map((key) => ({
      path: key,
      before: beforeFlat[key] ?? "",
      after: afterFlat[key] ?? ""
    }));
}

function stripVolatile(config) {
  const copy = JSON.parse(JSON.stringify(config));
  delete copy.version;
  delete copy.updatedAt;
  delete copy.lastPublishedAt;
  delete copy.lastActivatedAt;
  delete copy.restoredAt;
  delete copy.restoredFromVersion;
  return copy;
}

function flattenForDiff(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    output[prefix || "root"] = JSON.stringify(value);
    return output;
  }

  if (value && typeof value === "object") {
    Object.keys(value).sort().forEach((key) => {
      flattenForDiff(value[key], prefix ? `${prefix}.${key}` : key, output);
    });
    return output;
  }

  output[prefix || "root"] = String(value);
  return output;
}

function versionSummary(config) {
  return {
    siteId: config.siteId,
    siteName: config.siteName,
    environment: config.environment || "production",
    version: config.version,
    lastPublishedAt: config.lastPublishedAt || null,
    lastActivatedAt: config.lastActivatedAt || config.lastPublishedAt || null,
    categoryCount: Array.isArray(config.categories) ? config.categories.length : 0,
    serviceCount: Array.isArray(config.services) ? config.services.length : 0
  };
}

async function ensureSqliteInitialData() {
  await ensureDataDir();
  getDb();

  if (sqliteGetMeta("json_imported_v1") !== "1") {
    await migrateJsonFilesToSqlite();
    sqliteSetMeta("json_imported_v1", "1");
  }

  const count = getDb().prepare("SELECT COUNT(*) AS count FROM sites").get().count;
  if (!count) {
    const config = normalizeConfig(DEFAULT_CONFIG);
    sqliteUpsertSiteConfig(config);
    sqliteAppendAudit("storage.seeded", {
      siteId: config.siteId,
      driver: "sqlite"
    });
  }
}

async function migrateJsonFilesToSqlite() {
  const legacy = await readJson(CONFIG_FILE, null);
  if (legacy) sqliteUpsertSiteConfig(normalizeConfig(legacy, { touch: false }));

  await migrateSiteDraftFiles();
  await migratePublishedFiles();
  await migrateAuditFile();
  await migrateConsentRecordFiles();
}

async function migrateSiteDraftFiles() {
  try {
    const entries = await fs.readdir(SITES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const config = await readJson(path.join(SITES_DIR, entry.name, "config.json"), null);
      if (config) sqliteUpsertSiteConfig(normalizeConfig(config, { touch: false }));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function migratePublishedFiles() {
  const publishedRoot = path.join(DATA_DIR, "published");
  try {
    const siteDirs = await fs.readdir(publishedRoot, { withFileTypes: true });
    for (const siteDir of siteDirs) {
      if (!siteDir.isDirectory()) continue;
      const siteId = safeSegment(siteDir.name);
      const sitePath = path.join(publishedRoot, siteId);
      const files = await fs.readdir(sitePath, { withFileTypes: true });

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json") || file.name === "changelog.json") continue;
        const config = await readJson(path.join(sitePath, file.name), null);
        if (!config) continue;
        const normalized = normalizeConfig(config, { touch: false });
        sqliteWritePublishedConfig(normalized);
        if (normalized.version) sqliteWritePublishedVersion(normalized);
      }

      const changelog = await readJson(path.join(sitePath, "changelog.json"), []);
      for (const entry of changelog || []) {
        if (entry?.version && entry?.publishedAt) sqliteAppendChangelog(siteId, entry);
      }

      const versionsRoot = path.join(sitePath, "versions");
      await migratePublishedVersionDirs(siteId, versionsRoot);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function migratePublishedVersionDirs(siteId, versionsRoot) {
  try {
    const environmentDirs = await fs.readdir(versionsRoot, { withFileTypes: true });
    for (const environmentDir of environmentDirs) {
      if (!environmentDir.isDirectory()) continue;
      const versionDir = path.join(versionsRoot, environmentDir.name);
      const files = await fs.readdir(versionDir, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".json")) continue;
        const config = await readJson(path.join(versionDir, file.name), null);
        if (!config) continue;
        sqliteWritePublishedVersion(normalizeConfig({
          ...config,
          siteId,
          environment: environmentDir.name
        }, { touch: false }));
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function migrateAuditFile() {
  const audit = await readJson(AUDIT_FILE, []);
  for (const entry of audit || []) {
    sqliteInsertAuditEntry(entry);
  }
}

async function migrateConsentRecordFiles() {
  const recordsRoot = path.join(DATA_DIR, "records");
  try {
    const siteDirs = await fs.readdir(recordsRoot, { withFileTypes: true });
    for (const siteDir of siteDirs) {
      if (!siteDir.isDirectory()) continue;
      const siteId = safeSegment(siteDir.name);
      const files = await fs.readdir(path.join(recordsRoot, siteId), { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".log")) continue;
        const content = await fs.readFile(path.join(recordsRoot, siteId, file.name), "utf8");
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            sqliteAppendConsentRecord(siteId, JSON.parse(line));
          } catch (_) {
            // Skip malformed historical record lines.
          }
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function sqliteReadSiteConfig(siteId) {
  const row = getDb().prepare("SELECT draft_json FROM sites WHERE site_id = ?").get(safeSegment(siteId || DEFAULT_SITE_ID));
  return row ? normalizeConfig(parseJsonText(row.draft_json), { touch: false }) : null;
}

function sqliteReadPublishedConfig(siteId, environment = "production") {
  const row = getDb().prepare(`
    SELECT config_json FROM published_configs WHERE site_id = ? AND environment = ?
  `).get(safeSegment(siteId || DEFAULT_SITE_ID), safeSegment(environment || "production"));
  return row ? parseJsonText(row.config_json) : null;
}

function sqliteListSites() {
  const rows = getDb().prepare("SELECT site_id, draft_json FROM sites ORDER BY site_name COLLATE NOCASE").all();
  return rows.map((row) => {
    const config = normalizeConfig(parseJsonText(row.draft_json), { touch: false });
    const published = sqliteReadPublishedConfig(config.siteId, config.environment || "production");
    return siteSummary(config, published);
  });
}

function sqliteCreateSite(input = {}) {
  const siteId = safeSegment(input.siteId);
  if (sqliteReadSiteConfig(siteId)) throw new Error("Site ID already exists");

  const cloneSource = input.cloneFrom ? sqliteReadSiteConfig(input.cloneFrom) : null;
  const base = cloneSource || DEFAULT_CONFIG;
  const config = normalizeConfig({
    ...structuredClone(base),
    siteId,
    siteName: String(input.siteName || siteId).slice(0, 120),
    version: "draft",
    lastPublishedAt: null,
    lastActivatedAt: null,
    restoredAt: null,
    restoredFromVersion: null,
    updatedAt: new Date().toISOString()
  });

  sqliteUpsertSiteConfig(config);
  sqliteAppendAudit("site.created", {
    siteId,
    clonedFrom: input.cloneFrom || null
  });
  return config;
}

function sqliteGetConfig(siteId = DEFAULT_SITE_ID) {
  return sqliteReadSiteConfig(siteId);
}

function sqliteSaveConfig(input, siteId = null) {
  const config = normalizeConfig({
    ...(input || {}),
    siteId: siteId || input?.siteId || DEFAULT_SITE_ID
  });
  sqliteUpsertSiteConfig(config);
  sqliteAppendAudit("config.saved", {
    siteId: config.siteId,
    version: config.version
  });
  return config;
}

function sqlitePublishConfig(input) {
  const config = normalizeConfig(input);
  delete config.restoredAt;
  delete config.restoredFromVersion;
  const publishedAt = new Date();
  const version = publishedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const published = {
    ...config,
    version,
    lastPublishedAt: publishedAt.toISOString(),
    lastActivatedAt: publishedAt.toISOString()
  };

  const previous = sqliteReadPublishedConfig(published.siteId, published.environment || "production");
  const changes = diffConfigs(previous, published);
  if (changes.length > 0) {
    sqliteAppendChangelog(published.siteId, {
      version,
      publishedAt: publishedAt.toISOString(),
      changeCount: changes.length,
      summary: changes.slice(0, 5).map((change) => change.path).join(", ") + (changes.length > 5 ? "..." : "")
    });
  }

  sqliteWritePublishedVersion(published);
  sqliteWritePublishedConfig(published);
  sqliteUpsertSiteConfig(published);
  sqliteAppendAudit("config.published", {
    siteId: published.siteId,
    environment: published.environment || "production",
    version
  });

  return published;
}

function sqliteGetPublishedConfig(siteId, environment = "production") {
  return sqliteReadPublishedConfig(siteId, environment);
}

function sqliteListPublishedVersions(siteId, environment = "production") {
  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const rows = getDb().prepare(`
    SELECT config_json FROM published_versions
    WHERE site_id = ? AND environment = ?
    ORDER BY COALESCE(last_published_at, version) DESC
  `).all(safeSiteId, safeEnvironment);
  const versions = rows.map((row) => versionSummary(parseJsonText(row.config_json)));
  const current = sqliteReadPublishedConfig(safeSiteId, safeEnvironment);

  if (current?.lastPublishedAt && current?.version && !versions.some((item) => item.version === current.version)) {
    versions.push(versionSummary(current));
  }

  versions.sort((a, b) => String(b.lastPublishedAt || b.version).localeCompare(String(a.lastPublishedAt || a.version)));
  return versions.map((item) => ({
    ...item,
    active: current?.version === item.version
  }));
}

function sqliteGetPublishedVersion(siteId, environment = "production", version) {
  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const safeVersion = safeSegment(version);
  const row = getDb().prepare(`
    SELECT config_json FROM published_versions
    WHERE site_id = ? AND environment = ? AND version = ?
  `).get(safeSiteId, safeEnvironment, safeVersion);
  if (row) return parseJsonText(row.config_json);

  const current = sqliteReadPublishedConfig(safeSiteId, safeEnvironment);
  return current?.version === safeVersion ? current : null;
}

function sqliteRollbackToVersion(siteId, environment = "production", version) {
  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const target = sqliteGetPublishedVersion(safeSiteId, safeEnvironment, version);
  if (!target) return null;

  const activatedAt = new Date().toISOString();
  const restored = {
    ...target,
    lastActivatedAt: activatedAt,
    restoredFromVersion: target.version,
    restoredAt: activatedAt
  };

  sqliteWritePublishedConfig(restored);
  sqliteUpsertSiteConfig(restored);
  sqliteAppendAudit("config.rolled_back", {
    siteId: safeSiteId,
    environment: safeEnvironment,
    version: target.version
  });

  return restored;
}

function sqliteGetConsentHistory(siteId, cid) {
  const safeId = safeSegment(siteId);
  const safeCid = String(cid || "").trim();
  if (!safeCid) return [];

  const rows = getDb().prepare(`
    SELECT record_json FROM consent_records
    WHERE site_id = ? AND cid = ?
    ORDER BY ts DESC
    LIMIT 100
  `).all(safeId, safeCid);

  return rows.map((row) => parseJsonText(row.record_json)).filter(Boolean);
}

function sqliteReadConsentRecords(siteId, since) {
  const rows = getDb().prepare(`
    SELECT record_json FROM consent_records
    WHERE site_id = ? AND ts >= ?
    ORDER BY ts ASC
  `).all(safeSegment(siteId), since.toISOString());
  return rows.map((row) => parseJsonText(row.record_json)).filter(Boolean);
}

function sqliteInsertAuditEntry(entry) {
  if (!entry?.id || !entry?.type || !entry?.createdAt) return;
  getDb().prepare(`
    INSERT INTO audit (id, type, details_json, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(entry.id, entry.type, jsonText(entry.details || {}), entry.createdAt);
}

function sqliteAppendAudit(type, details = {}) {
  sqliteInsertAuditEntry({
    id: cryptoRandomId(),
    type,
    details,
    createdAt: new Date().toISOString()
  });
}

function sqliteGetAuditLog() {
  const rows = getDb().prepare(`
    SELECT id, type, details_json, created_at
    FROM audit
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    details: parseJsonText(row.details_json, {}),
    createdAt: row.created_at
  }));
}

function sqliteGetPublicChangelog(siteId) {
  const rows = getDb().prepare(`
    SELECT version, published_at, change_count, summary
    FROM changelog
    WHERE site_id = ?
    ORDER BY published_at DESC
    LIMIT 50
  `).all(safeSegment(siteId));

  return rows.map((row) => ({
    version: row.version,
    publishedAt: row.published_at,
    changeCount: row.change_count,
    summary: row.summary
  }));
}

async function readConsentRecords(siteId, since) {
  if (USE_SQLITE) return sqliteReadConsentRecords(siteId, since);

  const dir = path.join(DATA_DIR, "records", safeSegment(siteId));
  const records = [];

  try {
    const files = (await fs.readdir(dir))
      .filter((file) => file.endsWith(".log"))
      .filter((file) => monthMayOverlap(file.slice(0, 7), since))
      .sort();

    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), "utf8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          records.push(JSON.parse(line));
        } catch (_) {
          // Ignore malformed record lines.
        }
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return records;
}

function monthMayOverlap(month, since) {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const [year, monthIndex] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, monthIndex, 0, 23, 59, 59, 999));
  return monthEnd >= since;
}

function classifyDecision(record) {
  if (record.action === "accept_all") return "accept";
  if (record.action === "reject_all") return "reject";
  if (record.action === "save_choices") return classifyCategories(record.categories);
  return classifyCategories(record.categories);
}

function classifyCategories(categories = {}) {
  const optional = Object.entries(categories)
    .filter(([key]) => key !== "necessary")
    .map(([, value]) => Boolean(value));

  if (!optional.length) return "other";
  if (optional.every(Boolean)) return "accept";
  if (optional.every((value) => !value)) return "reject";
  return "partial";
}

function addDailyDecision(daily, record, action) {
  const bucket = dailyBucket(daily, new Date(record.ts || record.createdAt));
  bucket.decisions += 1;
  if (action === "accept") bucket.accepts += 1;
  else if (action === "reject") bucket.rejects += 1;
  else if (action === "partial") bucket.partials += 1;
  else bucket.others += 1;
}

function dailyBucket(daily, date) {
  const day = date.toISOString().slice(0, 10);
  if (!daily.has(day)) {
    daily.set(day, {
      date: day,
      impressions: 0,
      accepts: 0,
      rejects: 0,
      partials: 0,
      others: 0,
      decisions: 0,
      ignores: 0
    });
  }
  return daily.get(day);
}

function resolveReportRange(options = {}) {
  const now = new Date();
  const customFrom = parseReportDate(options.from, false);
  const customTo = parseReportDate(options.to, true);

  if (customFrom || customTo) {
    const to = customTo || endOfUtcDay(now);
    const from = customFrom || new Date(to.getTime() - 30 * 86400000);
    if (from > to) {
      return {
        label: "custom",
        days: 1,
        from: startOfUtcDay(to),
        to
      };
    }
    return {
      label: "custom",
      days: Math.max(1, Math.ceil((to - from + 1) / 86400000)),
      from,
      to
    };
  }

  const days = Math.max(1, Math.min(365, Number(options.days || 30)));
  return {
    label: `last_${days}_days`,
    days,
    from: new Date(now.getTime() - days * 86400000),
    to: now
  };
}

function parseReportDate(value, endOfDay) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return endOfDay ? endOfUtcDay(date) : startOfUtcDay(date);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function rate(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function siteSummary(config, published = null) {
  return {
    siteId: config.siteId,
    siteName: config.siteName,
    environment: config.environment || "production",
    draftVersion: config.version || "draft",
    activeVersion: published?.version || null,
    updatedAt: config.updatedAt || null,
    lastPublishedAt: published?.lastPublishedAt || config.lastPublishedAt || null,
    hasPublished: Boolean(published),
    categoryCount: Array.isArray(config.categories) ? config.categories.length : 0,
    serviceCount: Array.isArray(config.services) ? config.services.length : 0
  };
}

async function upsertSiteIndex(config) {
  const index = await readJson(SITES_INDEX_FILE, { sites: [] });
  const sites = Array.isArray(index.sites) ? index.sites : [];
  const published = await readJson(currentPublishedPath(config.siteId, config.environment || "production"), null);
  const summary = siteSummary(config, published);
  const existingIndex = sites.findIndex((site) => site.siteId === summary.siteId);

  if (existingIndex === -1) {
    sites.push(summary);
  } else {
    sites[existingIndex] = {
      ...sites[existingIndex],
      ...summary
    };
  }

  await writeJson(SITES_INDEX_FILE, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    sites: sites.sort((a, b) => a.siteName.localeCompare(b.siteName))
  });
}
