// Routes rubanov.dev/testing-book/* to the Cloudflare Pages project.
// Strips the /testing-book prefix since DocC --hosting-base-path
// only changes internal URLs, not the actual file structure.
const PREFIX = '/testing-book';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'testing-book.pages.dev';
    url.pathname = url.pathname.slice(PREFIX.length) || '/';
    return fetch(new Request(url, request));
  },
};
