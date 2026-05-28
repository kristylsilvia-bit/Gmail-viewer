import { getAccounts, saveAccounts, setActive } from './_google.js';

function errorPage(res, title, detail) {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><body style="font-family:system-ui,monospace;background:#08090e;color:#e2e8f8;padding:40px;max-width:600px;margin:0 auto;">
    <h2 style="color:#f87171">${title}</h2><p style="color:#7a90b8">${detail || ''}</p>
    <p><a href="/" style="color:#5b8aff">← Back to inbox</a></p>
  </body></html>`);
}

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return errorPage(res, 'Authorization Error', error);
  if (!code) return errorPage(res, 'No authorization code received');

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REDIRECT_URI = `https://${req.headers.host}/auth/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const data = await tokenRes.json();
    if (data.error) return errorPage(res, 'Token Error', `${data.error}: ${data.error_description || ''}`);

    const refreshToken = data.refresh_token;
    if (!refreshToken) {
      return errorPage(res, 'No refresh token', 'Google did not return a refresh token. Remove the app from your Google account permissions and try again.');
    }

    // Identify which account this is.
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const profile = await profileRes.json();
    const email = profile.email || '';
    const name = profile.name || '';

    const accounts = getAccounts(req);
    const idx = accounts.findIndex(a => a.email === email);
    const entry = { email, name, refreshToken };
    if (idx > -1) accounts[idx] = entry;
    else accounts.push(entry);

    saveAccounts(res, accounts);
    setActive(res, email);

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head>
      <body style="font-family:system-ui;background:#08090e;color:#e2e8f8;padding:40px;text-align:center;">
      <p>Signed in as ${email}. Redirecting…</p>
      <script>location.replace('/');</script></body></html>`);
  } catch (e) {
    return errorPage(res, 'Error', e.message);
  }
}
