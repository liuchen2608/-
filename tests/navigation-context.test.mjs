import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sidebar home preserves the mounted advice context", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<Icon name="home" \/><span>首页<\/span>/);
  assert.match(page, /onClick=\{\(\) => go\("生活建议"\)\}/);
  assert.match(page, /<Icon name="chat" \/><span>新对话<\/span>/);
  assert.match(page, /className="advice-panel" hidden=\{page !== "生活建议"\}/);
  assert.match(page, /<AdvicePage[\s\S]*<\/section>/);
});
