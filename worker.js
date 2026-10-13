import { onRequestPost, onRequestOptions } from "./functions/api/proxy.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/proxy") {
      if (request.method === "POST") return onRequestPost({ request });
      if (request.method === "OPTIONS") return onRequestOptions();
      return new Response("Method is not allowed", {
        status: 405,
        headers: { Allow: "POST, OPTIONS" }
      });
    }
    if (url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  }
};
