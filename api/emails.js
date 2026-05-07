export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

  if (!REFRESH_TOKEN) {
    return res.status(500).json({ error: 'GMAIL_REFRESH_TOKEN not set in environment variables.' });
  }

  // Step 1: Get a fresh access token
  let accessToken;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(401).json({ error: `Token refresh failed: ${tokenData.error_description}` });
    }
    accessToken = tokenData.access_token;
  } catch(e) {
    return res.status(500).json({ error: `Token fetch error: ${e.message}` });
  }

  const { action, id, pageToken } = req.query;

  // Step 2: Handle actions
  try {
    if (action === 'userinfo') {
      const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return res.json(await r.json());
    }

    if (action === 'message' && id) {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return res.json(await r.json());
    }

    // Default: list inbox
    const maxResults = req.query.maxResults || 50;
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const listRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const listData = await listRes.json();

    if (!listData.messages) return res.json({ messages: [], nextPageToken: null });

    // Fetch metadata in parallel
    const details = await Promise.all(
      listData.messages.map(m =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.json())
      )
    );

    const emails = details.map(msg => {
      const headers = msg.payload?.headers || [];
      const get = n => headers.find(h => h.name.toLowerCase() === n.toLowerCase())?.value || '';
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: get('Subject') || '(no subject)',
        from: get('From'),
        date: get('Date'),
        snippet: msg.snippet || '',
        unread: (msg.labelIds || []).includes('UNREAD'),
        starred: (msg.labelIds || []).includes('STARRED'),
      };
    });

    return res.json({ messages: emails, nextPageToken: listData.nextPageToken || null });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
