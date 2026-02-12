// app/api/video-proxy/route.ts
// Streams video from a Google-hosted URI (that requires the API key) to the client.
// Used as <video src="/api/video-proxy?uri=..."> so the browser can play it directly.

const INFRAME_API_KEY = process.env.INFRAME_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uri = searchParams.get("uri");

  if (!uri) {
    return new Response("Missing uri parameter", { status: 400 });
  }

  if (!INFRAME_API_KEY) {
    return new Response("API key not configured", { status: 500 });
  }

  try {
    // Append API key to the Google-hosted URI
    const fetchUrl = uri.includes("?")
      ? `${uri}&key=${INFRAME_API_KEY}`
      : `${uri}?key=${INFRAME_API_KEY}`;

    const upstream = await fetch(fetchUrl);

    if (!upstream.ok) {
      console.error("Video proxy upstream error:", upstream.status, await upstream.text().catch(() => ""));
      return new Response("Failed to fetch video", { status: 502 });
    }

    // Stream the video body directly to the client
    const contentType = upstream.headers.get("content-type") || "video/mp4";
    const contentLength = upstream.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("Video proxy error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
