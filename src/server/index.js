import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  authMode,
  checkLoginRateLimit,
  clearSessionCookie,
  clearLoginFailures,
  createSession,
  destroySession,
  getSession,
  isSecureRequest,
  loginRateLimitKey,
  recordLoginFailure,
  sessionCookie,
  usingDefaultCredentials,
  verifyCredentials,
  verifyCsrfToken
} from "./auth.js";
import {
  appendConsentRecord,
  createStorageBackup,
  createSite,
  ensureInitialData,
  getAuditLog,
  getConfig,
  getConsentHistory,
  getConsentRecordExport,
  getConsentReport,
  getConsentRetentionStatus,
  getPublishedConfig,
  getPublishedVersion,
  getPublicChangelog,
  getStorageStatus,
  getStorageBackupPath,
  listStorageBackups,
  listSites,
  listPublishedVersions,
  publishConfig,
  purgeExpiredConsentRecords,
  restoreStorageBackup,
  rollbackToVersion,
  saveConfig
} from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const SRC_DIR = path.join(ROOT, "src");
const PORT = Number(process.env.PORT || 8787);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

await ensureInitialData();

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Own CMP running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/`);
  console.log(`Demo:  http://localhost:${PORT}/demo.html`);
  if (usingDefaultCredentials()) {
    console.log("Using default login admin@example.com / change-me-now");
  } else if (authMode() === "plaintext-env") {
    console.warn("Using CMP_ADMIN_PASSWORD plaintext fallback. Prefer CMP_ADMIN_PASSWORD_HASH for production.");
  }
});

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (url.pathname === "/") {
    redirect(res, "/admin/");
    return;
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    const rateLimitKey = loginRateLimitKey(req, body.email);
    const currentLimit = checkLoginRateLimit(rateLimitKey);
    if (currentLimit.limited) {
      sendJson(res, 429, {
        error: "Too many login attempts",
        retryAfterSeconds: currentLimit.retryAfterSeconds
      }, {
        "Retry-After": String(currentLimit.retryAfterSeconds)
      });
      return;
    }

    if (!verifyCredentials(body.email, body.password)) {
      const nextLimit = recordLoginFailure(rateLimitKey);
      const headers = nextLimit.limited
        ? { "Retry-After": String(nextLimit.retryAfterSeconds) }
        : {};
      const status = nextLimit.limited ? 429 : 401;
      const message = nextLimit.limited ? "Too many login attempts" : "Invalid login";
      sendJson(res, status, {
        error: message,
        retryAfterSeconds: nextLimit.retryAfterSeconds || 0
      }, headers);
      return;
    }

    clearLoginFailures(rateLimitKey);
    const token = createSession(body.email);
    const session = getSession({ headers: { cookie: sessionCookie(token) } });
    const secureCookies = isSecureRequest(req);
    sendJson(res, 200, {
      ok: true,
      email: body.email,
      csrfToken: session?.csrfToken || null,
      authMode: authMode()
    }, {
      "Set-Cookie": sessionCookie(token, { secure: secureCookies })
    });
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session) return;
    if (!requireCsrf(req, res, session)) return;
    if (session) destroySession(session.token);
    const secureCookies = isSecureRequest(req);
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": clearSessionCookie({ secure: secureCookies })
    });
    return;
  }

  if (url.pathname === "/api/session" && req.method === "GET") {
    const session = getSession(req);
    sendJson(res, 200, {
      authenticated: Boolean(session),
      email: session?.email || null,
      csrfToken: session?.csrfToken || null,
      usingDefaultCredentials: usingDefaultCredentials(),
      authMode: authMode(),
      secureCookies: isSecureRequest(req)
    });
    return;
  }

  if (url.pathname === "/api/sites" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await listSites());
    return;
  }

  if (url.pathname === "/api/sites" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    try {
      const body = await readJsonBody(req);
      sendJson(res, 201, await createSite(body));
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Could not create site" });
    }
    return;
  }

  if (url.pathname === "/api/config" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const siteId = url.searchParams.get("siteId") || undefined;
    const config = await getConfig(siteId);
    if (!config) {
      sendJson(res, 404, { error: "Site not found" });
      return;
    }
    sendJson(res, 200, config);
    return;
  }

  if (url.pathname === "/api/config" && req.method === "PUT") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    const body = await readJsonBody(req);
    sendJson(res, 200, await saveConfig(body));
    return;
  }

  const adminConfigMatch = url.pathname.match(/^\/api\/config\/([^/]+)$/);
  if (adminConfigMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const config = await getConfig(adminConfigMatch[1]);
    if (!config) {
      sendJson(res, 404, { error: "Site not found" });
      return;
    }
    sendJson(res, 200, config);
    return;
  }

  if (adminConfigMatch && req.method === "PUT") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    const body = await readJsonBody(req);
    sendJson(res, 200, await saveConfig(body, adminConfigMatch[1]));
    return;
  }

  if (url.pathname === "/api/publish" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    const body = await readJsonBody(req);
    sendJson(res, 200, await publishConfig(body));
    return;
  }

  const versionsMatch = url.pathname.match(/^\/api\/versions\/([^/]+)\/([^/]+)$/);
  if (versionsMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const [, siteId, environment] = versionsMatch;
    sendJson(res, 200, await listPublishedVersions(siteId, environment));
    return;
  }

  const versionMatch = url.pathname.match(/^\/api\/versions\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (versionMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const [, siteId, environment, version] = versionMatch;
    const config = await getPublishedVersion(siteId, environment, version);
    if (!config) {
      sendJson(res, 404, { error: "Version not found" });
      return;
    }
    sendJson(res, 200, config);
    return;
  }

  if (url.pathname === "/api/rollback" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    const body = await readJsonBody(req);
    const restored = await rollbackToVersion(body.siteId, body.environment || "production", body.version);
    if (!restored) {
      sendJson(res, 404, { error: "Version not found" });
      return;
    }
    sendJson(res, 200, restored);
    return;
  }

  if (url.pathname === "/api/audit" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await getAuditLog());
    return;
  }

  if (url.pathname === "/api/backups" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await listStorageBackups());
    return;
  }

  if (url.pathname === "/api/backups" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    sendJson(res, 201, await createStorageBackup());
    return;
  }

  if (url.pathname === "/api/storage/status" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await getStorageStatus());
    return;
  }

  if (url.pathname === "/api/consent-retention" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await getConsentRetentionStatus());
    return;
  }

  if (url.pathname === "/api/consent-retention/purge" && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    sendJson(res, 200, await purgeExpiredConsentRecords());
    return;
  }

  const backupDownloadMatch = url.pathname.match(/^\/api\/backups\/([^/]+)\/download$/);
  if (backupDownloadMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const backupPath = await getStorageBackupPath(backupDownloadMatch[1]);
    if (!backupPath) {
      sendJson(res, 404, { error: "Backup not found" });
      return;
    }
    await sendFile(res, backupPath, {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${path.basename(backupPath)}"`,
      "Cache-Control": "no-store"
    });
    return;
  }

  const backupRestoreMatch = url.pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
  if (backupRestoreMatch && req.method === "POST") {
    const session = requireAuth(req, res);
    if (!session || !requireCsrf(req, res, session)) return;
    try {
      const restored = await restoreStorageBackup(backupRestoreMatch[1]);
      if (!restored) {
        sendJson(res, 404, { error: "Backup not found" });
        return;
      }
      sendJson(res, 200, restored);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Restore failed" });
    }
    return;
  }

  const reportMatch = url.pathname.match(/^\/api\/reports\/consent\/([^/]+)$/);
  if (reportMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const days = url.searchParams.get("days") || 30;
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    sendJson(res, 200, await getConsentReport(reportMatch[1], { days, from, to }));
    return;
  }

  const exportMatch = url.pathname.match(/^\/api\/exports\/consent\/([^/]+)$/);
  if (exportMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const siteId = safeSegment(exportMatch[1]);
    const days = url.searchParams.get("days") || 30;
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const format = String(url.searchParams.get("format") || "json").toLowerCase();
    const payload = await getConsentRecordExport(siteId, { days, from, to });
    const datePart = `${payload.from.slice(0, 10)}_${payload.to.slice(0, 10)}`;

    if (format === "csv") {
      sendDownload(res, consentExportCsv(payload), {
        contentType: "text/csv; charset=utf-8",
        filename: `owncmp-consent-${siteId}-${datePart}.csv`
      });
      return;
    }

    sendDownload(res, `${JSON.stringify(payload, null, 2)}\n`, {
      contentType: "application/json; charset=utf-8",
      filename: `owncmp-consent-${siteId}-${datePart}.json`
    });
    return;
  }

  const publicVersionedConfigMatch = url.pathname.match(/^\/api\/public\/config\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (publicVersionedConfigMatch && req.method === "GET") {
    const [, siteId, environment, version] = publicVersionedConfigMatch;
    const config = await getPublishedVersion(siteId, environment, version);
    if (!config) {
      sendJson(res, 404, { error: "Published config version not found" }, corsHeaders());
      return;
    }
    sendCacheableJson(req, res, 200, config, corsHeaders(configCacheHeaders(config, {
      immutable: true
    })));
    return;
  }

  const publicConfigMatch = url.pathname.match(/^\/api\/public\/config\/([^/]+)(?:\/([^/]+))?$/);
  if (publicConfigMatch && req.method === "GET") {
    const [, siteId, environment = "production"] = publicConfigMatch;
    
    // If requesting preview environment, require authentication
    if (environment === "preview") {
      if (!requireAuth(req, res)) return;
      const draft = await getConfig(siteId);
      if (!draft) {
        sendJson(res, 404, { error: "Site not found" }, corsHeaders());
        return;
      }
      sendJson(res, 200, draft, corsHeaders({
        "Cache-Control": "no-store"
      }));
      return;
    }

    const config = await getPublishedConfig(siteId, environment);
    if (!config) {
      sendJson(res, 404, { error: "Published config not found" }, corsHeaders());
      return;
    }
    sendCacheableJson(req, res, 200, config, corsHeaders(configCacheHeaders(config)));
    return;
  }

  const publicChangelogMatch = url.pathname.match(/^\/api\/public\/changelog\/([^/]+)$/);
  if (publicChangelogMatch && req.method === "GET") {
    const siteId = safeSegment(publicChangelogMatch[1]);
    const changelog = await getPublicChangelog(siteId);
    sendCacheableJson(req, res, 200, changelog, corsHeaders({
      "Cache-Control": "public, max-age=300"
    }));
    return;
  }

  if (url.pathname === "/api/public/record" && (req.method === "POST" || req.method === "OPTIONS")) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders({ "Access-Control-Allow-Methods": "POST, OPTIONS" }));
      res.end();
      return;
    }

    try {
      const body = await readJsonBody(req);
      const { siteId, ...record } = body;
      if (siteId) {
        await appendConsentRecord(siteId, {
          ...record,
          ua: req.headers["user-agent"]
        });
      }
      sendJson(res, 200, { ok: true }, corsHeaders());
    } catch (e) {
      sendJson(res, 400, { error: "Invalid record" }, corsHeaders());
    }
    return;
  }

  const publicDisclosureMatch = url.pathname.match(/^\/api\/public\/disclosure\/([^/]+)\/([^/]+)$/);
  if (publicDisclosureMatch && req.method === "GET") {
    const siteId = safeSegment(publicDisclosureMatch[1]);
    const cid = publicDisclosureMatch[2];
    const history = await getConsentHistory(siteId, cid);
    sendJson(res, 200, history, corsHeaders({
      "Cache-Control": "no-store"
    }));
    return;
  }

  if (url.pathname === "/api/public/cookie-db" && req.method === "GET") {
    const dbPath = path.join(SRC_DIR, "server", "cookie-db.json");
    const db = await readJsonFile(dbPath, []);
    sendCacheableJson(req, res, 200, db, corsHeaders({
      "Cache-Control": "public, max-age=3600"
    }));
    return;
  }

  await serveStatic(req, url.pathname, res);
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (session) return session;
  sendJson(res, 401, { error: "Authentication required" });
  return null;
}

function requireCsrf(req, res, session) {
  if (verifyCsrfToken(req, session)) return true;
  sendJson(res, 403, { error: "Invalid CSRF token" });
  return false;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 1024 * 1024) {
      throw new Error("Request body too large");
    }
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON");
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function sendFile(res, filePath, headers = {}) {
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, headers);
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

function safeSegment(value) {
  const segment = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(segment)) {
    throw new Error("Invalid path segment");
  }
  return segment;
}

function sendJson(res, statusCode, value, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(value));
}

function sendDownload(res, body, options = {}) {
  res.writeHead(200, {
    "Content-Type": options.contentType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${options.filename || "download"}"`,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function consentExportCsv(payload) {
  const rows = [[
    "ts",
    "siteId",
    "cid",
    "type",
    "action",
    "source",
    "configVersion",
    "categories",
    "googleConsent",
    "userAgent"
  ]];

  for (const record of payload.records || []) {
    rows.push([
      record.ts || record.createdAt || "",
      record.siteId || payload.siteId || "",
      record.cid || "",
      record.type || (record.categories ? "decision" : "unknown"),
      record.action || "",
      record.source || "",
      record.configVersion || "",
      record.categories ? JSON.stringify(record.categories) : "",
      record.googleConsent ? JSON.stringify(record.googleConsent) : "",
      record.ua || ""
    ]);
  }

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCacheableJson(req, res, statusCode, value, headers = {}) {
  const body = JSON.stringify(value);
  const etag = weakEtag(body);
  const lastModified = cacheLastModified(value);
  const responseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, must-revalidate",
    ETag: etag,
    ...headers
  };

  if (lastModified) responseHeaders["Last-Modified"] = lastModified;

  if (isFresh(req, etag, lastModified)) {
    res.writeHead(304, responseHeaders);
    res.end();
    return;
  }

  res.writeHead(statusCode, responseHeaders);
  res.end(body);
}

function configCacheHeaders(config, options = {}) {
  const lastModified = cacheLastModified(config);
  const headers = {
    "Cache-Control": options.immutable
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60, stale-while-revalidate=300, must-revalidate",
    "X-OwnCMP-Config-Version": String(config.version || "unknown"),
    "Access-Control-Expose-Headers": "ETag, Last-Modified, X-OwnCMP-Config-Version"
  };

  if (lastModified) headers["Last-Modified"] = lastModified;
  return headers;
}

function cacheLastModified(value) {
  const source = Array.isArray(value)
    ? value[0]?.publishedAt || value[0]?.lastPublishedAt || null
    : value?.lastPublishedAt || value?.updatedAt || value?.publishedAt || null;
  if (!source) return null;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
}

function weakEtag(body) {
  return `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 24)}"`;
}

function isFresh(req, etag, lastModified) {
  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch && ifNoneMatch.split(",").map((value) => value.trim()).includes(etag)) {
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (ifModifiedSince && lastModified) {
    const since = new Date(ifModifiedSince);
    const modified = new Date(lastModified);
    return !Number.isNaN(since.getTime()) && !Number.isNaN(modified.getTime()) && modified <= since;
  }

  return false;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match, If-Modified-Since",
    ...extra
  };
}

async function serveStatic(req, requestPath, res) {
  let pathname = decodeURIComponent(requestPath);

  if (pathname === "/admin") {
    redirect(res, "/admin/");
    return;
  }

  if (pathname === "/admin/") pathname = "/admin/index.html";

  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  const relative = path.relative(PUBLIC_DIR, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const stat = await fs.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const etag = weakEtag(content);
    const lastModified = stat.mtime.toUTCString();
    const headers = {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      ETag: etag,
      "Last-Modified": lastModified
    };

    if (pathname.startsWith("/cmp/")) {
      headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400";
      headers["Access-Control-Allow-Origin"] = "*";
    }

    if (isFresh(req, etag, lastModified)) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}
