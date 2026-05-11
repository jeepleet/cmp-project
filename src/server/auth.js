import crypto from "node:crypto";

const SESSION_COOKIE = "owncmp_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const HASH_SCHEME = "scrypt";
const HASH_VERSION = "v1";
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 64 * 1024 * 1024
};
const sessions = new Map();
const loginFailures = new Map();

export const LOGIN_RATE_LIMIT = {
  maxAttempts: Number(process.env.CMP_LOGIN_MAX_ATTEMPTS || 5),
  windowMs: Number(process.env.CMP_LOGIN_WINDOW_MS || 15 * 60 * 1000),
  lockMs: Number(process.env.CMP_LOGIN_LOCK_MS || 15 * 60 * 1000)
};

function getCredentials() {
  return {
    email: process.env.CMP_ADMIN_EMAIL || "admin@example.com",
    passwordHash: process.env.CMP_ADMIN_PASSWORD_HASH || "",
    password: process.env.CMP_ADMIN_PASSWORD || "change-me-now"
  };
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyCredentials(email, password) {
  const expected = getCredentials();
  if (!timingSafeEqualText(email, expected.email)) return false;
  if (expected.passwordHash) return verifyPasswordHash(password, expected.passwordHash);
  return timingSafeEqualText(password, expected.password);
}

export function loginRateLimitKey(req, email) {
  return `${clientIp(req)}|${String(email || "").trim().toLowerCase()}`;
}

export function checkLoginRateLimit(key) {
  pruneLoginFailures();
  const entry = loginFailures.get(key);
  if (!entry) return { limited: false, retryAfterSeconds: 0 };

  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000)
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key) {
  const now = Date.now();
  const entry = loginFailures.get(key) || {
    attempts: 0,
    firstAttemptAt: now,
    lockedUntil: 0
  };

  if (now - entry.firstAttemptAt > LOGIN_RATE_LIMIT.windowMs) {
    entry.attempts = 0;
    entry.firstAttemptAt = now;
    entry.lockedUntil = 0;
  }

  entry.attempts += 1;
  if (entry.attempts >= LOGIN_RATE_LIMIT.maxAttempts) {
    entry.lockedUntil = now + LOGIN_RATE_LIMIT.lockMs;
  }

  loginFailures.set(key, entry);
  return checkLoginRateLimit(key);
}

export function clearLoginFailures(key) {
  loginFailures.delete(key);
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem
  }).toString("base64url");

  return [
    HASH_SCHEME,
    HASH_VERSION,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    SCRYPT_PARAMS.keylen,
    salt,
    hash
  ].join("$");
}

function verifyPasswordHash(password, encodedHash) {
  const parts = String(encodedHash || "").split("$");
  if (parts.length !== 8) return false;

  const [scheme, version, nRaw, rRaw, pRaw, keylenRaw, salt, expectedRaw] = parts;
  if (scheme !== HASH_SCHEME || version !== HASH_VERSION || !salt || !expectedRaw) return false;

  const params = {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    keylen: Number(keylenRaw)
  };
  if (!params.N || !params.r || !params.p || !params.keylen) return false;

  try {
    const actual = crypto.scryptSync(String(password), salt, params.keylen, {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: SCRYPT_PARAMS.maxmem
    });
    const expected = Buffer.from(expectedRaw, "base64url");
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

export function createSession(email) {
  const token = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, {
    email,
    csrfToken,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function parseCookies(cookieHeader = "") {
  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

export function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return {
    token,
    email: session.email,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  };
}

export function verifyCsrfToken(req, session) {
  if (!session?.csrfToken) return false;
  const submitted = String(req?.headers?.["x-csrf-token"] || "");
  if (!submitted) return false;
  return timingSafeEqualText(submitted, session.csrfToken);
}

export function sessionCookie(token, options = {}) {
  return buildSessionCookie(`${SESSION_COOKIE}=${encodeURIComponent(token)}`, SESSION_TTL_MS / 1000, options);
}

export function clearSessionCookie(options = {}) {
  return buildSessionCookie(`${SESSION_COOKIE}=`, 0, options);
}

function buildSessionCookie(base, maxAge, options = {}) {
  return [
    base,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
    options.secure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function isSecureRequest(req) {
  if (process.env.CMP_FORCE_SECURE_COOKIES === "true") return true;
  if (req?.socket?.encrypted) return true;

  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;

  const forwarded = String(req?.headers?.forwarded || "").toLowerCase();
  return /(?:^|[;,]\s*)proto=https(?:[;,]|$)/.test(forwarded);
}

export function usingDefaultCredentials() {
  return !process.env.CMP_ADMIN_EMAIL || (!process.env.CMP_ADMIN_PASSWORD_HASH && !process.env.CMP_ADMIN_PASSWORD);
}

export function authMode() {
  if (usingDefaultCredentials()) return "default";
  if (process.env.CMP_ADMIN_PASSWORD_HASH) return "hashed";
  return "plaintext-env";
}

function clientIp(req) {
  const forwardedFor = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwardedFor || req?.socket?.remoteAddress || "unknown";
}

function pruneLoginFailures() {
  const now = Date.now();
  for (const [key, entry] of loginFailures) {
    const windowExpired = now - entry.firstAttemptAt > LOGIN_RATE_LIMIT.windowMs;
    const lockExpired = !entry.lockedUntil || entry.lockedUntil <= now;
    if (windowExpired && lockExpired) loginFailures.delete(key);
  }
}
