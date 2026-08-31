import assert from "node:assert/strict";
import test from "node:test";
import { buildAndroidAlarmIntent, parseAlarmTimeFromTitle, readAlarmEnabled } from "../app/alarm-reminder.ts";

test("extracts explicit Chinese task times without mistaking durations for alarms", () => {
  assert.deepEqual(parseAlarmTimeFromTitle("晚上10点去散步"), { hour: 22, minute: 0, display: "22:00" });
  assert.deepEqual(parseAlarmTimeFromTitle("早上七点半喝水"), { hour: 7, minute: 30, display: "07:30" });
  assert.deepEqual(parseAlarmTimeFromTitle("下午2：05整理房间"), { hour: 14, minute: 5, display: "14:05" });
  assert.deepEqual(parseAlarmTimeFromTitle("中午12点一刻吃饭"), { hour: 12, minute: 15, display: "12:15" });
  assert.equal(parseAlarmTimeFromTitle("晚饭后散步10分钟"), null);
  assert.equal(parseAlarmTimeFromTitle("每天运动"), null);
});

test("reads only Android alarm reminder state", () => {
  assert.equal(readAlarmEnabled('{"enabled":true,"provider":"android_alarm_clock"}'), true);
  assert.equal(readAlarmEnabled('{"enabled":true}'), false);
  assert.equal(readAlarmEnabled("not-json"), false);
});

test("builds an Android package intent with a safe download fallback", () => {
  const intent = buildAndroidAlarmIntent({ operation: "set", goalId: "goal 1", title: "晚上10点去散步", hour: 22, minute: 0, fallbackUrl: "https://example.com/downloads/app.apk" });
  assert.match(intent, /^intent:\/\/alarm\?/);
  assert.match(intent, /scheme=daxiangabao/);
  assert.match(intent, /package=com\.daxiangabao\.health/);
  assert.match(intent, /browser_fallback_url=https%3A%2F%2Fexample\.com%2Fdownloads%2Fapp\.apk/);
});

test("habit reminder API validates and owns reminder updates", async () => {
  const api = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../app/api/product/route.ts", import.meta.url), "utf8"));
  assert.match(api, /action === "update_goal_reminder"/);
  assert.match(api, /eq\(goals\.ownerUserId, identity\.userId\)/);
  assert.match(api, /invalid_alarm_time/);
  assert.match(api, /android_alarm_requested/);
});
