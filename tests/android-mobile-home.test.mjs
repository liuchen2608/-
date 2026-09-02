import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const activityUrl = new URL("../android-app/app/src/main/java/com/daxiangabao/health/MainActivity.java", import.meta.url);
const gradleUrl = new URL("../android-app/app/build.gradle.kts", import.meta.url);
const manifestUrl = new URL("../android-app/app/src/main/AndroidManifest.xml", import.meta.url);

test("Android helper exposes an interactive mobile home while preserving alarm deep links", async () => {
  const source = await readFile(activityUrl, "utf8");

  assert.match(source, /showHome\(\)/);
  assert.match(source, /进入大象阿宝主页/);
  assert.match(source, /showWebsiteInApp\(\)/);
  assert.match(source, /new WebView\(this\)/);
  assert.match(source, /setWebViewClient/);
  assert.doesNotMatch(source, /openHome\.setOnClickListener\(view -> openWebsite\(\)\)/);
  assert.match(source, /快速设置闹钟/);
  assert.match(source, /new TimePicker\(this\)/);
  assert.match(source, /设置系统闹钟/);
  assert.match(source, /查看我的闹钟/);
  assert.match(source, /daxiangabao/);
  assert.match(source, /AlarmClock\.ACTION_SET_ALARM/);
  assert.match(source, /AlarmClock\.ACTION_SHOW_ALARMS/);
});

test("the in-app homepage has network access without handing the home button to a browser", async () => {
  const source = await readFile(activityUrl, "utf8");
  const manifest = await readFile(manifestUrl, "utf8");

  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(source, /setAllowFileAccess\(false\)/);
  assert.match(source, /setAllowContentAccess\(false\)/);
  assert.match(source, /MIXED_CONTENT_NEVER_ALLOW/);
  assert.doesNotMatch(source, /else startActivity\(parsed\)/);
  assert.match(source, /不支持打开这个外部链接/);
  assert.match(source, /onReceivedHttpError/);
  assert.match(source, /getStatusCode\(\) == 403/);
  assert.match(source, /showWebsiteBlocked\(\)/);
  assert.match(source, /网页安全验证未通过/);
  assert.match(source, /使用系统浏览器打开/);
});

test("interactive Android home ships as a newer installable version", async () => {
  const gradle = await readFile(gradleUrl, "utf8");

  assert.match(gradle, /versionCode = 6/);
  assert.match(gradle, /versionName = "1\.1\.4"/);
});
