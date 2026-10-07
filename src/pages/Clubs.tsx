import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, json, message } from "../api";
import { useSession } from "../session";
import {
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  PostFeed,
  ResourceError,
  date,
  useResource,
} from "../components";
import type { Club, Invitation, Page } from "../types";
export function Clubs() {
  const resource = useResource<Page<Club>>("/clubs");
  return (
    <>
      <PageHead eyebrow="YOUR CLUBS" title="我的社团">
        这里是你已加入的社团。使用邀请码，可以加入新的社团。
      </PageHead>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ResourceError error={resource.error} reload={resource.reload} />
      ) : resource.data?.items.length ? (
        <div className="club-grid">
          {resource.data.items.map((club, i) => (
            <Link key={club.id} className="club-card" to={"/clubs/" + club.id}>
              <div className={"club-graphic tone-" + (i % 4)}>
                <span>BLACK BOX / CLUB {String(i + 1).padStart(2, "0")}</span>
                <strong>{club.name}</strong>
                <i />
              </div>
              <div className="pad">
                <h2>{club.name}</h2>
                <p>{club.description}</p>
                <div className="row between">
                  <span className="muted small">
                    {club.member_count} 位同好
                  </span>
                  <span className="tag">已加入</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="你还没有加入社团">
          <p>输入朋友给你的邀请码，加入对应的社团。</p>
          <Link className="btn soft" to="/join">
            使用邀请码
          </Link>
        </Empty>
      )}
    </>
  );
}
export function ClubPage() {
  const { id } = useParams();
  const resource = useResource<Club>("/clubs/" + id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const leave = async () => {
    if (!confirm("离开社团后将无法阅读团内内容，确定离开？")) return;
    try {
      await api("/clubs/" + id + "/membership", { method: "DELETE" });
      navigate("/clubs");
    } catch (e) {
      setError(message(e));
    }
  };
  if (resource.loading) return <Loading />;
  if (resource.error)
    return <ResourceError error={resource.error} reload={resource.reload} />;
  const club = resource.data;
  if (!club) return null;
  return (
    <>
      <PageHead
        eyebrow="AN INTEREST, A CONNECTION"
        title={club.name}
        action={
          <div className="row wrap">
            {club.my_role && (
              <Link className="btn primary" to="/workspace">
                写一篇新作品
              </Link>
            )}
          </div>
        }
      >
        {club.description}
        <p className="small">
          {club.member_count} 位同好 ·{" "}
          {club.my_role === "owner" ? "你是团主" : "你已加入这个社团"}
        </p>
      </PageHead>
      <ErrorNote error={error} />
      {club.can_invite && <InvitationManager club={club} />}
      <div className="section-head">
        <h2>社团里的声音</h2>
        {club.my_role === "member" && (
          <button className="quiet" onClick={leave}>
            离开社团
          </button>
        )}
        {club.my_role === "owner" && (
          <span className="helper">团主需完成身份转移后才能离团。</span>
        )}
      </div>
      <PostFeed
        path={"/posts?club_id=" + encodeURIComponent(club.id)}
        emptyTitle="好话题，从第一篇分享开始"
      />
    </>
  );
}
function InvitationManager({ club }: { club: Club }) {
  const resource = useResource<Page<Invitation>>(
    "/clubs/" + club.id + "/invites",
  );
  const members = useResource<
    Page<{
      user_id: string;
      display_name: string;
      role: "owner" | "member";
      can_invite: boolean;
      joined_at: string;
    }>
  >(
    club.my_role === "owner" ? "/clubs/" + club.id + "/members?limit=50" : null,
  );
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(""),
    [permission, setPermission] = useState(true),
    [success, setSuccess] = useState("");
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await api<Invitation>("/clubs/" + club.id + "/invites", {
        method: "POST",
        body: json(
          email.trim() ? { bound_email: email.trim().toLowerCase() } : {},
        ),
      });
      setCode(next.code || "");
      resource.reload();
      setEmail("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    setError("");
    try {
      await api("/clubs/" + club.id + "/invites/" + id, { method: "DELETE" });
      resource.reload();
    } catch (e) {
      setError(message(e));
    }
  };
  const toggleMember = async (userId: string, allowed: boolean) => {
    setError("");
    setBusy(true);
    try {
      await api(
        "/clubs/" + club.id + "/members/" + userId + "/invite-permission",
        { method: "PATCH", body: json({ can_invite: allowed }) },
      );
      members.reload();
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(
        "/clubs/" +
          club.id +
          "/members/" +
          encodeURIComponent(target) +
          "/invite-permission",
        { method: "PATCH", body: json({ can_invite: permission }) },
      );
      setSuccess(
        permission
          ? "邀请权限已授予。"
          : "邀请权限已撤销，该成员的未使用邀请码一并失效。",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="invite-manager card pad">
      <summary>
        邀请同好 <span>管理邀请码与邀请权限</span>
      </summary>
      <ErrorNote error={error} />
      <form className="row wrap" onSubmit={create}>
        <label className="grow">
          绑定邮箱（可选）
          <input
            aria-label="绑定邮箱"
            type="email"
            placeholder="留空则不绑定邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          生成邀请码
        </button>
      </form>
      {code && (
        <div className="code-once">
          <strong>请现在复制，这个邀请码只显示一次。</strong>
          <code>{code}</code>
          <div className="row">
            <button
              className="btn"
              onClick={() =>
                void navigator.clipboard
                  .writeText(code)
                  .catch(() => setError("复制失败，请手动选择复制邀请码。"))
              }
            >
              复制邀请码
            </button>
            <button className="quiet" onClick={() => setCode("")}>
              我已保存，关闭显示
            </button>
          </div>
          <p className="helper">
            7 天有效，使用一次后失效。请仅发送给你希望邀请的人。
          </p>
        </div>
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ResourceError error={resource.error} reload={resource.reload} />
      ) : (
        <div className="invitation-list">
          {resource.data?.items.map((invite) => (
            <div key={invite.id} className="row wrap">
              <span className="grow">
                {invite.bound_email || "未绑定邮箱"}
                <small>{date(invite.expires_at)} 到期</small>
              </span>
              <span className="tag">
                {
                  {
                    active: "有效",
                    used: "已使用",
                    expired: "已过期",
                    revoked: "已撤销",
                  }[invite.status]
                }
              </span>
              {invite.status === "active" && (
                <button className="btn" onClick={() => void revoke(invite.id)}>
                  撤销邀请码
                </button>
              )}
            </div>
          ))}
          {!resource.data?.items.length && (
            <p className="helper">你还没有创建邀请码。</p>
          )}
        </div>
      )}
      {club.my_role === "owner" && (
        <form className="permission-form" onSubmit={grant}>
          <h3>成员邀请权限</h3>
          {members.loading ? (
            <Loading />
          ) : members.error ? (
            <ResourceError error={members.error} reload={members.reload} />
          ) : (
            <div className="invitation-list">
              {members.data?.items.map((member) => (
                <div className="row wrap" key={member.user_id}>
                  <span className="grow">
                    {member.display_name}
                    <small>
                      {member.role === "owner" ? "团主" : "成员"} ·{" "}
                      {member.can_invite ? "可以邀请" : "暂无邀请权"}
                    </small>
                  </span>
                  {member.role !== "owner" && (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() =>
                        void toggleMember(member.user_id, !member.can_invite)
                      }
                    >
                      {member.can_invite ? "撤销邀请权" : "授予邀请权"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="helper">
            输入该团成员的账号 ID。账号 ID 可在其本人创作间查看。
          </p>
          <div className="row wrap">
            <label className="grow">
              成员账号 ID
              <input
                aria-label="成员账号 ID"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label>
              权限
              <select
                aria-label="邀请权限"
                value={permission ? "yes" : "no"}
                onChange={(e) => setPermission(e.target.value === "yes")}
              >
                <option value="yes">允许邀请</option>
                <option value="no">撤销邀请</option>
              </select>
            </label>
            <button className="btn" disabled={busy}>
              更新邀请权限
            </button>
          </div>
          {success && (
            <p className="success" role="status">
              {success}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
export function Join() {
  const { session, refresh, loading } = useSession(),
    navigate = useNavigate();
  const [code, setCode] = useState(""),
    [preview, setPreview] = useState<{
      club: { id: string; name: string; description: string };
      expires_at: string;
      requires_email: boolean;
      status: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const inspect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await api("/invites/preview", {
          method: "POST",
          body: json({ code: code.trim() }),
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const redeem = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ club: Club }>("/invites/redeem", {
        method: "POST",
        body: json({ code: code.trim() }),
      });
      await refresh();
      navigate("/clubs/" + result.club.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="join-shell">
      <div className="join-copy">
        <span className="eyebrow">AN INVITATION TO BELONG</span>
        <h1>
          一份邀请，
          <br />
          一群同好。
        </h1>
        <p>
          社团里的交流，始于彼此的信任。
          <br />
          输入朋友送给你的邀请码，看看下一次相遇。
        </p>
        <div className="join-stamp">
          黑匣子
          <br />
          <span>LET'S MAKE SOMETHING.</span>
        </div>
      </div>
      <section className="card pad">
        <h2>打开你的邀请</h2>
        <p className="muted">先预览，再决定是否加入。预览不会使用邀请码。</p>
        <form onSubmit={inspect}>
          <label>
            邀请码
            <input
              aria-label="邀请码"
              required
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              autoComplete="off"
            />
          </label>
          <ErrorNote error={error} />
          <button className="btn full" disabled={busy || loading}>
            预览邀请
          </button>
        </form>
        {preview && (
          <div className="invite-preview">
            <span className="eyebrow">YOU ARE INVITED</span>
            <h2>{preview.club.name}</h2>
            <p>{preview.club.description}</p>
            <p className="helper">
              {date(preview.expires_at)} 到期 ·{" "}
              {preview.requires_email ? "需与邀请绑定邮箱一致" : "不限定邮箱"}
            </p>
            {!session?.user ? (
              <Link className="btn primary full" to="/login">
                登录后接受邀请
              </Link>
            ) : !session.user.email_verified ? (
              <Link className="btn primary full" to="/verify">
                验证邮箱后接受邀请
              </Link>
            ) : (
              <button
                className="btn primary full"
                disabled={busy || preview.status !== "active"}
                onClick={redeem}
              >
                接受邀请
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
