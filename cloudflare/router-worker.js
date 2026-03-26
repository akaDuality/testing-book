// Routes rubanov.dev/testing-book/* to the Cloudflare Pages project.
// Also redirects bare /documentation/* paths that DocC generates
// without the base prefix.
const PREFIX = '/testing-book';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // DocC SPA sometimes generates links without /testing-book prefix.
    // Redirect them to the correct path.
    if (!url.pathname.startsWith(PREFIX)) {
      url.pathname = PREFIX + url.pathname;
      return Response.redirect(url.toString(), 302);
    }

    // Strip prefix and proxy to the Cloudflare Pages project.
    url.hostname = 'testing-book.pages.dev';
    url.pathname = url.pathname.slice(PREFIX.length) || '/';
    return fetch(new Request(url, request));
  },
};
