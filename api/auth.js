import { OAUTH_SCOPES } from './_google.js';

export default function handler(req, res) {
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const REDIRECT_URI = `https://${req.headers.host}/auth/callback`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
