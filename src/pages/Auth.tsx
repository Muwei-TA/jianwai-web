import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, json, message } from "../api";
import { useSession } from "../session";
import { ErrorNote } from "../components";
import type { Session } from "../types";
export function Auth({ register = false }: { register?: boolean }) {
  const { setSession, refresh, loading } = useSession(),
    navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await api<Session>(
        register ? "/auth/register" : "/auth/login",
        {
          method: "POST",
          body: json({
            email: email.trim().toLowerCase(),
            password,
            ...(register ? { display_name: name.trim() } : {}),
          }),
        },
      );
      setSession(next);
      await refresh();
      navigate(register ? "/verify" : "/workspace");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div>
          <span className="eyebrow">A ROOM FOR WHAT MATTERS.</span>
          <h2>
            在黑匣子，
            <br />
            找到你的同好。
          </h2>
          <p>一份邀请，一段交流，一个创作的开始。</p>
        </div>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">WELCOME TO BLACK BOX</span>
        <h1>{register ? "初次相遇" : "欢迎回来"}</h1>
        <p className="muted">
          {register
            ? "先拥有一个账号，再接受社团邀请。"
            : "登录，接着写下你想分享的事。"}
        </p>
        <ErrorNote error={error} />
        {register && (
          <label>
            昵称
            <input
              aria-label="昵称"
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          邮箱
          <input
            aria-label="邮箱"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          密码
          <input
            aria-label="密码"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 10 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {!register && (
          <Link className="forgot-link" to="/forgot-password">
            忘记密码？
          </Link>
        )}
        {register && (
          <p className="helper">密码 10–128 个字符，昵称 2–30 个字符。</p>
        )}
        <button className="btn primary full" disabled={busy || loading}>
          {busy ? "正在连接…" : register ? "注册并发送验证邮件" : "登录"}
        </button>
        <p className="auth-switch">
          {register ? "已经有账号？" : "初次来到黑匣子？"}
          <Link to={register ? "/login" : "/register"}>
            {register ? "去登录" : "创建账号"}
          </Link>
        </p>
      </form>
    </div>
  );
}
export function Verify() {
  const { session, refresh, loading } = useSession();
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") || "",
  );
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("token"))
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
  }, []);
  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/auth/verify-email", {
        method: "POST",
        body: json({ token }),
      });
      await refresh();
      setSuccess("邮箱已验证，可以接受邀请了。");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/auth/resend-verification", {
        method: "POST",
        body: json({}),
      });
      setSuccess("验证邮件已发送，请检查收件箱与垃圾邮件。");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="narrow card pad">
      <span className="eyebrow">ONE MORE STEP</span>
      <h1>验证你的邮箱</h1>
      <p className="muted">
        通过邮箱中的链接完成验证。验证链接已从地址栏清除。
      </p>
      <ErrorNote error={error} />
      {success && (
        <p className="success" role="status">
          {success}
        </p>
      )}
      {session?.user?.email_verified ? (
        <>
          <p className="success">邮箱验证完成</p>
          <Link className="btn primary" to="/join">
            接受一份邀请
          </Link>
        </>
      ) : (
        <>
          {token ? (
            <button
              className="btn primary"
              disabled={busy || loading}
              onClick={verify}
            >
              验证邮箱
            </button>
          ) : (
            <p>请打开验证邮件中的链接。</p>
          )}
          {session?.user ? (
            <>
              <p className="helper">收件地址：{session.user.email}</p>
              <button
                className="btn"
                disabled={busy || loading}
                onClick={resend}
              >
                重新发送验证邮件
              </button>
            </>
          ) : (
            <Link className="btn" to="/login">
              登录账号
            </Link>
          )}
        </>
      )}
    </section>
  );
}

export function ForgotPassword() {
  const { loading } = useSession();
  const [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: json({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="narrow card pad">
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h1>找回密码</h1>
      <p className="muted">填写注册邮箱，我们会发送一封限时的重置邮件。</p>
      <ErrorNote error={error} />
      {sent && (
        <p className="success" role="status">
          如果这个邮箱已注册，重置链接会发送到该邮箱。请检查收件箱和垃圾邮件。
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          注册邮箱
          <input aria-label="注册邮箱" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy || loading}>
          {busy ? "正在发送…" : "发送重置邮件"}
        </button>
      </form>
      <Link className="recovery-back" to="/login">返回登录</Link>
    </section>
  );
}

export function ResetPassword() {
  const { refresh, loading } = useSession();
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") || "",
  );
  const [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("token"))
      window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: json({ token, new_password: newPassword }),
      });
      await refresh().catch(() => {});
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="narrow card pad">
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h1>设置新密码</h1>
      <p className="muted">重置链接只能使用一次，有效期为 30 分钟。</p>
      <ErrorNote error={error} />
      {done ? (
        <>
          <p className="success" role="status">密码已更新，请用新密码登录。</p>
          <Link className="btn primary" to="/login">去登录</Link>
        </>
      ) : token ? (
        <form onSubmit={submit}>
          <label>
            新密码
            <input aria-label="新密码" type="password" autoComplete="new-password"
              minLength={10} maxLength={128} required value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label>
            确认新密码
            <input aria-label="确认新密码" type="password" autoComplete="new-password"
              minLength={10} maxLength={128} required value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy || loading}>
            {busy ? "正在更新…" : "重置密码"}
          </button>
        </form>
      ) : (
        <p>重置链接无效，请重新申请。</p>
      )}
      <Link className="recovery-back" to="/forgot-password">重新申请重置邮件</Link>
    </section>
  );
}
