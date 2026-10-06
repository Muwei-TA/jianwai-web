import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError, setCsrfToken } from "../src/api";
afterEach(() => vi.unstubAllGlobals());
it("rejects 401 and 409 with server code instead of reporting success", async () => {
  for (const [status, code] of [
    [401, "AUTH_REQUIRED"],
    [409, "STALE_DRAFT"],
  ] as const) {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ error: { code, message: "请保留当前输入" } }),
          { status },
        ),
    );
    await expect(api("/drafts/a", { method: "PUT" })).rejects.toMatchObject({
      status,
      code,
      message: "请保留当前输入",
    });
  }
});
it("sends same-origin credentials and current CSRF, and refreshes session token", async () => {
  let received: RequestInit | undefined;
  vi.stubGlobal("fetch", async (_url: string, opts: RequestInit) => {
    received = opts;
    return new Response(
      JSON.stringify({ user: null, csrf_token: "new-token" }),
    );
  });
  setCsrfToken("old-token");
  await api("/auth/session");
  await api("/auth/login", { method: "POST", body: JSON.stringify({}) });
  expect(received?.credentials).toBe("same-origin");
  expect(new Headers(received?.headers).get("X-CSRF-Token")).toBe("new-token");
});
it("reports malformed and network responses as failures", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response("<html>down</html>", { status: 502 }),
  );
  await expect(api("/drafts")).rejects.toBeInstanceOf(ApiError);
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline");
  });
  await expect(api("/drafts")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
});
