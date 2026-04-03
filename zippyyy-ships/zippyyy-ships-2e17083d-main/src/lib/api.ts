/** Optional full origin for the Ships API (e.g. https://api.example.com). Empty = same-origin. */
const API_BASE = String(import.meta.env.VITE_SHIPS_API_BASE ?? "").replace(/\/$/, "");

function resolveApiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export async function apiPost<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const res = await fetch(resolveApiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return (await res.json()) as TResponse;
}

export async function apiGet<TResponse>(path: string): Promise<TResponse> {
  const res = await fetch(resolveApiUrl(path));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as TResponse;
}

