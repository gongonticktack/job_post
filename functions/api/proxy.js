const ALLOWED_HOSTS = new Set([
  "www.jobs.global.fujitsu.com",
  "nttdata-career.jposting.net"
]);

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  let target;
  try {
    target = new URL(payload.url);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (!["https:"].includes(target.protocol) || !ALLOWED_HOSTS.has(target.hostname)) {
    return new Response("Target host is not allowed", { status: 403 });
  }

  const method = String(payload.method || "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    return new Response("Method is not allowed", { status: 405 });
  }

  const headers = new Headers();
  const requestedHeaders = payload.headers || {};
  if (requestedHeaders["Content-Type"] || requestedHeaders["content-type"]) {
    headers.set("Content-Type", requestedHeaders["Content-Type"] || requestedHeaders["content-type"]);
  }

  const upstream = await fetch(target.href, {
    method,
    headers,
    body: method === "POST" ? payload.body || "" : undefined
  });

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders
  });
}
