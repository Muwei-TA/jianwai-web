import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Body from "../src/editor/Body";
it("renders text and trusted local asset IDs without arbitrary HTML or attributes", () => {
  const html = renderToStaticMarkup(
    <Body
      body={{
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "<script>alert(1)</script>",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(2)" } },
                ],
              },
            ],
          },
          {
            type: "figure",
            attrs: {
              assetId: "valid-asset",
              caption: "说明",
              alt: "图",
              onerror: "alert(3)",
            },
          },
          { type: "image", attrs: { src: "https://evil.test" } },
        ],
      }}
    />,
  );
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("/api/v1/media/valid-asset");
  expect(html).toContain("说明");
  expect(html).not.toContain("javascript:");
  expect(html).not.toContain("onerror");
  expect(html).not.toContain("evil.test");
});
it("does not expose spoiler text in a public excerpt style renderer", () => {
  const html = renderToStaticMarkup(
    <Body
      body={{
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "结局是…", marks: [{ type: "spoiler" }] },
            ],
          },
        ],
      }}
    />,
  );
  expect(html).toContain("点击查看剧透");
  expect(html).not.toContain("结局是");
});
