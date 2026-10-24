// Typed fetch wrapper for /api (same origin; Vite proxies it in dev). Shared zone: add, don't rewrite.

export const FLIGHT_ID = "JL740-20261025"
export const POLL_MS = 2000

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "ApiError"
    this.status = status
  }
}

async function detailOf(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail
      return typeof detail === "string" ? detail : JSON.stringify(detail)
    }
  } catch {
    // not JSON: fall through to the status text
  }
  return res.statusText || `HTTP ${res.status}`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check the connection and try again.")
  }
  if (!res.ok) throw new ApiError(res.status, await detailOf(res))
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}): Promise<T> => request<T>("POST", path, body),
}
