import type { BodyNode } from "../types";
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim()))
    return null;
  try {
    const parsed = new URL(value.trim());
    if (
      parsed.username ||
      parsed.password ||
      !["http:", "https:"].includes(parsed.protocol)
    )
      return null;
    return parsed.href;
  } catch {
    return null;
  }
}
export function assetUrl(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value)
    ? "/api/v1/media/" + value
    : "";
}
export function plainText(node: BodyNode): string {
  return node.type === "text"
    ? node.text || ""
    : (node.content || [])
        .map(plainText)
        .join(
          ["doc", "bulletList", "orderedList"].includes(node.type) ? "\n" : "",
        );
}
export function imageCount(node: BodyNode): number {
  return (
    (node.type === "figure"
      ? 1
      : node.type === "gallery" && Array.isArray(node.attrs?.items)
        ? node.attrs.items.length
        : 0) + (node.content || []).reduce((n, item) => n + imageCount(item), 0)
  );
}
/** HTML is parsed to a strict semantic allowlist before Tiptap receives it. No styles, external images, embeds, or arbitrary attributes survive. */
export function cleanPaste(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script,style,iframe,object,embed,svg,math,img,video,audio,input,button",
    )
    .forEach((el) => el.remove());
  const allowed = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "DEL",
    "CODE",
    "BLOCKQUOTE",
    "UL",
    "OL",
    "LI",
    "HR",
    "H2",
    "H3",
    "A",
  ]);
  for (const element of Array.from(doc.body.querySelectorAll("*")).reverse()) {
    const href =
      element.tagName === "A" ? safeUrl(element.getAttribute("href")) : null;
    Array.from(element.attributes).forEach((attr) =>
      element.removeAttribute(attr.name),
    );
    if (element.tagName === "A") {
      if (href) element.setAttribute("href", href);
      else element.replaceWith(...element.childNodes);
    } else if (!allowed.has(element.tagName))
      element.replaceWith(...element.childNodes);
  }
  return doc.body.innerHTML;
}
