// Serves the Vite app from static assets and forwards /api/* to the PDF
// engine on Render (api.codingmarvel.com), as the old Vercel rewrite did.

interface Env {
  ASSETS: Fetcher;
}

const API_ORIGIN = 'https://api.codingmarvel.com';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, API_ORIGIN);
      return fetch(new Request(target, request));
    }
    return env.ASSETS.fetch(request);
  },
};
