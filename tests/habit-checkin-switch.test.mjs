import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("habit check-in uses an accessible visual switch", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /className=\{`goal-toggle/);
  assert.match(page, /role="switch"/);
  assert.match(page, /aria-checked=\{isComplete\}/);
  assert.match(page, /今日已完成/);
  assert.match(page, /今日未完成/);
  assert.doesNotMatch(page, /完成今日行动/);
});

