import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.local.json");

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

function safeSegment(value) {
  const segment = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error("Invalid path segment");
  }
  return segment;
}

function normalizeConfig(input) {
  const config = structuredClone(input || {});
  config.siteId = safeSegment(config.siteId || DEFAULT_SITE_ID);
  config.siteName = String(config.siteName || "Untitled Site").slice(0, 120);
  config.environment = "production";
  config.schemaVersion = 1;
  config.updatedAt = new Date().toISOString();

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
  await ensureDataDir();
  const existing = await readJson(CONFIG_FILE, null);
  if (!existing) {
    await writeJson(CONFIG_FILE, DEFAULT_CONFIG);
  }
}

export async function getConfig() {
  await ensureInitialData();
  const config = await readJson(CONFIG_FILE, DEFAULT_CONFIG);
  return normalizeConfig(config);
}

export async function saveConfig(input) {
  const config = normalizeConfig(input);
  await writeJson(CONFIG_FILE, config);
  await appendAudit("config.saved", {
    siteId: config.siteId,
    version: config.version
  });
  return config;
}

export async function appendConsentRecord(siteId, record) {
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

export async function publishConfig(input) {
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
  await writeJson(CONFIG_FILE, published);
  await appendAudit("config.published", {
    siteId,
    environment,
    version
  });

  return published;
}

export async function getPublishedConfig(siteId, environment = "production") {
  const safeSiteId = safeSegment(siteId || DEFAULT_SITE_ID);
  const safeEnvironment = safeSegment(environment || "production");
  const publishedPath = currentPublishedPath(safeSiteId, safeEnvironment);
  try {
    const raw = await fs.readFile(publishedPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const fallback = await getConfig();
    return fallback.siteId === safeSiteId ? fallback : null;
  }
}

export async function listPublishedVersions(siteId, environment = "production") {
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
  await writeJson(CONFIG_FILE, restored);
  await appendAudit("config.rolled_back", {
    siteId: safeSiteId,
    environment: safeEnvironment,
    version: target.version
  });

  return restored;
}

export async function appendAudit(type, details = {}) {
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
  await ensureDataDir();
  return readJson(AUDIT_FILE, []);
}

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function currentPublishedPath(siteId, environment) {
  return path.join(DATA_DIR, "published", safeSegment(siteId), `${safeSegment(environment)}.json`);
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
