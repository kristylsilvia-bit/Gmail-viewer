// Shared helpers for Google OAuth + Gmail API (multi-account).
// Accounts persist in a shared cross-device store when one is configured
// (see _store.js); otherwise they fall back to per-device cookies.
import { storeReady, storeGet, storeSet, storeDel } from './_store.js';

export const OAUTH_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

export function appendCookies(res, cookies) {
  const existing = res.getHeader('Set-Cookie');
  let arr = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  res.setHeader('Set-Cookie', arr.concat(cookies));
}

const ACCOUNTS_COOKIE = 'gv_accounts';
const ACTIVE_COOKIE = 'gv_active';
const ONE_YEAR = 60 * 60 * 24 * 365;

// Global keys for the shared store — every device/visitor shares these.
const STORE_ACCOUNTS = 'gv:shared:accounts';
const STORE_ACTIVE = 'gv:shared:active';

// accounts = [{ email, name, refreshToken }]
export async function getAccounts(req) {
  if (storeReady()) {
    const a = await storeGet(STORE_ACCOUNTS);
    return Array.isArray(a) ? a : [];
  }
  const cookies = parseCookies(req);
  if (!cookies[ACCOUNTS_COOKIE]) return [];
  try {
    return JSON.parse(Buffer.from(cookies[ACCOUNTS_COOKIE], 'base64').toString('utf8')) || [];
  } catch {
    return [];
  }
}

export async function getActiveEmail(req) {
  if (storeReady()) {
    return (await storeGet(STORE_ACTIVE)) || null;
  }
  const cookies = parseCookies(req);
  return cookies[ACTIVE_COOKIE] || null;
}

export async function saveAccounts(res, accounts) {
  if (storeReady()) {
    await storeSet(STORE_ACCOUNTS, accounts);
    return;
  }
  const val = Buffer.from(JSON.stringify(accounts)).toString('base64');
  appendCookies(res, [
    `${ACCOUNTS_COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ONE_YEAR}`,
  ]);
}

export async function setActive(res, email) {
  if (storeReady()) {
    await storeSet(STORE_ACTIVE, email || '');
    return;
  }
  appendCookies(res, [
    `${ACTIVE_COOKIE}=${encodeURIComponent(email)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ONE_YEAR}`,
  ]);
}

export async function clearAccountCookies(res) {
  if (storeReady()) {
    await storeDel(STORE_ACCOUNTS);
    await storeDel(STORE_ACTIVE);
    return;
  }
  appendCookies(res, [
    `${ACCOUNTS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${ACTIVE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  ]);
}

// Resolve which account/refresh-token the request should act as.
// Falls back to the env-var refresh token for backwards compatibility.
export async function resolveAccount(req) {
  const accounts = await getAccounts(req);
  const active = await getActiveEmail(req);
  if (accounts.length) {
    const found = accounts.find(a => a.email === active) || accounts[0];
    return { ...found, kind: found.kind || 'google', source: 'cookie' };
  }
  if (process.env.GMAIL_REFRESH_TOKEN) {
    return {
      kind: 'google',
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      email: process.env.GMAIL_EMAIL || '',
      name: '',
      source: 'env',
    };
  }
  return null;
}

export async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error_description || data.error);
    err.code = 401;
    throw err;
  }
  return data.access_token;
}

export function gapi(accessToken, path, init = {}) {
  return fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
  });
}
