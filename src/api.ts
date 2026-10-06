export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
let csrfToken = "";
export function setCsrfToken(token: string) {
  csrfToken = token;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("X-CSRF-Token", csrfToken);
  let response: Response;
  try {
    response = await fetch("/api/v1" + path, {
      ...options,
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "网络连接失败，内容仍保留在当前页面，请稍后重试。",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "服务器暂时无法响应，请稍后重试。",
    );
  }
  const payload = data as {
    error?: { code?: string; message?: string; details?: unknown };
    csrf_token?: string;
  };
  if (!response.ok)
    throw new ApiError(
      response.status,
      payload.error?.code || "REQUEST_FAILED",
      payload.error?.message || "请求失败，请稍后重试。",
      payload.error?.details,
    );
  if (typeof payload.csrf_token === "string") setCsrfToken(payload.csrf_token);
  return data as T;
}
export const json = (value: unknown) => JSON.stringify(value);
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "操作失败，请稍后重试。";
