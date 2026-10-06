import { expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Slice } from "@tiptap/pm/model";
import {
  FigureNode,
  GalleryNode,
  LinkCardNode,
  SpoilerMark,
} from "../src/editor/extensions";
import { parseSlice, serializeSlice } from "../src/editor/clipboard";
const schema = getSchema([
  StarterKit,
  FigureNode,
  GalleryNode,
  LinkCardNode,
  SpoilerMark,
]);
it("round-trips figure, gallery, link card, captions and spoiler marks in rich clipboard", () => {
  const body = {
    type: "doc",
    content: [
      {
        type: "figure",
        attrs: {
          assetId: "asset-1",
          caption: "图注",
          alt: "灯光",
          layout: "wide",
          spoiler: true,
        },
      },
      {
        type: "gallery",
        attrs: {
          items: [{ assetId: "asset-2", caption: "第二幅", alt: "月色" }],
          caption: "一组图片",
          layout: "normal",
        },
      },
      {
        type: "linkCard",
        attrs: {
          url: "https://example.com/",
          title: "出处",
          description: "说明",
        },
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "隐藏剧情", marks: [{ type: "spoiler" }] },
        ],
      },
    ],
  };
  const doc = schema.nodeFromJSON(body);
  const slice = new Slice(doc.content, 0, 0);
  const parsed = parseSlice(schema, serializeSlice(slice));
  expect(parsed?.content.toJSON()).toEqual(doc.content.toJSON());
});
it("rejects malformed custom clipboard without throwing into editor input", () => {
  expect(parseSlice(schema, "not-json")).toBeNull();
  expect(
    parseSlice(
      schema,
      JSON.stringify({ version: 1, slice: { content: [{ type: "iframe" }] } }),
    ),
  ).toBeNull();
});
it('rejects untrusted gallery attributes and unsafe links before they reach node views', () => {
  for (const node of [
    {type:'gallery',attrs:{items:'not-an-array'}},
    {type:'figure',attrs:{assetId:'../secret'}},
    {type:'linkCard',attrs:{url:'javascript:alert(1)'}},
  ]) {
    expect(parseSlice(schema,JSON.stringify({version:1,slice:{content:[node],openStart:0,openEnd:0}}))).toBeNull();
  }
});
