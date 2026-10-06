import { Slice, type Schema } from "@tiptap/pm/model";
import { assetUrl, safeUrl } from "./safety";
import type { EditorView } from "@tiptap/pm/view";
export const CLIPBOARD_MIME = "application/x-jianwai-slice";
export function serializeSlice(slice: Slice): string {
  return JSON.stringify({ version: 1, slice: slice.toJSON() });
}
export function parseSlice(schema: Schema, value: string): Slice | null {
  try {
    if (value.length > 500000) return null;
    const data = JSON.parse(value);
    if (data.version !== 1 || !data.slice) return null;
    const slice = Slice.fromJSON(schema, data.slice);
    const permitted = new Set(["paragraph", "text", "heading", "blockquote", "bulletList", "orderedList", "listItem", "horizontalRule", "hardBreak", "figure", "gallery", "linkCard"]);
    const caption = (value: unknown) => typeof value === "string" && value.length <= 500;
    const image = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return false;
      const item = value as Record<string, unknown>;
      return !!assetUrl(item.assetId) && Object.keys(item).every(key => ["assetId", "caption", "alt"].includes(key)) && (item.caption === undefined || caption(item.caption)) && (item.alt === undefined || caption(item.alt));
    };
    let safe = true, count = 0;
    slice.content.descendants(node => {
      count++;
      if (count > 5000 || !permitted.has(node.type.name)) safe = false;
      const attrs = node.attrs;
      if (node.type.name === "heading" && ![2, 3].includes(attrs.level)) safe = false;
      if (["figure", "gallery"].includes(node.type.name) && !["normal", "wide"].includes(attrs.layout)) safe = false;
      if (node.type.name === "figure" && (!image({assetId:attrs.assetId, caption:attrs.caption, alt:attrs.alt}) || typeof attrs.spoiler !== "boolean")) safe = false;
      if (node.type.name === "gallery" && (!Array.isArray(attrs.items) || !attrs.items.length || attrs.items.length > 9 || !attrs.items.every(image) || !caption(attrs.caption))) safe = false;
      if (node.type.name === "linkCard" && (!safeUrl(attrs.url) || typeof attrs.title !== "string" || attrs.title.length > 160 || !caption(attrs.description))) safe = false;
      for (const mark of node.marks) if (mark.type.name === "link" && !safeUrl(mark.attrs.href)) safe = false;
    });
    return safe ? slice : null;
  } catch {
    return null;
  }
}
export function copySlice(
  view: EditorView,
  event: ClipboardEvent,
  cut = false,
): boolean {
  if (!event.clipboardData || view.state.selection.empty) return false;
  try {
    const slice = view.state.selection.content();
    event.clipboardData.setData(CLIPBOARD_MIME, serializeSlice(slice));
    event.clipboardData.setData(
      "text/plain",
      slice.content.textBetween(0, slice.content.size, "\n"),
    );
    event.preventDefault();
    if (cut) view.dispatch(view.state.tr.deleteSelection());
    return true;
  } catch {
    return false;
  }
}
export function pasteSlice(view: EditorView, event: ClipboardEvent): boolean {
  const value = event.clipboardData?.getData(CLIPBOARD_MIME);
  if (!value) return false;
  const slice = parseSlice(view.state.schema, value);
  if (!slice) return false;
  event.preventDefault();
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}
