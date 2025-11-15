export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return jsonError("Missing ?url= parameter", 400);
    }

    let targetURL: URL;
    try {
      targetURL = new URL(target);
    } catch {
      return jsonError("Invalid target URL", 400);
    }

    if (targetURL.protocol !== "https:") {
      return jsonError("Only https targets are allowed", 400);
    }

    const init: RequestInit = {
      method: request.method,
      headers: buildForwardHeaders(request.headers, targetURL),
      body: mayHaveBody(request.method) ? request.body : null,
      redirect: "manual",
    };

    let upstream: Response;
    try {
      upstream = await fetch(targetURL.toString(), init);
    } catch (error) {
      return jsonError(`Failed to reach upstream: ${String(error)}`, 502);
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("access-control-allow-origin", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function mayHaveBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function buildForwardHeaders(source: Headers, target: URL): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (hopByHopHeaders.has(key.toLowerCase())) {
      return;
    }
    headers.set(key, value);
  });
  headers.set("host", target.host);
  return headers;
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}
