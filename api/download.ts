const repository = "rmach816/closeout-readiness-check";
const headers = {
  "cache-control": "no-store, max-age=0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
  "x-robots-tag": "noindex"
};

export async function GET(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { ...headers, allow: "GET, HEAD" } });
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "closeout-readiness-check", "x-github-api-version": "2026-03-10", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) throw new Error("Release lookup unavailable");
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("Invalid release response");
    const release = payload as Record<string, unknown>;
    if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== "string" || !/^v\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) throw new Error("Invalid published release");
    const filename = `closeout-readiness-check-${release.tag_name.slice(1)}.mcpb`;
    const destination = `https://github.com/${repository}/releases/download/${release.tag_name}/${filename}`;
    const asset = release.assets.find((item: { name?: string } | null) => item?.name === filename);
    if (!asset || asset.state !== "uploaded" || !(asset.size > 0) || asset.browser_download_url !== destination) throw new Error("Latest package is unavailable");
    return new Response(null, { status: 307, headers: { ...headers, location: destination } });
  } catch {
    return new Response('The latest download could not be checked. Please try again shortly, or visit https://github.com/rmach816/closeout-readiness-check/releases/latest. Support: richard@m2ai.tech', {
      status: 503, headers: { ...headers, "content-type": "text/plain; charset=utf-8", "retry-after": "30" }
    });
  }
}

export const HEAD = GET;
