import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const activityUrl = new URL("../android-app/app/src/main/java/com/daxiangabao/health/MainActivity.java", import.meta.url);
const gradleUrl = new URL("../android-app/app/build.gradle.kts", import.meta.url);

test("Android helper exposes an interactive mobile home while preserving alarm deep links", async () => {
  const source = await readFile(activityUrl, "utf8");

  assert.match(source, /showHome\(\)/);
  assert.match(source, /进入大象阿宝主页/);
  assert.match(source, /快速设置闹钟/);
  assert.match(source, /new TimePicker\(this\)/);
  assert.match(source, /设置系统闹钟/);
  assert.match(source, /查看我的闹钟/);
  assert.match(source, /daxiangabao/);
  assert.match(source, /AlarmClock\.ACTION_SET_ALARM/);
  assert.match(source, /AlarmClock\.ACTION_SHOW_ALARMS/);
});

test("interactive Android home ships as a newer installable version", async () => {
  const gradle = await readFile(gradleUrl, "utf8");

  assert.match(gradle, /versionCode = 2/);
  assert.match(gradle, /versionName = "1\.1\.0"/);
});
