import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead, PostFeed, useResource } from "../components";
import type { Club, Page } from "../types";
export default function Home() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const clubs = useResource<Page<Club>>("/clubs");
  return (
    <>
      <PageHead
        eyebrow="A PLACE FOR YOUR CURIOSITY"
        title="在兴趣之间，相遇。"
        action={
          <div className="issue">
            Jianwai<span>一本由你我写下的日常刊物</span>
          </div>
        }
      >
        电影、游戏、阅读与创作。把喜欢的事，认真聊一聊。
      </PageHead>
      <div className="interest-strip">
        <span>我的社团</span>
        {clubs.data?.items.slice(0, 5).map((club) => (
          <Link key={club.id} to={"/clubs/" + club.id}>
            <i style={{ background: club.accent || "#8b957c" }} />
            {club.name}
          </Link>
        ))}
        <Link to={clubs.data?.items.length ? "/clubs" : "/join"} className="all-clubs">
          {clubs.data?.items.length ? "查看我的社团 ↗" : "使用邀请码 ↗"}
        </Link>
      </div>
      <section className="magazine-section">
        <div className="section-head">
          <div>
            <h2>
              来自间外 <span>FROM THE COMMUNITY</span>
            </h2>
            <p>好作品与有意思的想法，值得慢下来读。</p>
          </div>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
            }}
          >
            <input
              aria-label="搜索文章"
              placeholder="寻找一篇文章"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button aria-label="搜索">↗</button>
          </form>
        </div>
        <PostFeed
          path={"/posts" + (query ? "?q=" + encodeURIComponent(query) : "")}
          emptyTitle={
            query ? "还没有找到这篇文章" : "我们的第一篇故事，正在路上"
          }
        />
      </section>
      <section className="editorial-note">
        <img src="/assets/window-light.svg" alt="暖色窗光中的阅读角落" />
        <div>
          <span className="eyebrow">MAKE ROOM FOR WHAT YOU LOVE</span>
          <h2>
            留一处空间，
            <br />
            给认真喜欢的事。
          </h2>
          <p>
            间外由一个个兴趣社团组成。你可以安静阅读，也可以接受朋友的邀请，加入一场有来有回的交流。
          </p>
          <Link className="btn" to="/join">
            我有一份邀请 →
          </Link>
        </div>
      </section>
    </>
  );
}
