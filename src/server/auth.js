import crypto from "node:crypto";

const SESSION_COOKIE = "owncmp_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();

function getCredentials() {
  return {
    email: process.env.CMP_ADMIN_EMAIL || "admin@example.com",
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
  return timingSafeEqualText(email, expected.email) && timingSafeEqualText(password, expected.password);
}

export function createSession(email) {
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, {
    email,
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
    expiresAt: session.expiresAt
  };
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function usingDefaultCredentials() {
  return !process.env.CMP_ADMIN_EMAIL || !process.env.CMP_ADMIN_PASSWORD;
}
