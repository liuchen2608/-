import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat plan requests require confirmation before create_goal", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /detectHabitPlanIntent\(content\)/);
  assert.match(page, /要把这项行动加入计划吗？/);
  assert.match(page, /取消不会保存/);
  assert.match(page, /action: "create_goal"/);
  assert.match(page, /确认添加/);
  assert.match(page, /<button className="secondary-button"[^>]*onClick=\{close\}[^>]*>取消<\/button>/);
});
