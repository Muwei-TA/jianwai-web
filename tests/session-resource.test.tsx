// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";
import { PostFeed, useResource } from "../src/components";
import { SessionProvider, useSession } from "../src/session";
import EditorPage from "../src/pages/Editor";
import type { Draft, Post, Session } from "../src/types";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const account = (id: string, csrf_token = "csrf-" + id): Session => ({
  user: {
    id,
    email: id + "@example.com",
    display_name: id,
    email_verified: true,
    is_member: true,
  },
  csrf_token,
});
const story = (title: string): Post => ({
  id: title,
  title,
  summary: title + " 摘要",
  body: { type: "doc", content: [{ type: "paragraph" }] },
  club_id: "club",
  scope: "club",
  tags: [],
  feedback_intent: "",
  cover_asset_id: null,
  author: { id: "a", display_name: "作者" },
  club: { id: "club", name: "私密社团", slug: "private" },
  status: "published",
  created_at: "2026-10-06T00:00:00Z",
  comment_count: 0,
});
let root: Root | undefined;
let container: HTMLDivElement;
let updateSession!: (session: Session) => void;
let refreshSession!: () => Promise<Session>;
function SessionControls() {
  const { setSession, refresh } = useSession();
  updateSession = setSession;
  refreshSession = refresh;
  return null;
}
async function mount(child: React.ReactNode, route = "/", entry = route) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const router = createMemoryRouter(
    [{ element: <App />, children: [{ path: route, element: child }] }],
    { initialEntries: [entry] },
  );
  await act(async () => {
    root!.render(
      <SessionProvider>
        <SessionControls />
        <RouterProvider router={router} />
      </SessionProvider>,
    );
  });
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("logout on the homepage clears previously authorized titles and fetches an anonymous feed", async () => {
  let session: Session = account("a");
  let feedRequests = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/logout")) {
      session = { user: null, csrf_token: "guest" };
      return Response.json({ ok: true });
    }
    if (url.endsWith("/auth/session")) return Response.json(session);
    if (url.includes("/posts?")) {
      feedRequests++;
      return Response.json({
        items: session.user ? [story("账号A的私密标题")] : [],
        total: session.user ? 1 : 0,
      });
    }
    throw new Error("Unexpected request " + url);
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  await mount(<PostFeed path="/posts" />);
  expect(container.textContent).toContain("账号A的私密标题");
  const logout = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "退出",
  )!;
  await act(async () => {
    logout.click();
  });
  expect(container.textContent).not.toContain("账号A的私密标题");
  expect(container.textContent).not.toContain("账号A的私密标题 摘要");
  expect(feedRequests).toBeGreaterThanOrEqual(2);
});

it("changing account removes old data before the new response", async () => {
  let session = account("a");
  let releaseB!: (response: Response) => void;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/session")) return Response.json(session);
    if (url.includes("/posts?"))
      return session.user?.id === "a"
        ? Response.json({ items: [story("账号A私密内容")], total: 1 })
        : await new Promise<Response>((resolve) => {
            releaseB = resolve;
          });
    throw new Error("Unexpected request " + url);
  });
  await mount(<PostFeed path="/posts" />);
  expect(container.textContent).toContain("账号A私密内容");
  session = account("b");
  await act(async () => {
    updateSession(session);
  });
  expect(container.textContent).not.toContain("账号A私密内容");
  expect(container.textContent).toContain("正在打开");
  await act(async () => {
    releaseB(Response.json({ items: [story("账号B私密内容")], total: 1 }));
  });
  expect(container.textContent).toContain("账号B私密内容");
  expect(container.textContent).not.toContain("账号A私密内容");
});

it("CSRF-only refresh keeps the same resource and mounted unsaved editor state", async () => {
  let session = account("a");
  let resourceRequests = 0;
  let mounts = 0;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/session")) return Response.json(session);
    resourceRequests++;
    return Response.json({ text: "saved" });
  });
  function EditorProbe() {
    const [text] = useState("尚未保存的输入");
    const resource = useResource<{ text: string }>("/drafts/probe");
    useEffect(() => {
      mounts++;
    }, []);
    return (
      <div>
        {text}:{resource.data?.text}
      </div>
    );
  }
  await mount(<EditorProbe />);
  const previousRequests = resourceRequests;
  session = account("a", "rotated-csrf");
  await act(async () => {
    await refreshSession();
  });
  expect(container.textContent).toContain("尚未保存的输入:saved");
  expect(resourceRequests).toBe(previousRequests);
  expect(mounts).toBe(1);
});

it("a late response from the previous account cannot repopulate the current resource", async () => {
  let session = account("a"),
    aRequests = 0;
  let releaseOld!: (response: Response) => void;
  let reloadResource!: () => void;
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/session")) return Response.json(session);
    if (session.user?.id === "a") {
      aRequests++;
      if (aRequests === 1) return Response.json({ text: "账号A内容" });
      return await new Promise<Response>((resolve) => {
        releaseOld = resolve;
      });
    }
    return Response.json({ text: "账号B内容" });
  });
  function ResourceProbe() {
    const resource = useResource<{ text: string }>("/posts/probe");
    reloadResource = resource.reload;
    return <div>{resource.data?.text}</div>;
  }
  await mount(<ResourceProbe />);
  await act(async () => {
    reloadResource();
  });
  session = account("b");
  await act(async () => {
    updateSession(session);
  });
  expect(container.textContent).toContain("账号B内容");
  await act(async () => {
    releaseOld(Response.json({ text: "迟到的账号A内容" }));
  });
  expect(container.textContent).toContain("账号B内容");
  expect(container.textContent).not.toContain("迟到的账号A内容");
});

it("the real dirty editor survives CSRF refresh and cancels logout before any server mutation", async () => {
  let logoutRequests = 0,
    draftRequests = 0;
  let editorSession = account("a");
  const draft: Draft = {
    id: "draft",
    revision: 1,
    updated_at: "2026-10-06T00:00:00Z",
    title: "已保存标题",
    summary: "",
    body: { type: "doc", content: [{ type: "paragraph" }] },
    club_id: null,
    scope: "club",
    tags: [],
    feedback_intent: "",
    cover_asset_id: null,
  };
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/auth/logout")) {
      logoutRequests++;
      return Response.json({ ok: true });
    }
    if (url.endsWith("/auth/session")) return Response.json(editorSession);
    if (url.includes("/drafts/draft")) {
      draftRequests++;
      return Response.json(draft);
    }
    if (url.includes("/clubs")) return Response.json({ items: [], total: 0 });
    throw new Error("Unexpected request " + url);
  });
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await mount(<EditorPage />, "/write/:id", "/write/draft");
  const title = container.querySelector<HTMLTextAreaElement>(
    '[aria-label="文章标题"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(title, "尚未保存的新标题");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("有未保存修改");
  const requestsBeforeRefresh = draftRequests;
  editorSession = account("a", "new-csrf");
  await act(async () => {
    await refreshSession();
  });
  expect(container.querySelector('[aria-label="文章标题"]')).toBe(title);
  expect(title.value).toBe("尚未保存的新标题");
  expect(draftRequests).toBe(requestsBeforeRefresh);
  const logout = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "退出",
  )!;
  await act(async () => {
    logout.click();
  });
  expect(logoutRequests).toBe(0);
  expect(title.value).toBe("尚未保存的新标题");
  expect(window.confirm).toHaveBeenCalledWith(
    expect.stringContaining("还有未保存内容"),
  );
});
