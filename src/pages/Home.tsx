import { useState } from "react";
import { Link } from "react-router-dom";
import { PostFeed, useResource } from "../components";
import type { Club, Page } from "../types";

export default function Home() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const clubs = useResource<Page<Club>>("/clubs");
  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="eyebrow">BLACK BOX · A PLACE TO BE HEARD</span>
          <h1 id="home-title">
            把没说完的<br />话，放进<br /><em>黑匣子。</em>
          </h1>
          <p>
            给兴趣一个私密的房间，给表达一份真实的回声。<br />
            凭朋友的邀请码，进入属于你的社团。
          </p>
          <Link className="home-hero-cta" to="/join">打开我的邀请 ↗</Link>
        </div>
        <div className="home-hero-art" aria-hidden="true">
          <span className="home-art-top">PRIVATE FREQUENCY<br />NO. 001—∞</span>
          <div className="home-art-box"><span>● REC / 001</span></div>
          <span className="home-art-bottom">RECORD WHAT MATTERS.</span>
          <span className="home-art-side">ARCHIVE / INVITATION ONLY</span>
        </div>
      </section>
      <div className="home-content">
        <section className="home-intro" aria-label="黑匣子阅读说明">
          <div><span className="eyebrow">01 / DISCOVER</span><h2>此刻，<br />值得读的。</h2></div>
          <div><span className="eyebrow">PUBLIC JOURNAL</span><p>公开文章会在这里出现。社团内的交流只对受邀成员开放。</p></div>
          <div><span className="eyebrow">INVITATION / ACCESS</span><strong>01</strong><p>每一份邀请码，只通向它所属的社团。</p></div>
        </section>
        {!!clubs.data?.items.length && (
          <div className="interest-strip">
            <span>我的社团</span>
            {clubs.data.items.slice(0, 5).map((club) => (
              <Link key={club.id} to={"/clubs/" + club.id}>
                <i style={{ background: club.accent || "#d05c42" }} />{club.name}
              </Link>
            ))}
            <Link to="/clubs" className="all-clubs">查看全部 ↗</Link>
          </div>
        )}
        <section className="magazine-section">
          <div className="section-head">
            <div><h2>公开记录 <span>FROM THE JOURNAL</span></h2><p>好作品与有意思的想法，值得慢下来读。</p></div>
            <form className="search" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
              <input aria-label="搜索文章" placeholder="寻找一篇文章" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button aria-label="搜索">↗</button>
            </form>
          </div>
          <PostFeed path={"/posts" + (query ? "?q=" + encodeURIComponent(query) : "")}
            emptyTitle={query ? "还没有找到这篇文章" : "还没有公开文章"} />
        </section>
      </div>
    </>
  );
}
