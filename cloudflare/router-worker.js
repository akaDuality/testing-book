// Routes rubanov.dev/testing-book/* to the Cloudflare Pages project.
// All other paths pass through to the origin (GitHub Pages).
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'testing-book.pages.dev';
    return fetch(new Request(url, request));
  },
};
