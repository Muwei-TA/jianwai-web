import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, message } from "./api";
import type { Page, Post } from "./types";
import { assetUrl } from "./editor/safety";
import { useSession } from "./session";
export const scopeNames = {
  club: "社团内",
  members: "社区成员",
  public: "公开",
};
export const statusNames = {
  pending: "等待公开审核",
  published: "已发布",
  changes_requested: "需要修改",
  withdrawn: "已撤回",
};
export const date = (value: string) =>
  new Date(value).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
export function ErrorNote({ error }: { error: string }) {
  return error ? (
    <div className="error-note" role="alert">
      {error}
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">间</span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <div className="muted">{children}</div>
      </div>
      {action}
    </header>
  );
}
export function useResource<T>(path: string | null) {
  const { session, loading: sessionLoading } = useSession();
  // CSRF rotation does not change read permissions or remount an editing page.
  const principal = session?.user
    ? `${session.user.id}:${session.user.email_verified}:${session.user.is_member}`
    : "anonymous";
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([path, version, principal]);
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({
    key: "",
    data: null,
    error: "",
    loading: !!path,
  });
  useEffect(() => {
    const controller = new AbortController();
    if (sessionLoading) return;
    setResult({ key, data: null, error: "", loading: !!path });
    if (!path) return;
    void api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key, data, error: "", loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, data: null, error: message(error), loading: false });
      });
    return () => controller.abort();
  }, [path, key, sessionLoading]);
  // Mask old responses during the render that changes identity, before effects run.
  const current =
    result.key === key && !sessionLoading
      ? result
      : { data: null, error: "", loading: !!path };
  return {
    ...current,
    reload: () => setVersion((value) => value + 1),
    setData: (data: T | null) =>
      setResult({ key, data, error: "", loading: false }),
  };
}
export function Loading() {
  return (
    <p className="loading" role="status">
      正在打开这一页…
    </p>
  );
}
export function ResourceError({
  error,
  reload,
}: {
  error: string;
  reload: () => void;
}) {
  return (
    <div>
      <ErrorNote error={error} />
      <button className="btn" onClick={reload}>
        重新加载
      </button>
    </div>
  );
}
export function PostCard({
  post,
  featured = false,
}: {
  post: Post;
  featured?: boolean;
}) {
  return (
    <article className={"post-card" + (featured ? " featured" : "")}>
      <Link to={"/posts/" + post.id} className="post-art">
        {post.cover_asset_id ? (
          <img src={assetUrl(post.cover_asset_id)} alt="" loading="lazy" />
        ) : (
          <div className="typographic-cover">
            <span>JIANWAI / JOURNAL</span>
            <strong>{post.club.name}</strong>
            <i>一份来自兴趣的分享</i>
          </div>
        )}
      </Link>
      <div className="post-copy">
        <div className="meta">
          <Link to={"/clubs/" + post.club.id}>{post.club.name}</Link>
          <span>{scopeNames[post.scope]}</span>
        </div>
        <h2>
          <Link to={"/posts/" + post.id}>{post.title}</Link>
        </h2>
        <p>{post.summary || "打开文章，读一读作者的想法。"}</p>
        <div className="byline">
          <span className="avatar">{post.author.display_name.slice(0, 1)}</span>
          <span>{post.author.display_name}</span>
          <time>{date(post.created_at)}</time>
          <span className="comment-count">{post.comment_count} 条交流</span>
        </div>
      </div>
    </article>
  );
}
export function PostFeed({
  path,
  emptyTitle = "这一页，等你来写",
}: {
  path: string;
  emptyTitle?: string;
}) {
  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [path]);
  const resource = useResource<Page<Post>>(
    path + (path.includes("?") ? "&" : "?") + "limit=12&offset=" + offset,
  );
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ResourceError error={resource.error} reload={resource.reload} />;
  const items = resource.data?.items || [];
  return (
    <>
      {items.length ? (
        <div className="post-grid">
          {items.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              featured={offset === 0 && i === 0}
            />
          ))}
        </div>
      ) : (
        <Empty title={emptyTitle}>
          <p>让作品有一个去处，也让交流慢慢发生。</p>
          <Link className="btn soft" to="/workspace">
            去创作间
          </Link>
        </Empty>
      )}
      {!!resource.data?.total && (
        <div className="pagination">
          <button
            className="btn"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 12))}
          >
            上一页
          </button>
          <span>
            {offset + 1}–{offset + items.length} / {resource.data.total}
          </span>
          <button
            className="btn"
            disabled={offset + 12 >= resource.data.total}
            onClick={() => setOffset(offset + 12)}
          >
            下一页
          </button>
        </div>
      )}
    </>
  );
}
