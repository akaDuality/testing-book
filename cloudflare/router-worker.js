// Routes bookshelf.dev/testing-book/* to the Cloudflare Pages project.
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
    const response = await fetch(new Request(url, request));

    // Rewrite Location headers on redirects so the prefix is preserved.
    // Without this, a Pages redirect to /documentation/... would lose
    // the /testing-book prefix and get caught by other workers.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        const locUrl = new URL(location, url);
        if (locUrl.hostname === url.hostname && !locUrl.pathname.startsWith(PREFIX)) {
          locUrl.hostname = new URL(request.url).hostname;
          locUrl.pathname = PREFIX + locUrl.pathname;
          return Response.redirect(locUrl.toString(), response.status);
        }
      }
    }

    return response;
  },
};
