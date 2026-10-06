import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import {
  EditorContent,
  useEditor,
  type Editor as TiptapEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { api, json, message } from "../api";
import { useSession } from "../session";
import {
  ErrorNote,
  Loading,
  ResourceError,
  scopeNames,
  useResource,
} from "../components";
import { SaveQueue } from "../editor/saveQueue";
import {
  FigureNode,
  GalleryNode,
  LinkCardNode,
  SpoilerMark,
} from "../editor/extensions";
import {
  assetUrl,
  cleanPaste,
  imageCount,
  plainText,
  safeUrl,
} from "../editor/safety";
import Body from "../editor/Body";
import { copySlice, pasteSlice } from "../editor/clipboard";
import type {
  Asset,
  BodyNode,
  Club,
  Document,
  Draft,
  Page,
  Post,
  Scope,
} from "../types";
function documentOf(draft: Draft): Document {
  return {
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    club_id: draft.club_id,
    scope: draft.scope,
    tags: draft.tags,
    feedback_intent: draft.feedback_intent,
    cover_asset_id: draft.cover_asset_id,
  };
}
export default function EditorPage() {
  const { id } = useParams();
  const { session, loading } = useSession();
  const resource = useResource<Draft>(session?.user ? "/drafts/" + id : null);
  if (loading || resource.loading) return <Loading />;
  if (!session?.user)
    return (
      <div className="narrow card pad">
        <h1>登录后继续写作</h1>
        <Link className="btn primary" to="/login">
          登录
        </Link>
      </div>
    );
  if (resource.error)
    return <ResourceError error={resource.error} reload={resource.reload} />;
  return resource.data ? (
    <WritingRoom
      key={resource.data.id + ":" + resource.data.revision}
      draft={resource.data}
      reload={resource.reload}
    />
  ) : null;
}
function FormatToolbar({
  editor,
  selection = false,
}: {
  editor: TiptapEditor | null;
  selection?: boolean;
}) {
  if (!editor) return null;
  const format = (command: string) => {
    const chain = editor.chain().focus();
    switch (command) {
      case "bold":
        chain.toggleBold().run();
        break;
      case "italic":
        chain.toggleItalic().run();
        break;
      case "underline":
        chain.toggleUnderline().run();
        break;
      case "strike":
        chain.toggleStrike().run();
        break;
      case "code":
        chain.toggleCode().run();
        break;
      case "spoiler":
        chain.toggleMark("spoiler").run();
        break;
      case "h2":
        chain.toggleHeading({ level: 2 }).run();
        break;
      case "h3":
        chain.toggleHeading({ level: 3 }).run();
        break;
      case "blockquote":
        chain.toggleBlockquote().run();
        break;
      case "bulletList":
        chain.toggleBulletList().run();
        break;
      case "orderedList":
        chain.toggleOrderedList().run();
        break;
      case "link": {
        const input = prompt(
          "链接地址（仅 http / https），留空移除链接",
          editor.getAttributes("link").href || "",
        );
        if (input === null) return;
        if (!input) {
          chain.extendMarkRange("link").unsetLink().run();
          return;
        }
        const href = safeUrl(input);
        if (!href) {
          alert("请输入有效的 http 或 https 链接。");
          return;
        }
        chain.extendMarkRange("link").setLink({ href }).run();
        break;
      }
    }
  };
  const commands = [
    ["bold", "B", "加粗"],
    ["italic", "I", "斜体"],
    ["underline", "U", "下划线"],
    ["strike", "S", "删除线"],
    ["code", "<>", "行内代码"],
    ["spoiler", "遮", "剧透"],
    ["link", "↗", "选区链接"],
    ...(!selection
      ? [
          ["h2", "H2", "二级标题"],
          ["h3", "H3", "三级标题"],
          ["blockquote", "❝", "引用"],
          ["bulletList", "•", "项目列表"],
          ["orderedList", "1.", "编号列表"],
        ]
      : []),
  ];
  return (
    <div
      className="format-toolbar"
      role="toolbar"
      aria-label={selection ? "选中文字格式" : "正文格式"}
    >
      {commands.map(([command, label, title]) => (
        <button
          type="button"
          key={command}
          title={title}
          aria-label={title}
          aria-pressed={
            command === "h2" || command === "h3"
              ? editor.isActive("heading", { level: command === "h2" ? 2 : 3 })
              : editor.isActive(command)
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format(command)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function WritingRoom({ draft, reload }: { draft: Draft; reload: () => void }) {
  const navigate = useNavigate();
  const [, force] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [uploading, setUploading] = useState(false),
    [publishing, setPublishing] = useState(false),
    [modal, setModal] = useState<"preview" | "publish" | "linkCard" | null>(
      null,
    ),
    [mobile, setMobile] = useState(false),
    [insertOpen, setInsertOpen] = useState(false),
    [tags, setTags] = useState(draft.tags.join("，"));
  const [linkUrl, setLinkUrl] = useState(""),
    [linkTitle, setLinkTitle] = useState(""),
    [linkDescription, setLinkDescription] = useState("");
  const mounted = useRef(true),
    uploadLock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [queue] = useState(
    () =>
      new SaveQueue<Document>(
        documentOf(draft),
        draft.revision,
        async (value, revision) =>
          api<Draft>("/drafts/" + draft.id, {
            method: "PUT",
            body: json({ revision, ...value }),
          }),
        () => {
          if (mounted.current) force((n) => n + 1);
        },
      ),
  );
  const doc = queue.current;
  const clubs = useResource<Page<Club>>("/clubs?limit=50");
  const uploadRef = useRef<
    (files: File[], kind: "figure" | "gallery" | "cover") => Promise<void>
  >(async () => {});
  const [bubble, setBubble] = useState<{ left: number; top: number } | null>(
    null,
  );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https"],
        isAllowedUri: (url) => !!safeUrl(url),
      }),
      Placeholder.configure({
        placeholder: "写下第一句话。输入 / 添加内容块。",
      }),
      FigureNode,
      GalleryNode,
      LinkCardNode,
      SpoilerMark,
    ],
    content: draft.body,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "富文本正文",
        "aria-multiline": "true",
        class: "rich-content",
      },
      transformPastedHTML: cleanPaste,
      handleDOMEvents: {
        copy: (view, event) => copySlice(view, event as ClipboardEvent),
        cut: (view, event) => copySlice(view, event as ClipboardEvent, true),
      },
      handlePaste(_view, event) {
        if (pasteSlice(_view, event)) return true;
        const files = Array.from(event.clipboardData?.files || []);
        if (files.length) {
          event.preventDefault();
          void uploadRef.current(
            files,
            files.length > 1 ? "gallery" : "figure",
          );
          return true;
        }
        return false;
      },
      handleDrop(_view, event) {
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length) {
          event.preventDefault();
          void uploadRef.current(
            files,
            files.length > 1 ? "gallery" : "figure",
          );
          return true;
        }
        return false;
      },
      handleKeyDown(view, event) {
        if (
          event.key === "/" &&
          view.state.selection.empty &&
          view.state.selection.$from.parent.textContent === ""
        ) {
          event.preventDefault();
          setInsertOpen(true);
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      queue.update({ ...queue.current, body: editor.getJSON() as BodyNode });
    },
    onSelectionUpdate({ editor }) {
      force((n) => n + 1);
      const { from, to, empty } = editor.state.selection;
      if (!empty && editor.state.doc.textBetween(from, to).trim()) {
        const a = editor.view.coordsAtPos(from),
          b = editor.view.coordsAtPos(to);
        setBubble({
          left: Math.max(
            12,
            Math.min(window.innerWidth - 320, (a.left + b.left) / 2 - 155),
          ),
          top: Math.max(88, a.top - 50),
        });
      } else setBubble(null);
    },
  });
  const mutate = (patch: Partial<Document>) => {
    setNotice("");
    queue.update({ ...queue.current, ...patch });
  };
  const save = async () => {
    setError("");
    try {
      await queue.save();
      if (mounted.current)
        setNotice(
          queue.dirty ? "输入有更新，将继续保存。" : "草稿已保存到云端。",
        );
    } catch (e) {
      if (mounted.current) setError(message(e));
    }
  };
  useEffect(() => {
    if (!queue.dirty || queue.blocked) return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
  }, [doc]);
  const blocker = useBlocker(() => queue.dirty || uploadLock.current);
  useEffect(() => {
    const logoutGuard = (event: Event) => {
      if (
        (queue.dirty || uploadLock.current) &&
        !confirm(
          "还有未保存内容。退出账号会丢失当前输入，确认已保存或导出备份后退出？",
        )
      )
        event.preventDefault();
    };
    window.addEventListener("jianwai:beforeLogout", logoutGuard);
    const onUnload = (event: BeforeUnloadEvent) => {
      if (queue.dirty || uploadLock.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("jianwai:beforeLogout", logoutGuard);
    };
  }, [queue]);
  const filesInput = useRef<HTMLInputElement>(null),
    coverInput = useRef<HTMLInputElement>(null);
  const requested = useRef<"figure" | "gallery">("figure");
  const upload = async (
    files: File[],
    kind: "figure" | "gallery" | "cover",
  ) => {
    if (uploadLock.current) {
      setError("图片仍在上传，请稍候。");
      return;
    }
    if (!files.length) return;
    setError("");
    setNotice("");
    if (kind !== "cover" && imageCount(queue.current.body) + files.length > 9) {
      setError("正文最多 9 张图片，请先移除一些图片。");
      return;
    }
    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError(
        "仅支持 JPEG、PNG、WebP，每张最多 10 MiB。图片没有插入，请重新选择。",
      );
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    try {
      const assets: Asset[] = [];
      for (const file of kind === "cover" ? files.slice(0, 1) : files) {
        const data = new FormData();
        data.append("file", file);
        assets.push(
          await api<Asset>("/drafts/" + draft.id + "/media", {
            method: "POST",
            body: data,
          }),
        );
      }
      if (!mounted.current) return;
      if (kind === "cover") mutate({ cover_asset_id: assets[0].id });
      else if (kind === "gallery")
        editor
          ?.chain()
          .focus()
          .insertContent([
            {
              type: "gallery",
              attrs: {
                items: assets.map((asset) => ({
                  assetId: asset.id,
                  caption: "",
                  alt: "",
                })),
                caption: "",
                layout: "normal",
              },
            },
            { type: "paragraph" },
          ])
          .run();
      else
        editor
          ?.chain()
          .focus()
          .insertContent(
            assets.flatMap((asset) => [
              {
                type: "figure",
                attrs: {
                  assetId: asset.id,
                  caption: "",
                  alt: "",
                  layout: "normal",
                  spoiler: false,
                },
              },
              { type: "paragraph" },
            ]),
          )
          .run();
      setNotice("图片上传成功，内容将随草稿保存。");
      setInsertOpen(false);
    } catch (e) {
      if (mounted.current)
        setError(message(e) + " 图片未插入，正文仍保留，可重新上传。");
    } finally {
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
    }
  };
  uploadRef.current = upload;
  const choose = (kind: "figure" | "gallery") => {
    requested.current = kind;
    if (filesInput.current) {
      filesInput.current.multiple = kind === "gallery";
      filesInput.current.click();
    }
  };
  const selectedFiles = (
    event: ChangeEvent<HTMLInputElement>,
    kind: "figure" | "gallery" | "cover",
  ) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    void upload(files, kind);
  };
  const insertLink = () => {
    const url = safeUrl(linkUrl);
    if (!url) {
      setError("请输入有效的 http 或 https 链接。");
      return;
    }
    editor
      ?.chain()
      .focus()
      .insertContent([
        {
          type: "linkCard",
          attrs: {
            url,
            title: linkTitle.trim() || new URL(url).hostname,
            description: linkDescription.trim(),
          },
        },
        { type: "paragraph" },
      ])
      .run();
    setModal(null);
    setInsertOpen(false);
    setLinkUrl("");
    setLinkTitle("");
    setLinkDescription("");
    setError("");
  };
  const backup = () => {
    const blob = new Blob([queue.backup()], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jianwai-draft-" + draft.id + ".json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const publish = async () => {
    if (publishing) return;
    setError("");
    if (uploadLock.current) {
      setError("请等待图片上传完成。");
      return;
    }
    if (
      queue.current.title.trim().length < 2 ||
      !queue.current.club_id ||
      (!plainText(queue.current.body).trim() &&
        !imageCount(queue.current.body) &&
        !queue.current.body.content?.some((node) => node.type === "linkCard"))
    ) {
      setError("请填写至少 2 字的标题、选择已加入的社团，并写入正文内容。");
      return;
    }
    setPublishing(true);
    try {
      await queue.flush();
      const post = await api<Post>("/drafts/" + draft.id + "/publish", {
        method: "POST",
        body: json({ revision: queue.revision }),
      });
      if (!mounted.current) return;
      setModal(null);
      navigate("/posts/" + post.id);
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally {
      if (mounted.current) setPublishing(false);
    }
  };
  useEffect(() => {
    if (!modal && blocker.state !== "blocked") return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = Array.from(
      document.querySelectorAll<HTMLElement>("[role=dialog]"),
    ).at(-1);
    if (!dialog) return;
    const elements = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        ),
      );
    elements()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (blocker.state === "blocked") blocker.reset();
        else setModal(null);
      }
      if (event.key === "Tab") {
        const all = elements(),
          first = all[0],
          last = all.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal, blocker.state]);
  const headings: Array<{ text: string; pos: number; level: number }> = [];
  editor?.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading")
      headings.push({ text: node.textContent, pos, level: node.attrs.level });
  });
  return (
    <div className="writing-room">
      <header className="compose-head">
        <div className="row">
          <Link className="quiet" to="/workspace">
            ← 创作间
          </Link>
          <span className="compose-state" role="status">
            {uploading
              ? "正在上传图片…"
              : queue.blocked
                ? "版本冲突 · 输入已保留"
                : queue.saving
                  ? "正在保存…"
                  : queue.dirty
                    ? "有未保存修改"
                    : "已保存到云端"}{" "}
            <small>v{queue.revision}</small>
          </span>
        </div>
        <div className="row">
          <button className="btn compact" onClick={backup}>
            导出备份
          </button>
          <button
            className="btn compact"
            disabled={queue.blocked || uploading}
            onClick={() => void save()}
          >
            立即保存
          </button>
          <button className="btn compact" onClick={() => setModal("preview")}>
            预览
          </button>
          <button
            className="btn primary compact"
            disabled={queue.blocked || uploading}
            onClick={() => {
              setError("");
              setModal("publish");
            }}
          >
            发布
          </button>
        </div>
      </header>
      <ErrorNote error={error} />
      {queue.blocked && (
        <div className="conflict-note" role="alert">
          <strong>云端已有更新版本，本页输入不会被覆盖。</strong>
          <p>
            先导出备份，再重新载入云端版本。重新载入会替换当前尚未保存的内容。
          </p>
          <button className="btn" onClick={backup}>
            导出当前输入
          </button>
          <button
            className="btn"
            onClick={() => {
              if (
                confirm(
                  "请确认已经导出备份。重新载入会放弃当前尚未保存的输入。",
                )
              ) {
                queue.dirty = false;
                reload();
              }
            }}
          >
            重新载入云端版本
          </button>
        </div>
      )}
      {notice && (
        <p className="save-notice" role="status">
          {notice}
        </p>
      )}
      <div className="writing-layout">
        <aside className="writing-rail">
          <span className="eyebrow">IN THIS DRAFT</span>
          <h3>文章目录</h3>
          {headings.length ? (
            headings.map((heading, index) => (
              <button
                key={index}
                className={"level-" + heading.level}
                onClick={() =>
                  editor
                    ?.chain()
                    .focus()
                    .setTextSelection(heading.pos + 1)
                    .scrollIntoView()
                    .run()
                }
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {heading.text || "未命名章节"}
              </button>
            ))
          ) : (
            <p className="helper">
              添加标题后，
              <br />
              目录会出现在这里。
            </p>
          )}
          <div className="rail-guide">
            <span>＋</span>
            <p>
              选中文字添加格式。
              <br />
              空行输入 / 插入内容块。
              <br />
              图片可粘贴或拖入。
            </p>
          </div>
          <p className="helper">
            草稿仅你可见。
            <br />
            云保存成功后，换设备也能继续。
          </p>
        </aside>
        <section className="writing-paper">
          <div className="paper-top">
            <span>原创 · 自由创作</span>
            <span>
              {Array.from(plainText(doc.body).replace(/\s/g, "")).length} 字 ·{" "}
              {imageCount(doc.body)} 张图
            </span>
          </div>
          <textarea
            className="rich-title"
            aria-label="文章标题"
            rows={2}
            maxLength={80}
            placeholder="给这篇创作起个名字"
            value={doc.title}
            onChange={(e) => mutate({ title: e.target.value })}
          />
          <textarea
            className="rich-summary"
            aria-label="文章摘要"
            rows={2}
            maxLength={160}
            placeholder="用一两句话，让读者知道你想分享什么（摘要）"
            value={doc.summary}
            onChange={(e) => mutate({ summary: e.target.value })}
          />
          <div className="cover-editor">
            {doc.cover_asset_id ? (
              <>
                <img src={assetUrl(doc.cover_asset_id)} alt="文章封面" />
                <div className="cover-controls">
                  <button
                    className="btn compact"
                    disabled={uploading}
                    onClick={() => coverInput.current?.click()}
                  >
                    更换封面
                  </button>
                  <button
                    className="btn compact"
                    onClick={() => mutate({ cover_asset_id: null })}
                  >
                    移除封面
                  </button>
                </div>
              </>
            ) : (
              <button
                className="cover-empty"
                disabled={uploading}
                onClick={() => coverInput.current?.click()}
              >
                ＋ 添加独立封面<span>给作品一个可以停留的画面</span>
              </button>
            )}
          </div>
          <FormatToolbar editor={editor} />
          <EditorContent editor={editor} />
          <div className="paper-end">
            <span>文字与格式，会一起保存。</span>
            <button
              className="quiet"
              onClick={() => setInsertOpen(!insertOpen)}
            >
              ＋ 添加内容块
            </button>
          </div>
          {insertOpen && (
            <div className="insert-menu" role="group" aria-label="添加内容块">
              <button
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 2 }).run();
                  setInsertOpen(false);
                }}
              >
                H2 标题
              </button>
              <button
                onClick={() => {
                  editor?.chain().focus().toggleBlockquote().run();
                  setInsertOpen(false);
                }}
              >
                ❝ 引用
              </button>
              <button disabled={uploading} onClick={() => choose("figure")}>
                ▧ 图片与图注
              </button>
              <button disabled={uploading} onClick={() => choose("gallery")}>
                ▦ 多图图集
              </button>
              <button onClick={() => setModal("linkCard")}>↗ 链接卡片</button>
              <button
                onClick={() => {
                  editor?.chain().focus().setHorizontalRule().run();
                  setInsertOpen(false);
                }}
              >
                — 分隔线
              </button>
              <button className="quiet" onClick={() => setInsertOpen(false)}>
                收起
              </button>
            </div>
          )}
        </section>
        <aside className="writing-margin">
          <span>01</span>
          <p>写下想法</p>
          <span className="muted">02</span>
          <p className="muted">预览与发布</p>
          <div>
            <b>✦</b>
            <p>
              给读者一点上下文，
              <br />
              也给作品一点呼吸。
            </p>
          </div>
        </aside>
      </div>
      {bubble && (
        <div
          className="selection-bubble"
          style={{ left: bubble.left, top: bubble.top }}
        >
          <FormatToolbar editor={editor} selection />
        </div>
      )}
      <input
        ref={filesInput}
        className="hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="上传正文图片"
        onChange={(e) => selectedFiles(e, requested.current)}
      />
      <input
        ref={coverInput}
        className="hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="上传独立封面"
        onChange={(e) => selectedFiles(e, "cover")}
      />
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={"modal " + (modal === "preview" ? "preview-modal" : "")}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "preview"
                ? "文章预览"
                : modal === "publish"
                  ? "发布设置"
                  : "插入链接卡片"
            }
          >
            <header className="modal-head">
              <h2>
                {modal === "preview"
                  ? "预览作品"
                  : modal === "publish"
                    ? "把作品交给读者"
                    : "插入链接卡片"}
              </h2>
              <button aria-label="关闭弹窗" onClick={() => setModal(null)}>
                ×
              </button>
            </header>
            {modal === "preview" ? (
              <>
                <div className="preview-switch row">
                  <button
                    className={!mobile ? "active" : ""}
                    onClick={() => setMobile(false)}
                  >
                    桌面预览
                  </button>
                  <button
                    className={mobile ? "active" : ""}
                    onClick={() => setMobile(true)}
                  >
                    手机预览
                  </button>
                </div>
                <div className={"preview-paper" + (mobile ? " phone" : "")}>
                  <span className="category-label">
                    {clubs.data?.items.find((club) => club.id === doc.club_id)
                      ?.name || "未选择社团"}{" "}
                    · {scopeNames[doc.scope]}
                  </span>
                  <h1>{doc.title || "未命名作品"}</h1>
                  <p className="article-summary">{doc.summary}</p>
                  {doc.cover_asset_id && (
                    <img
                      className="article-cover"
                      src={assetUrl(doc.cover_asset_id)}
                      alt="文章封面"
                    />
                  )}
                  <Body body={doc.body} />
                </div>
              </>
            ) : modal === "linkCard" ? (
              <div className="pad">
                <label>
                  链接地址
                  <input
                    aria-label="链接卡片地址"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <label>
                  显示标题
                  <input
                    aria-label="链接卡片标题"
                    maxLength={160}
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                  />
                </label>
                <label>
                  说明
                  <textarea
                    aria-label="链接卡片说明"
                    maxLength={500}
                    rows={2}
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                  />
                </label>
                <ErrorNote error={error} />
                <p className="helper">
                  链接不会自动抓取外站内容。只有你填写的文字会展示。
                </p>
                <button className="btn primary" onClick={insertLink}>
                  插入卡片
                </button>
              </div>
            ) : (
              <div className="pad">
                <p className="muted">
                  草稿会先保存，发布始终引用这一份已保存的固定版本。
                </p>
                <label>
                  所属社团
                  <select
                    aria-label="所属社团"
                    value={doc.club_id || ""}
                    onChange={(e) =>
                      mutate({ club_id: e.target.value || null })
                    }
                  >
                    <option value="">选择已加入的社团</option>
                    {clubs.data?.items
                      .filter((club) => club.my_role)
                      .map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                  </select>
                </label>
                {clubs.error && (
                  <ResourceError error={clubs.error} reload={clubs.reload} />
                )}
                <label>
                  阅读范围
                  <select
                    aria-label="阅读范围"
                    value={doc.scope}
                    onChange={(e) => mutate({ scope: e.target.value as Scope })}
                  >
                    <option value="club">社团内 · 仅同团成员</option>
                    <option value="members">社区成员 · 间外全站成员</option>
                    <option value="public">公开 · 需团主审核</option>
                  </select>
                </label>
                <p className="scope-explanation">
                  {doc.scope === "public"
                    ? "公开投稿会进入团主审核。通过后，游客也能阅读。原有内部评论不会复制到公开作品。"
                    : doc.scope === "members"
                      ? "所有拥有社区成员资格的人可以阅读和评论。"
                      : "仅当前社团内的成员可以阅读和评论。"}
                </p>
                <label>
                  标签（最多 5 个，用逗号分隔）
                  <input
                    aria-label="文章标签"
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      mutate({
                        tags: e.target.value
                          .split(/[,，]/)
                          .map((value) => value.trim())
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((value) => value.slice(0, 20)),
                      });
                    }}
                  />
                </label>
                <label>
                  你希望收到什么回应
                  <input
                    aria-label="期待回应"
                    maxLength={160}
                    placeholder="例如：想听听大家对叙事节奏的看法"
                    value={doc.feedback_intent}
                    onChange={(e) =>
                      mutate({ feedback_intent: e.target.value })
                    }
                  />
                </label>
                <ErrorNote error={error} />
                <div className="row between wrap">
                  <span className="helper">
                    发布后仍可继续编辑草稿，已提交内容保持不变。
                  </span>
                  <button
                    className="btn primary"
                    disabled={
                      publishing || uploading || queue.saving || queue.blocked
                    }
                    onClick={() => void publish()}
                  >
                    提交发布
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {blocker.state === "blocked" && (
        <div className="modal-backdrop">
          <section
            className="modal pad"
            role="dialog"
            aria-modal="true"
            aria-label="未保存修改"
          >
            <h2>还有内容没有保存</h2>
            <p>当前输入仍在此页。可以继续写作或先导出备份。</p>
            <div className="row wrap">
              <button className="btn primary" onClick={() => blocker.reset()}>
                继续写作
              </button>
              <button className="btn" onClick={backup}>
                导出备份
              </button>
              <button className="btn danger" onClick={() => blocker.proceed()}>
                放弃未保存修改并离开
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
