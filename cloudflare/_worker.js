// Patreon OAuth middleware for Cloudflare Pages
// Environment variables required:
//   PATREON_CLIENT_ID     - OAuth client ID from Patreon
//   PATREON_CLIENT_SECRET - OAuth client secret from Patreon
//   SESSION_SECRET        - Random string for signing session cookies
//   PATREON_CAMPAIGN_ID   - (optional) Filter to a specific campaign
//   PATREON_PAGE_NAME     - (optional) Your Patreon page name for the "Become a Patron" link

const COOKIE_NAME = 'patreon_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// --- Free content configuration ---
// Article slugs starting with these prefixes are accessible without subscription.
// Prefix maps to folder/file naming: "0-" = "0 Basics", "1-" = "7 Properties".
const FREE_SECTIONS = ['0-', '1-'];
// Individual article slugs to make free regardless of prefix.
const FREE_ARTICLES = [];

// --- Crypto helpers ---

async function hmacSign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(data, hex, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const sigBytes = new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
}

async function createSession(userId, secret) {
  const payload = btoa(JSON.stringify({
    sub: userId,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifySession(cookie, secret) {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  if (!await hmacVerify(payload, sig, secret)) return null;
  try {
    const data = JSON.parse(atob(payload));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// --- Patreon API ---

function patreonAuthUrl(clientId, redirectUri, returnPath) {
  const state = returnPath ? btoa(returnPath) : '';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'identity identity.memberships',
    ...(state && { state }),
  });
  return `https://www.patreon.com/oauth2/authorize?${params}`;
}

async function exchangeCode(code, env, redirectUri) {
  const res = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: env.PATREON_CLIENT_ID,
      client_secret: env.PATREON_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  });
  return res.json();
}

async function fetchIdentity(accessToken) {
  const url = 'https://www.patreon.com/api/oauth2/v2/identity'
    + '?include=memberships'
    + '&fields[member]=patron_status,currently_entitled_amount_cents';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

function isActivePatron(identity, campaignId) {
  if (!identity.included) return false;
  return identity.included.some(item => {
    if (item.type !== 'member') return false;
    if (item.attributes?.patron_status !== 'active_patron') return false;
    if (campaignId) {
      return item.relationships?.campaign?.data?.id === campaignId;
    }
    return true;
  });
}

// --- HTML responses ---

function accessDeniedPage(patreonPageName) {
  const patreonUrl = patreonPageName
    ? `https://www.patreon.com/${patreonPageName}`
    : 'https://www.patreon.com';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Patron Access Only</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; background: #f5f5f7; color: #1d1d1f;
    }
    .card {
      text-align: center; max-width: 420px; padding: 48px 32px;
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 12px; }
    p { font-size: 16px; color: #6e6e73; line-height: 1.5; margin-bottom: 28px; }
    .btn {
      display: inline-block; background: #FF424D; color: white;
      text-decoration: none; padding: 12px 32px; border-radius: 980px;
      font-size: 16px; font-weight: 500; transition: background 0.2s;
    }
    .btn:hover { background: #e63946; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128218;</div>
    <h1>Patron Access Only</h1>
    <p>This book is available exclusively to Patreon supporters. Subscribe to get full access to all chapters.</p>
    <a class="btn" href="${patreonUrl}">Become a Patron</a>
  </div>
</body>
</html>`;
}

// --- Free path resolution ---

function isFreeArticleSlug(slug) {
  const lower = slug.toLowerCase();
  if (FREE_ARTICLES.some(a => a.toLowerCase() === lower)) return true;
  return FREE_SECTIONS.some(prefix => lower.startsWith(prefix.toLowerCase()));
}

function isFreePath(pathname) {
  const path = pathname.toLowerCase();

  // Static assets (css, js, images, fonts) — always free
  if (!path.startsWith('/documentation/') && !path.startsWith('/data/documentation/') &&
      !path.startsWith('/tutorials/') && !path.startsWith('/data/tutorials/')) {
    return true;
  }

  // Root documentation page (table of contents) — always free
  if (path === '/documentation/book' || path === '/documentation/book/') {
    return true;
  }
  if (path === '/data/documentation/book.json') {
    return true;
  }

  // Article HTML: /documentation/book/<slug> or /documentation/book/<slug>/
  const htmlMatch = path.match(/^\/documentation\/book\/([^/.]+)\/?$/);
  if (htmlMatch) return isFreeArticleSlug(htmlMatch[1]);

  // Article JSON data: /data/documentation/book/<slug>.json
  const jsonMatch = path.match(/^\/data\/documentation\/book\/([^/.]+)\.json$/);
  if (jsonMatch) return isFreeArticleSlug(jsonMatch[1]);

  return false;
}

// --- Main Worker ---

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/auth/callback`;

    // --- /auth/callback ---
    if (url.pathname === '/auth/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response(accessDeniedPage(env.PATREON_PAGE_NAME), {
          status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      const tokenData = await exchangeCode(code, env, redirectUri);
      if (!tokenData.access_token) {
        return new Response('Authentication failed. Please try again.', { status: 502 });
      }

      const identity = await fetchIdentity(tokenData.access_token);

      if (!isActivePatron(identity, env.PATREON_CAMPAIGN_ID)) {
        return new Response(accessDeniedPage(env.PATREON_PAGE_NAME), {
          status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      // Determine return path from OAuth state
      let returnTo = '/';
      const state = url.searchParams.get('state');
      if (state) {
        try {
          const decoded = atob(state);
          if (decoded.startsWith('/')) returnTo = decoded;
        } catch { /* ignore */ }
      }

      const sessionValue = await createSession(identity.data.id, env.SESSION_SECRET);
      return new Response(null, {
        status: 302,
        headers: {
          Location: returnTo,
          'Set-Cookie': setCookieHeader(sessionValue, SESSION_MAX_AGE),
        },
      });
    }

    // --- /auth/logout ---
    if (url.pathname === '/auth/logout') {
      return new Response(null, {
        status: 302,
        headers: {
          Location: '/',
          'Set-Cookie': setCookieHeader('', 0),
        },
      });
    }

    // --- Free content (no auth required) ---
    if (isFreePath(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    // --- Protected content ---
    const session = await verifySession(
      getCookie(request, COOKIE_NAME),
      env.SESSION_SECRET,
    );

    if (session) {
      return env.ASSETS.fetch(request);
    }

    // Not authenticated - redirect to Patreon
    const returnPath = url.pathname + url.search;
    return Response.redirect(
      patreonAuthUrl(env.PATREON_CLIENT_ID, redirectUri, returnPath),
      302,
    );
  },
};
