import { useState } from "react";
import { Link } from "react-router-dom";
import { api, json, message } from "../api";
import { useSession } from "../session";
import {
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  ResourceError,
  useResource,
} from "../components";
import { Article } from "./Post";
import type { Page, Post } from "../types";
export default function Reviews() {
  const { session, loading } = useSession();
  const resource = useResource<Page<Post>>(
    session?.user ? "/reviews?limit=50" : null,
  );
  const [selected, setSelected] = useState<Post | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const review = async (decision: "approve" | "request_changes") => {
    if (!selected) return;
    if (decision === "request_changes" && !note.trim()) {
      setError("请写下具体修改建议，让作者知道如何继续。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/posts/" + selected.id + "/review", {
        method: "POST",
        body: json({ decision, note: note.trim() }),
      });
      setSelected(null);
      setNote("");
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Loading />;
  if (!session?.user)
    return (
      <Empty title="团主的审核工作台">
        <p>登录后查看由你管理的社团公开投稿。</p>
        <Link className="btn" to="/login">
          登录
        </Link>
      </Empty>
    );
  return (
    <>
      <PageHead
        eyebrow="READ CAREFULLY, PUBLISH THOUGHTFULLY"
        title="公开投稿审核"
      >
        这里展示作者提交时的完整固定快照。后来编辑草稿，不会改变这一份投稿。
      </PageHead>
      <ErrorNote error={error} />
      {selected ? (
        <>
          <div className="reading-nav">
            <button
              className="quiet"
              onClick={() => {
                setSelected(null);
                setError("");
                setNote("");
              }}
            >
              ← 返回待审列表
            </button>
            <span className="tag">固定投稿快照</span>
          </div>
          <Article post={selected} />
          <section className="review-actions reading-width card pad">
            <h2>阅读完毕，写下决定</h2>
            <label>
              审核意见
              <textarea
                aria-label="审核意见"
                maxLength={2000}
                rows={3}
                placeholder="退回时请说明需要修改的地方"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="row wrap">
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void review("approve")}
              >
                通过并公开
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => void review("request_changes")}
              >
                退回修改
              </button>
            </div>
          </section>
        </>
      ) : resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ResourceError error={resource.error} reload={resource.reload} />
      ) : resource.data?.items.length ? (
        <div className="submission-list">
          {resource.data.items.map((post) => (
            <article key={post.id} className="card pad row between wrap">
              <div className="grow">
                <span className="category-label">
                  {post.club.name} · {post.author.display_name}
                </span>
                <h2>{post.title}</h2>
                <p className="muted">{post.summary}</p>
              </div>
              <button className="btn" onClick={() => setSelected(post)}>
                阅读完整投稿
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="待审栏暂时空着">
          <p>由你管理的社团收到公开投稿后，会出现在这里。</p>
          <Link className="btn" to="/clubs">
            回到社团
          </Link>
        </Empty>
      )}
    </>
  );
}
