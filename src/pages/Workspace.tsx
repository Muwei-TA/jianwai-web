import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, json, message } from "../api";
import { useSession } from "../session";
import {
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  ResourceError,
  date,
  scopeNames,
  statusNames,
  useResource,
} from "../components";
import type { Draft, Page, Post } from "../types";
export default function Workspace() {
  const { session, loading } = useSession(),
    navigate = useNavigate();
  const user = session?.user;
  const drafts = useResource<Page<Draft>>(user ? "/drafts?limit=50" : null),
    posts = useResource<Page<Post>>(user ? "/me/posts?limit=50" : null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const draft = await api<Draft>("/drafts", {
        method: "POST",
        body: json({}),
      });
      navigate("/write/" + draft.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (draft: Draft) => {
    if (
      !confirm(
        "删除草稿「" + (draft.title || "未命名草稿") + "」？此操作无法恢复。",
      )
    )
      return;
    try {
      await api("/drafts/" + draft.id, { method: "DELETE" });
      drafts.reload();
    } catch (e) {
      setError(message(e));
    }
  };
  if (loading) return <Loading />;
  if (!user)
    return (
      <Empty title="为想法，留一个创作间">
        <p>登录后，草稿会保存在你的账号里。</p>
        <Link className="btn primary" to="/login">
          登录并开始创作
        </Link>
      </Empty>
    );
  return (
    <>
      <PageHead
        eyebrow="YOUR WRITING ROOM"
        title={"你好，" + user.display_name + "。"}
        action={
          <button
            className="btn primary"
            disabled={busy || !user.email_verified}
            onClick={create}
          >
            新建草稿
          </button>
        }
      >
        想法可以慢慢写，喜欢的事值得认真分享。
      </PageHead>
      <ErrorNote error={error} />
      <div className="workspace-meta">
        <span>
          账号 ID：<code>{user.id}</code>
        </span>
        <span>
          {user.is_member ? "社区成员" : "接受一份邀请，成为社区成员"}
        </span>
      </div>
      <div className="section-head">
        <h2>
          我的云草稿 <span>DRAFTS</span>
        </h2>
        <p>保存与发布，是两件不同的事。</p>
      </div>
      {drafts.loading ? (
        <Loading />
      ) : drafts.error ? (
        <ResourceError error={drafts.error} reload={drafts.reload} />
      ) : drafts.data?.items.length ? (
        <div className="draft-grid">
          {drafts.data.items.map((draft) => (
            <article className="draft-card card pad" key={draft.id}>
              <span className="eyebrow">REVISION {draft.revision}</span>
              <h2>
                <Link to={"/write/" + draft.id}>
                  {draft.title || "未命名草稿"}
                </Link>
              </h2>
              <p>{draft.summary || "从一个念头开始，慢慢把它写完整。"}</p>
              <div className="row between">
                <span className="helper">
                  {date(draft.updated_at)} · {scopeNames[draft.scope]}
                </span>
                <button className="quiet" onClick={() => void remove(draft)}>
                  删除草稿
                </button>
              </div>
              <Link className="link" to={"/write/" + draft.id}>
                继续写作 →
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="第一句话，从这里开始">
          <p>新建一篇草稿，文字、图片和格式都能保存在云端。</p>
          <p className="helper">用右上角的「新建草稿」，开始第一篇作品。</p>
        </Empty>
      )}
      <div className="section-head">
        <h2>
          我的作品与投稿 <span>SUBMISSIONS</span>
        </h2>
      </div>
      {posts.loading ? (
        <Loading />
      ) : posts.error ? (
        <ResourceError error={posts.error} reload={posts.reload} />
      ) : posts.data?.items.length ? (
        <div className="submission-list">
          {posts.data.items.map((post) => (
            <article key={post.id} className="card pad">
              <div className="row between wrap">
                <h3>
                  <Link to={"/posts/" + post.id}>{post.title}</Link>
                </h3>
                <span
                  className={
                    "tag " +
                    (post.status === "changes_requested" ? "orange" : "")
                  }
                >
                  {statusNames[post.status]}
                </span>
              </div>
              <p className="helper">
                {post.club.name} · {scopeNames[post.scope]} ·{" "}
                {date(post.created_at)}
              </p>
              {post.review_note && (
                <p className="review-note">团主意见：{post.review_note}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="quiet-empty">完成创作后，作品的发布状态会显示在这里。</p>
      )}
    </>
  );
}
