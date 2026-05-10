import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  sessionCookie,
  usingDefaultCredentials,
  verifyCredentials
} from "./auth.js";
import {
  appendConsentRecord,
  createSite,
  ensureInitialData,
  getAuditLog,
  getConfig,
  getConsentHistory,
  getConsentReport,
  getPublishedConfig,
  getPublishedVersion,
  getPublicChangelog,
  listSites,
  listPublishedVersions,
  publishConfig,
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
    if (!verifyCredentials(body.email, body.password)) {
      sendJson(res, 401, { error: "Invalid login" });
      return;
    }

    const token = createSession(body.email);
    sendJson(res, 200, { ok: true, email: body.email }, {
      "Set-Cookie": sessionCookie(token)
    });
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const session = getSession(req);
    if (session) destroySession(session.token);
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": clearSessionCookie()
    });
    return;
  }

  if (url.pathname === "/api/session" && req.method === "GET") {
    const session = getSession(req);
    sendJson(res, 200, {
      authenticated: Boolean(session),
      email: session?.email || null,
      usingDefaultCredentials: usingDefaultCredentials()
    });
    return;
  }

  if (url.pathname === "/api/sites" && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    sendJson(res, 200, await listSites());
    return;
  }

  if (url.pathname === "/api/sites" && req.method === "POST") {
    if (!requireAuth(req, res)) return;
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
    if (!requireAuth(req, res)) return;
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
    if (!requireAuth(req, res)) return;
    const body = await readJsonBody(req);
    sendJson(res, 200, await saveConfig(body, adminConfigMatch[1]));
    return;
  }

  if (url.pathname === "/api/publish" && req.method === "POST") {
    if (!requireAuth(req, res)) return;
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
    if (!requireAuth(req, res)) return;
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

  const reportMatch = url.pathname.match(/^\/api\/reports\/consent\/([^/]+)$/);
  if (reportMatch && req.method === "GET") {
    if (!requireAuth(req, res)) return;
    const days = url.searchParams.get("days") || 30;
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    sendJson(res, 200, await getConsentReport(reportMatch[1], { days, from, to }));
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
    sendJson(res, 200, config, corsHeaders({
      "Cache-Control": "public, max-age=60"
    }));
    return;
  }

  const publicChangelogMatch = url.pathname.match(/^\/api\/public\/changelog\/([^/]+)$/);
  if (publicChangelogMatch && req.method === "GET") {
    const siteId = safeSegment(publicChangelogMatch[1]);
    const changelog = await getPublicChangelog(siteId);
    sendJson(res, 200, changelog, corsHeaders({
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
    sendJson(res, 200, db, corsHeaders({
      "Cache-Control": "public, max-age=3600"
    }));
    return;
  }

  await serveStatic(url.pathname, res);
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (session) return session;
  sendJson(res, 401, { error: "Authentication required" });
  return null;
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

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extra
  };
}

async function serveStatic(requestPath, res) {
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
    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    };

    if (pathname.startsWith("/cmp/")) {
      headers["Cache-Control"] = "public, max-age=300";
      headers["Access-Control-Allow-Origin"] = "*";
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
