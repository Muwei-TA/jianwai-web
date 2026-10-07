import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, json, message } from "../api";
import { useSession } from "../session";
import {
  ErrorNote,
  Loading,
  ResourceError,
  date,
  scopeNames,
  statusNames,
  useResource,
} from "../components";
import Body from "../editor/Body";
import { assetUrl } from "../editor/safety";
import type { Comment, Page, Post as PostType } from "../types";
export function Article({ post }: { post: PostType }) {
  return (
    <article className="reading-paper">
      <header className="article-head">
        <div className="row wrap">
          <span className="category-label">
            {post.club.name}
          </span>
          <span className="tag">{scopeNames[post.scope]}</span>
          {post.status !== "published" && (
            <span className="tag orange">{statusNames[post.status]}</span>
          )}
        </div>
        <h1>{post.title}</h1>
        {post.summary && <p className="article-summary">{post.summary}</p>}
        <div className="byline">
          <span className="avatar">{post.author.display_name.slice(0, 1)}</span>
          <span>{post.author.display_name}</span>
          <time>{date(post.created_at)}</time>
        </div>
      </header>
      {post.cover_asset_id && (
        <img
          className="article-cover"
          src={assetUrl(post.cover_asset_id)}
          alt="文章封面"
        />
      )}
      <Body body={post.body} />
      <footer className="article-end">
        <div className="row wrap">
          {post.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        {post.feedback_intent && <p>作者期待：{post.feedback_intent}</p>}
        <span>写到这里，把回声交给你。</span>
      </footer>
    </article>
  );
}
export default function Post() {
  const { id } = useParams();
  const { session } = useSession();
  const resource = useResource<PostType>("/posts/" + id);
  const comments = useResource<Page<Comment>>(
    resource.data?.status === "published"
      ? "/posts/" + id + "/comments?limit=50"
      : null,
  );
  const [body, setBody] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const comment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/posts/" + id + "/comments", {
        method: "POST",
        body: json({ body: body.trim() }),
      });
      setBody("");
      comments.reload();
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    if (!confirm("确定撤回这篇作品？读者将无法再看到。")) return;
    setError("");
    try {
      await api<{ id: string; status: "withdrawn" }>(
        "/posts/" + id + "/withdraw",
        { method: "POST", body: json({}) },
      );
      resource.reload();
    } catch (e) {
      setError(message(e));
    }
  };
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ResourceError error={resource.error} reload={resource.reload} />;
  const post = resource.data;
  if (!post) return null;
  return (
    <>
      <div className="reading-nav">
        <Link to="/">← 回到发现</Link>
        {session?.user?.id === post.author.id &&
          post.status !== "withdrawn" && (
            <button className="quiet" onClick={withdraw}>
              撤回作品
            </button>
          )}
      </div>
      <ErrorNote error={error} />
      {post.review_note && (
        <div className="notice reading-width">团主意见：{post.review_note}</div>
      )}
      <Article post={post} />
      {post.status === "published" && (
        <section className="comments reading-width">
          <div className="section-head">
            <h2>
              交流 <span>RESPONSES</span>
            </h2>
            <p>{comments.data?.total || 0} 条回声</p>
          </div>
          {session?.user?.is_member ? (
            <form onSubmit={comment}>
              <label className="sr-only" htmlFor="comment">
                评论内容
              </label>
              <textarea
                id="comment"
                aria-label="评论内容"
                required
                minLength={1}
                maxLength={2000}
                rows={3}
                placeholder="回应作品，也尊重创作的人。"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <div className="row between">
                <span className="helper">纯文字 · 最多 2000 字</span>
                <button className="btn primary" disabled={busy || !body.trim()}>
                  发送评论
                </button>
              </div>
            </form>
          ) : (
            <p className="comment-notice">
              社区成员可以参与交流。
              <Link to={session?.user ? "/join" : "/login"}>
                {session?.user ? "接受邀请" : "登录"} →
              </Link>
            </p>
          )}
          {comments.loading ? (
            <Loading />
          ) : comments.error ? (
            <ResourceError error={comments.error} reload={comments.reload} />
          ) : comments.data?.items.length ? (
            comments.data.items.map((item) => (
              <article className="comment" key={item.id}>
                <div className="byline">
                  <span className="avatar">
                    {item.author.display_name.slice(0, 1)}
                  </span>
                  <strong>{item.author.display_name}</strong>
                  <time>{date(item.created_at)}</time>
                </div>
                <p>{item.body}</p>
              </article>
            ))
          ) : (
            <p className="quiet-empty">还没有回声，第一句回应可能来自你。</p>
          )}
        </section>
      )}
    </>
  );
}
