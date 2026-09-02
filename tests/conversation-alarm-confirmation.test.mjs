import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("conversation alarm requests expose a human confirmation and system-alarm permission", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /getAlarmPlanConfirmation\(content, responseType\)/);
  assert.match(page, /添加到我的闹钟？/);
  assert.match(page, /同时设置系统闹钟/);
  assert.match(page, /role="switch"[\s\S]*?aria-checked=\{connectSystemAlarm\}/);
  assert.match(page, /确认并打开系统闹钟/);
  assert.match(page, /action: "create_goal_with_reminder"/);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /pending_system_confirmation/);
  assert.match(page, /取消不会保存，也不会打开系统闹钟/);
});

test("my alarms is a first-class page derived from owned goals", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /type PageName = [^;]*"我的闹钟"/);
  assert.match(page, /function AlarmPage/);
  assert.match(page, /readAlarmEnabled\(goal\.reminderJson\)/);
  assert.match(page, /待系统确认/);
  assert.match(page, /className=\{`alarm-connection-toggle \$\{reminder\.enabled \? "is-enabled" : ""\}`\}/);
  assert.match(page, /role="switch" aria-checked=\{reminder\.enabled\}/);
  assert.match(page, /action: "update_goal_reminder"/);
  assert.match(page, /正在打开系统闹钟，请确认删除对应闹钟/);
  assert.match(page, /已更新网页中的闹钟连接状态/);
});
