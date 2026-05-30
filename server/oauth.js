import express from 'express';
const router = express.Router();

// NOTE: In production, these should be securely stored in process.env!
// Provided by user for hackathon demo purposes:
const PROVIDERS = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: 'repo,read:org,read:user',
  },
  google_calendar: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/calendar.readonly',
  },
  gmail: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: 'https://www.googleapis.com/auth/gmail.readonly',
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: 'channels:read,users:read,search:read', // Added required scopes
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    authUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scopes: 'identify guilds',
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: 'r_liteprofile r_emailaddress',
  },
};

const getRedirectUri = (req, providerId) => {
  const baseUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
  return `${baseUrl}/api/auth/callback/${providerId}`;
};

// 1. Redirect to Provider Auth Screen
router.get('/login/:provider', (req, res) => {
  const providerId = req.params.provider;
  const config = PROVIDERS[providerId];
  if (!config) return res.status(404).send('Provider not found');

  const { returnTo } = req.query;
  const redirectUri = getRedirectUri(req, providerId);
  const stateObj = { nonce: Math.random().toString(36).substring(7), returnTo: returnTo || 'black-pearl://oauth' };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

  let url = '';
  if (providerId === 'google_calendar' || providerId === 'gmail') {
    url = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(config.scopes)}&access_type=offline&state=${state}`;
  } else if (providerId === 'slack') {
    url = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&user_scope=${encodeURIComponent(config.scopes)}&state=${state}`;
  } else if (providerId === 'discord') {
    url = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(config.scopes)}&state=${state}`;
  } else if (providerId === 'linkedin') {
    url = `${config.authUrl}?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&state=${state}`;
  } else {
    // GitHub
    url = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(config.scopes)}&state=${state}`;
  }

  res.redirect(url);
});

// 2. Handle Callback & Token Exchange
router.get('/callback/:provider', async (req, res) => {
  const providerId = req.params.provider;
  const config = PROVIDERS[providerId];
  const { code, error, state } = req.query;

  let returnTo = 'black-pearl://oauth';
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      if (decoded.returnTo) returnTo = decoded.returnTo;
    }
  } catch (e) {
    console.warn('Failed to parse state:', e);
  }

  const redirectUrlWithArgs = (args) => {
    const symbol = returnTo.includes('?') ? '&' : '?';
    return `${returnTo}${symbol}${args}`;
  };

  if (error) {
    return res.redirect(redirectUrlWithArgs(`source=${providerId}&error=${encodeURIComponent(error)}`));
  }

  if (!code || !config) {
    return res.redirect(redirectUrlWithArgs(`source=${providerId}&error=Invalid_callback`));
  }

  const redirectUri = getRedirectUri(req, providerId);
  let token = null;

  try {
    if (providerId === 'github') {
      const resp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri
        })
      });
      const data = await resp.json();
      token = data.access_token;
    } else if (providerId === 'google_calendar' || providerId === 'gmail') {
      const resp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const data = await resp.json();
      token = data.access_token;
    } else if (providerId === 'slack') {
      const resp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri
        })
      });
      const data = await resp.json();
      token = data.authed_user?.access_token || data.access_token;
    } else if (providerId === 'discord') {
      const resp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        })
      });
      const data = await resp.json();
      token = data.access_token;
    } else if (providerId === 'linkedin') {
      const resp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirectUri
        })
      });
      const data = await resp.json();
      token = data.access_token;
    }

    if (!token) throw new Error('No access token received');

    // Redirect successfully back to the app!
    res.redirect(redirectUrlWithArgs(`source=${providerId}&token=${encodeURIComponent(token)}`));

  } catch (err) {
    console.error(`[OAuth] Exchange failed for ${providerId}:`, err);
    res.redirect(redirectUrlWithArgs(`source=${providerId}&error=Exchange_failed`));
  }
});

export default router;
