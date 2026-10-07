import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "./session";
import { api, json, message } from "./api";
import { ErrorNote } from "./components";
export default function App() {
  const { session, loading, error, refresh, setSession } = useSession(),
    navigate = useNavigate(),
    location = useLocation();
  const [logoutError, setLogoutError] = useState(""),
    [busy, setBusy] = useState(false);
  const logout = async () => {
    if (
      !window.dispatchEvent(
        new Event("jianwai:beforeLogout", { cancelable: true }),
      )
    )
      return;
    if (!window.confirm("确定退出当前账号？")) return;
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST", body: json({}) });
      // The server has ended this identity even if the following token refresh fails.
      setSession({ user: null, csrf_token: "" });
      await refresh();
      navigate("/");
    } catch (e) {
      setLogoutError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="wordmark" aria-label="黑匣子首页">
            黑匣子<span>BLACK BOX</span>
          </Link>
          <nav className="primary-nav" aria-label="主导航">
            <NavLink to="/" end>
              发现
            </NavLink>
            <NavLink to="/clubs">我的社团</NavLink>
            <NavLink to="/workspace">创作间</NavLink>
            {session?.user && <NavLink to="/reviews">审核</NavLink>}
          </nav>
          <div className="header-actions">
            <Link className="join-link" to="/join">
              邀请码入团
            </Link>
            {loading ? (
              <span className="muted small">连接中</span>
            ) : session?.user ? (
              <>
                <span className="avatar" title={session.user.display_name}>
                  {session.user.display_name.slice(0, 1)}
                </span>
                <button className="quiet" disabled={busy} onClick={logout}>
                  退出
                </button>
              </>
            ) : (
              <Link className="btn primary compact" to="/login">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className={location.pathname === "/" ? "main home-main" : "main"}>
        <ErrorNote error={logoutError || error} />
        {error && (
          <button
            className="btn"
            onClick={() => void refresh().catch(() => {})}
          >
            重新连接
          </button>
        )}
        {session?.user && !session.user.email_verified && (
          <div className="notice">
            请先验证邮箱，再接受邀请、创作和发布。
            <Link to="/verify">去验证 →</Link>
          </div>
        )}
        <Outlet />
      </main>
      <footer className="site-footer">
        <Link className="wordmark" to="/">
          黑匣子
        </Link>
        <p>给兴趣一个房间，给表达一份回声。</p>
        <span>BLACK BOX · INVITATION ONLY</span>
      </footer>
      <nav className="mobile-nav" aria-label="移动导航">
        <NavLink to="/" end>
          发现
        </NavLink>
        <NavLink to="/clubs">我的社团</NavLink>
        <NavLink to="/workspace">创作间</NavLink>
        <NavLink to="/join">入团</NavLink>
      </nav>
    </>
  );
}
