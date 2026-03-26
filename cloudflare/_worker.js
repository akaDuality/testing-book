// Stripe-based book access for Cloudflare Pages
// Environment variables required:
//   STRIPE_SECRET_KEY    - Stripe secret API key (sk_live_... or sk_test_...)
//   STRIPE_PAYMENT_LINK  - Stripe Payment Link URL for buying the book
//   SESSION_SECRET       - Random string for signing session cookies

const COOKIE_NAME = 'book_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// --- Free content configuration ---
// Article slugs starting with these prefixes are accessible without purchase.
const FREE_SECTIONS = ['0-', '1-'];
// Individual article slugs to make free regardless of prefix.
const FREE_ARTICLES = [];

// Browser-facing base path (must match --hosting-base-path).
// Used only for links in generated HTML and cookie scope.
// Route matching uses root paths since the router strips this prefix.
const BASE = '/testing-book';

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
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=${BASE}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// --- Stripe API ---

async function findCustomerByEmail(email, stripeKey) {
  const query = encodeURIComponent(`email:"${email}"`);
  const res = await fetch(`https://api.stripe.com/v1/customers/search?query=${query}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

async function hasActiveAccess(customerId, stripeKey) {
  // Check for active subscriptions
  const subsRes = await fetch(
    `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const subs = await subsRes.json();
  if (subs.data?.length > 0) return true;

  // Check for successful one-time payments
  const chargesRes = await fetch(
    `https://api.stripe.com/v1/charges?customer=${customerId}&limit=100`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const charges = await chargesRes.json();
  return charges.data?.some(c => c.paid && !c.refunded);
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

// --- HTML pages ---

function loginPage(paymentLink, error, returnTo) {
  const errorHtml = error
    ? `<div class="error">${error}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Book Access</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; background: #f5f5f7; color: #1d1d1f;
    }
    .card {
      width: 100%; max-width: 400px; padding: 48px 32px;
      background: white; border-radius: 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .icon { font-size: 48px; text-align: center; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 600; text-align: center; margin-bottom: 8px; }
    .subtitle { font-size: 15px; color: #6e6e73; text-align: center; line-height: 1.4; margin-bottom: 28px; }
    label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; color: #1d1d1f; }
    input[type="email"] {
      width: 100%; padding: 10px 14px; border: 1px solid #d2d2d7;
      border-radius: 8px; font-size: 16px; outline: none;
      transition: border-color 0.2s;
    }
    input[type="email"]:focus { border-color: #0071e3; }
    .btn {
      display: block; width: 100%; padding: 12px; border: none;
      border-radius: 980px; font-size: 16px; font-weight: 500;
      cursor: pointer; text-align: center; text-decoration: none;
      transition: background 0.2s;
    }
    .btn-primary { background: #0071e3; color: white; margin-top: 16px; }
    .btn-primary:hover { background: #0077ED; }
    .divider {
      text-align: center; color: #6e6e73; font-size: 13px;
      margin: 24px 0; position: relative;
    }
    .divider::before, .divider::after {
      content: ''; position: absolute; top: 50%;
      width: 40%; height: 1px; background: #d2d2d7;
    }
    .divider::before { left: 0; }
    .divider::after { right: 0; }
    .btn-buy { background: #34c759; color: white; }
    .btn-buy:hover { background: #30b350; }
    .error {
      background: #fff2f2; color: #e30000; padding: 10px 14px;
      border-radius: 8px; font-size: 14px; margin-bottom: 20px;
      text-align: center;
    }
    .back { display: block; text-align: center; margin-top: 20px; font-size: 14px; color: #6e6e73; }
    .back a { color: #0071e3; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128218;</div>
    <h1>Paid Chapter</h1>
    <p class="subtitle">Already purchased? Enter the email you used at checkout.</p>
    ${errorHtml}
    <form method="POST" action="${BASE}/auth/verify">
      <input type="hidden" name="return_to" value="${returnTo}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="you@example.com" required>
      <button type="submit" class="btn btn-primary">Access the Book</button>
    </form>
    <div class="divider">or</div>
    <a href="${paymentLink}" class="btn btn-buy">Buy the Book</a>
    <span class="back"><a href="${BASE}/documentation/book">&#8592; Free chapters</a></span>
  </div>
</body>
</html>`;
}

// --- SPA auth script ---
// Injected into HTML pages so that client-side navigation to paid
// articles triggers a full page reload (which shows the login form).
const AUTH_SCRIPT = `<script>(function(){var f=window.fetch;window.fetch=function(){var a=arguments;return f.apply(this,a).then(function(r){if(r.status===401){var u=(typeof a[0]==="string"?a[0]:a[0].url)||"";var m=u.match(/(.*)\/data(\/documentation\/.*?)\.json/);if(m){window.location.href=m[1]+m[2]}else{window.location.reload()}return new Promise(function(){})}return r})}})();</script>`;

async function injectAuthScript(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  const html = await response.text();
  const modified = html.replace('</head>', AUTH_SCRIPT + '</head>');
  return new Response(modified, {
    status: response.status,
    headers: response.headers,
  });
}

// --- Main Worker ---

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- POST /auth/verify ---
    if (url.pathname === '/auth/verify' && request.method === 'POST') {
      const formData = await request.formData();
      const email = formData.get('email')?.trim().toLowerCase();
      let returnTo = formData.get('return_to') || '/';
      if (!returnTo.startsWith('/')) returnTo = '/';

      if (!email) {
        return new Response(loginPage(env.STRIPE_PAYMENT_LINK, 'Please enter your email.', returnTo), {
          status: 400, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      const customer = await findCustomerByEmail(email, env.STRIPE_SECRET_KEY);
      if (!customer) {
        return new Response(loginPage(env.STRIPE_PAYMENT_LINK, 'No purchase found for this email.', returnTo), {
          status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      const access = await hasActiveAccess(customer.id, env.STRIPE_SECRET_KEY);
      if (!access) {
        return new Response(loginPage(env.STRIPE_PAYMENT_LINK, 'No active purchase found. Your subscription may have expired.', returnTo), {
          status: 403, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      const sessionValue = await createSession(customer.id, env.SESSION_SECRET);
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
          Location: `${BASE}/documentation/book`,
          'Set-Cookie': setCookieHeader('', 0),
        },
      });
    }

    // --- Free content (no auth required) ---
    if (isFreePath(url.pathname)) {
      const response = await env.ASSETS.fetch(request);
      return injectAuthScript(response);
    }

    // --- Protected content ---
    const session = await verifySession(
      getCookie(request, COOKIE_NAME),
      env.SESSION_SECRET,
    );

    if (session) {
      return env.ASSETS.fetch(request);
    }

    // Not authenticated
    // JSON data requests (SPA fetching article content) — return 401 JSON
    // so the injected script can catch it and reload the page
    if (url.pathname.endsWith('.json')) {
      return new Response('{"error":"unauthorized"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // HTML page requests — show login form
    const returnTo = url.pathname + url.search;
    return new Response(loginPage(env.STRIPE_PAYMENT_LINK || '#', null, returnTo), {
      status: 401, headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },
};
