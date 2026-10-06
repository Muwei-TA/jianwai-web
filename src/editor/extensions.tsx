import { Mark, Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { assetUrl, safeUrl } from "./safety";
export const SpoilerMark = Mark.create({
  name: "spoiler",
  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-spoiler": "true",
        class: "editor-spoiler",
      }),
      0,
    ];
  },
});
function FigureView({
  node,
  updateAttributes,
  selected,
  deleteNode,
}: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="figure"
      className={
        "editor-figure" +
        (selected ? " selected" : "") +
        (node.attrs.layout === "wide" ? " wide" : "")
      }
    >
      <img
        src={assetUrl(node.attrs.assetId)}
        alt={node.attrs.alt || ""}
        draggable="false"
      />
      <div contentEditable={false} className="figure-controls">
        <input
          aria-label="图片图注"
          placeholder="为图片写一句图注…"
          value={node.attrs.caption || ""}
          maxLength={500}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
        <div className="row wrap">
          <input
            aria-label="图片替代文字"
            placeholder="描述画面（供屏幕阅读器读取）"
            value={node.attrs.alt || ""}
            maxLength={500}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
          />
          <button
            type="button"
            onClick={() =>
              updateAttributes({
                layout: node.attrs.layout === "wide" ? "normal" : "wide",
              })
            }
          >
            {node.attrs.layout === "wide" ? "标准宽度" : "宽幅显示"}
          </button>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!node.attrs.spoiler}
              onChange={(e) => updateAttributes({ spoiler: e.target.checked })}
            />
            图片含剧透
          </label>
          <button type="button" className="danger" onClick={deleteNode}>
            移除图片
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
export const FigureNode = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      assetId: { default: "" },
      caption: { default: "" },
      alt: { default: "" },
      layout: { default: "normal" },
      spoiler: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-jw-figure]" }];
  },
  renderHTML() {
    return ["figure", { "data-jw-figure": "true" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});
interface GalleryItem {
  assetId: string;
  caption: string;
  alt: string;
}
function GalleryView({
  node,
  updateAttributes,
  selected,
  deleteNode,
}: NodeViewProps) {
  const items: GalleryItem[] = node.attrs.items || [];
  const patch = (index: number, key: keyof GalleryItem, value: string) =>
    updateAttributes({
      items: items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    });
  return (
    <NodeViewWrapper
      className={
        "editor-gallery" +
        (selected ? " selected" : "") +
        (node.attrs.layout === "wide" ? " wide" : "")
      }
      contentEditable={false}
    >
      <div className="gallery-grid">
        {items.map((item, index) => (
          <div key={item.assetId}>
            <img
              src={assetUrl(item.assetId)}
              alt={item.alt}
              draggable="false"
            />
            <input
              aria-label={"图集图片 " + (index + 1) + " 图注"}
              placeholder="这一张的图注"
              value={item.caption}
              maxLength={500}
              onChange={(e) => patch(index, "caption", e.target.value)}
            />
            <input
              aria-label={"图集图片 " + (index + 1) + " 替代文字"}
              placeholder="画面描述"
              value={item.alt}
              maxLength={500}
              onChange={(e) => patch(index, "alt", e.target.value)}
            />
          </div>
        ))}
      </div>
      <input
        aria-label="图集说明"
        placeholder="整组图片的说明"
        value={node.attrs.caption || ""}
        maxLength={500}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
      />
      <div className="row">
        <button
          type="button"
          onClick={() =>
            updateAttributes({
              layout: node.attrs.layout === "wide" ? "normal" : "wide",
            })
          }
        >
          {node.attrs.layout === "wide" ? "标准宽度" : "宽幅显示"}
        </button>
        <button type="button" className="danger" onClick={deleteNode}>
          移除图集
        </button>
      </div>
    </NodeViewWrapper>
  );
}
export const GalleryNode = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      items: { default: [] },
      caption: { default: "" },
      layout: { default: "normal" },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-jw-gallery]" }];
  },
  renderHTML() {
    return ["div", { "data-jw-gallery": "true" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },
});
function LinkCardView({ node, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="link-card">
        <span>↗</span>
        <div>
          <strong>{node.attrs.title || node.attrs.url}</strong>
          <p>{node.attrs.description}</p>
          <small>{safeUrl(node.attrs.url) || "无效链接"}</small>
        </div>
        <button type="button" className="quiet" onClick={deleteNode}>
          移除
        </button>
      </div>
    </NodeViewWrapper>
  );
}
export const LinkCardNode = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
    };
  },
  parseHTML() {
    return [];
  },
  renderHTML() {
    return ["div", { "data-jw-link-card": "true" }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView);
  },
});
