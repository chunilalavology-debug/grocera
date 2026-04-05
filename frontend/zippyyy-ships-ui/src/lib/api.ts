/** Optional full origin for the Ships API (e.g. https://api.example.com). Empty = same-origin. */
const API_BASE = String(import.meta.env.VITE_SHIPS_API_BASE ?? "").replace(/\/$/, "");

/** Exported so UI can choose grocery quote fallback when ships base is unset (embedded CRA build). */
export const SHIPS_API_BASE = API_BASE;

/**
 * Grocery API base (e.g. `/api` or `https://zippyyy.com/api`). When set, checkout uses
 * `POST …/user/shipping/checkout`. Production builds in this repo set `VITE_GROCERA_API_BASE=/api`
 * so the main-site embed hits the same-origin grocery API.
 */
export const GROCERA_API_BASE = String(import.meta.env.VITE_GROCERA_API_BASE ?? "").replace(/\/$/, "");

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

export async function groceraApiPost<TResponse>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<TResponse> {
  if (!GROCERA_API_BASE) {
    throw new Error("VITE_GROCERA_API_BASE is not set.");
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${GROCERA_API_BASE}${p}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const msg =
      parsed &&
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : text || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return parsed as TResponse;
}

