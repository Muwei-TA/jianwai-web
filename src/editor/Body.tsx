import { Fragment, useState, type ReactNode } from "react";
import type { BodyNode } from "../types";
import { assetUrl, safeUrl } from "./safety";
function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={"spoiler" + (open ? " revealed" : "")}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {open ? children : "点击查看剧透"}
    </button>
  );
}
function Figure({ attrs }: { attrs: Record<string, unknown> }) {
  const url = assetUrl(attrs.assetId);
  if (!url) return null;
  const image = (
    <>
      <img
        src={url}
        alt={typeof attrs.alt === "string" ? attrs.alt : ""}
        loading="lazy"
      />
      {typeof attrs.caption === "string" && attrs.caption && (
        <figcaption>{attrs.caption}</figcaption>
      )}
    </>
  );
  return (
    <figure className={attrs.layout === "wide" ? "wide" : ""}>
      {attrs.spoiler ? <Spoiler>{image}</Spoiler> : image}
    </figure>
  );
}
function render(node: BodyNode, key: number, depth = 0): ReactNode {
  if (depth > 32 || !node || typeof node !== "object") return null;
  const children = (node.content || []).map((child, index) =>
    render(child, index, depth + 1),
  );
  const attrs = node.attrs || {};
  if (node.type === "text") {
    let text: ReactNode = node.text || "";
    for (const [index, mark] of (node.marks || []).entries()) {
      switch (mark.type) {
        case "bold":
          text = <strong key={index}>{text}</strong>;
          break;
        case "italic":
          text = <em key={index}>{text}</em>;
          break;
        case "underline":
          text = <u key={index}>{text}</u>;
          break;
        case "strike":
          text = <s key={index}>{text}</s>;
          break;
        case "code":
          text = <code key={index}>{text}</code>;
          break;
        case "spoiler":
          text = <Spoiler key={index}>{text}</Spoiler>;
          break;
        case "link": {
          const url = safeUrl(mark.attrs?.href);
          if (url)
            text = (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {text}
              </a>
            );
          break;
        }
      }
    }
    return <Fragment key={key}>{text}</Fragment>;
  }
  switch (node.type) {
    case "doc":
      return <Fragment key={key}>{children}</Fragment>;
    case "paragraph":
      return <p key={key}>{children.length ? children : <br />}</p>;
    case "heading":
      return attrs.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    case "figure":
      return <Figure key={key} attrs={attrs} />;
    case "gallery": {
      const items = Array.isArray(attrs.items) ? attrs.items.slice(0, 9) : [];
      return (
        <div
          key={key}
          className={"body-gallery" + (attrs.layout === "wide" ? " wide" : "")}
        >
          <div>
            {items.map((item, index) => (
              <Figure key={index} attrs={item as Record<string, unknown>} />
            ))}
          </div>
          {typeof attrs.caption === "string" && (
            <p className="gallery-caption">{attrs.caption}</p>
          )}
        </div>
      );
    }
    case "linkCard": {
      const url = safeUrl(attrs.url);
      return url ? (
        <a
          className="link-card"
          key={key}
          href={url}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          <span>↗</span>
          <div>
            <strong>
              {typeof attrs.title === "string" ? attrs.title : url}
            </strong>
            {typeof attrs.description === "string" && (
              <p>{attrs.description}</p>
            )}
            <small>{new URL(url).hostname}</small>
          </div>
        </a>
      ) : null;
    }
    default:
      return null;
  }
}
export default function Body({ body }: { body: BodyNode }) {
  return <div className="article-body">{render(body, 0)}</div>;
}
