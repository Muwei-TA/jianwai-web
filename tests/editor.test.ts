import { expect, it } from "vitest";
import { SaveQueue } from "../src/editor/saveQueue";
import { safeUrl, assetUrl } from "../src/editor/safety";
import { ApiError } from "../src/api";
it("rejects executable, protocol-relative, and credentials URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,abc",
    "//evil.test",
    "https://user:pass@evil.test",
    "ftp://example.com",
  ])
    expect(safeUrl(url)).toBeNull();
  expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
  expect(assetUrl("../private")).toBe("");
});
it("serializes saves while keeping input typed during a pending request dirty", async () => {
  let finish!: (v: { revision: number }) => void;
  let calls = 0;
  const sent: string[] = [];
  const queue = new SaveQueue({ title: "one" }, 1, async (value, revision) => {
    calls++;
    sent.push(value.title + ":" + revision);
    if (calls === 1)
      return await new Promise((r) => {
        finish = r;
      });
    return { revision: revision + 1 };
  });
  queue.update({ title: "two" });
  const first = queue.save();
  queue.update({ title: "three" });
  const second = queue.save();
  expect(calls).toBe(1);
  finish({ revision: 2 });
  await first;
  expect(queue.current.title).toBe("three");
  await second;
  expect(sent).toEqual(["two:1", "three:2"]);
  expect(queue.dirty).toBe(false);
  expect(queue.revision).toBe(3);
});
it("keeps input and export after a 409, blocks retry until explicit reload", async () => {
  let calls = 0;
  const queue = new SaveQueue({ title: "initial" }, 1, async () => {
    calls++;
    throw new ApiError(409, "STALE_DRAFT", "冲突");
  });
  queue.update({ title: "my input" });
  await expect(queue.save()).rejects.toMatchObject({ status: 409 });
  expect(queue.current.title).toBe("my input");
  expect(queue.dirty).toBe(true);
  expect(queue.blocked).toBe(true);
  expect(JSON.parse(queue.backup()).title).toBe("my input");
  await expect(queue.save()).rejects.toBeDefined();
  expect(calls).toBe(1);
});
it("upload or network failures never mark draft saved", async () => {
  const queue = new SaveQueue({ title: "text" }, 1, async () => {
    throw new Error("上传失败");
  });
  queue.update({ title: "unsaved" });
  await expect(queue.save()).rejects.toThrow();
  expect(queue.dirty).toBe(true);
  expect(queue.revision).toBe(1);
});
it('a completed older save cannot mark more recent input saved', async () => {
  let finish!: (value: { revision: number }) => void;
  const queue = new SaveQueue({ title: 'original' }, 1, async () => await new Promise<{ revision: number }>(resolve => { finish = resolve; }));
  queue.update({ title: 'first change' });
  const pending = queue.save();
  queue.update({ title: 'typed while saving' });
  finish({ revision: 2 });
  await pending;
  expect(queue.current.title).toBe('typed while saving');
  expect(queue.saved.title).toBe('first change');
  expect(queue.dirty).toBe(true);
  expect(queue.revision).toBe(2);
});
