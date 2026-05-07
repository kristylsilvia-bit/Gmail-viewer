export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<html><body style="font-family:monospace;background:#0e0e10;color:#f0f0f2;padding:40px;">
      <h2 style="color:#e8453c">Auth Error</h2><p>${error}</p>
    </body></html>`);
  }

  if (!code) {
    return res.send(`<html><body style="font-family:monospace;background:#0e0e10;color:#f0f0f2;padding:40px;">
      <h2 style="color:#e8453c">No code received</h2>
    </body></html>`);
  }

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
        grant_type: 'authorization_code'
      })
    });

    const data = await tokenRes.json();

    if (data.error) {
      return res.send(`<html><body style="font-family:monospace;background:#0e0e10;color:#f0f0f2;padding:40px;">
        <h2 style="color:#e8453c">Token Error</h2><p>${data.error}: ${data.error_description}</p>
      </body></html>`);
    }

    const refreshToken = data.refresh_token;

    res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Token Ready</title>
<style>
  body { font-family: monospace; background: #0e0e10; color: #f0f0f2; padding: 32px; max-width: 600px; margin: 0 auto; }
  h2 { color: #34a853; }
  .token-box {
    background: #18181c;
    border: 1px solid #2e2e38;
    border-radius: 10px;
    padding: 16px;
    word-break: break-all;
    font-size: 12px;
    color: #ff6b5b;
    margin: 16px 0;
    cursor: pointer;
    user-select: all;
  }
  .steps { background: #18181c; border: 1px solid #2e2e38; border-radius: 10px; padding: 20px; margin-top: 24px; }
  .steps ol { padding-left: 20px; line-height: 2; color: #8888a0; }
  .steps li strong { color: #f0f0f2; }
  .copy-btn {
    background: #e8453c; border: none; color: white;
    padding: 10px 20px; border-radius: 8px; font-family: monospace;
    font-size: 13px; cursor: pointer; margin-bottom: 8px;
  }
  .note { font-size: 11px; color: #55556a; margin-top: 8px; }
</style>
</head>
<body>
  <h2>✅ Refresh Token Generated!</h2>
  <p style="color:#8888a0">Copy this token and add it to Vercel as an environment variable.</p>

  <button class="copy-btn" onclick="copyToken()">📋 Copy Token</button>
  <div class="token-box" id="token-box" title="Click to select all">${refreshToken}</div>
  <div class="note">⚠️ This token gives access to your Gmail. Don't share it with anyone.</div>

  <div class="steps">
    <p style="color:#f0f0f2;margin:0 0 12px;font-weight:bold">Next Steps — Add to Vercel:</p>
    <ol>
      <li>Go to <strong>vercel.com → your project → Settings → Environment Variables</strong></li>
      <li>Add: <strong>GMAIL_REFRESH_TOKEN</strong> = (paste token above)</li>
      <li>Add: <strong>GMAIL_CLIENT_ID</strong> = your client ID</li>
      <li>Add: <strong>GMAIL_CLIENT_SECRET</strong> = your client secret</li>
      <li>Click <strong>Redeploy</strong> in Vercel deployments tab</li>
      <li>Open <strong>gmail-viewer-js.vercel.app</strong> — no login needed!</li>
    </ol>
  </div>

  <script>
    function copyToken() {
      navigator.clipboard.writeText('${refreshToken}').then(() => {
        document.querySelector('.copy-btn').textContent = '✅ Copied!';
        setTimeout(() => document.querySelector('.copy-btn').textContent = '📋 Copy Token', 2000);
      });
    }
  </script>
</body>
</html>`);

  } catch(e) {
    res.send(`<html><body style="font-family:monospace;background:#0e0e10;color:#f0f0f2;padding:40px;">
      <h2 style="color:#e8453c">Error</h2><p>${e.message}</p>
    </body></html>`);
  }
}
