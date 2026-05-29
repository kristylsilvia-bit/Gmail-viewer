// Shared cross-device store backed by Vercel KV / Upstash Redis (REST API).
// No npm dependency — uses the REST endpoint via fetch. When the env vars are
// not configured the helpers report "not ready" and callers fall back to
// per-device cookies, so the app keeps working without a store.
//
// Set these in your Vercel project (Vercel KV provides them automatically):
//   KV_REST_API_URL    (or UPSTASH_REDIS_REST_URL)
//   KV_REST_API_TOKEN  (or UPSTASH_REDIS_REST_TOKEN)

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export function storeReady() {
  return !!(REST_URL && REST_TOKEN);
}

export async function storeGet(key) {
  if (!storeReady()) return null;
  try {
    const r = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    if (!data || data.result == null) return null;
    try { return JSON.parse(data.result); } catch { return data.result; }
  } catch {
    return null;
  }
}

export async function storeSet(key, value) {
  if (!storeReady()) return false;
  try {
    const r = await fetch(`${REST_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
      body: JSON.stringify(value),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function storeDel(key) {
  if (!storeReady()) return false;
  try {
    const r = await fetch(`${REST_URL}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REST_TOKEN}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
