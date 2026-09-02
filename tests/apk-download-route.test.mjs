import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../dist/server/index.js";

test("the public Android download route returns the complete APK as an attachment", async () => {
  const apk = await readFile(new URL("../public/downloads/daxiang-abao-alarm-xiaomi12spro-v1.1.4.apk", import.meta.url));
  const response = await worker.fetch(
    new Request("https://example.com/download/android"),
    {
      ASSETS: {
        fetch: async (request) => new URL(request.url).pathname === "/downloads/daxiang-abao-alarm-xiaomi12spro-v1.1.4.apk"
          ? new Response(apk, { headers: { "content-type": "application/octet-stream" } })
          : new Response("not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/vnd.android.package-archive");
  assert.match(response.headers.get("content-disposition") ?? "", /^attachment; filename="daxiang-abao-alarm-xiaomi12spro-v1\.1\.4\.apk"$/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), apk);
});
