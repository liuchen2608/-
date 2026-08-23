import assert from "node:assert/strict";
import test from "node:test";
import { mergeLifestylePreferences } from "../app/api/lifestyle-profile.ts";

test("saving lifestyle preferences preserves existing profile data", () => {
  const existing = JSON.stringify({
    profileText: "历史档案说明",
    legacySetting: { retained: true },
    lifestylePreferences: { wakeTime: "08:00" },
  });

  const merged = JSON.parse(mergeLifestylePreferences(existing, {
    wakeTime: "07:30",
    sleepTime: "23:00",
  }));

  assert.equal(merged.profileText, "历史档案说明");
  assert.deepEqual(merged.legacySetting, { retained: true });
  assert.deepEqual(merged.lifestylePreferences, {
    wakeTime: "07:30",
    sleepTime: "23:00",
  });
});

test("saving preferences recovers safely from malformed legacy profile JSON", () => {
  assert.deepEqual(JSON.parse(mergeLifestylePreferences("not-json", { wakeTime: "07:30" })), {
    lifestylePreferences: { wakeTime: "07:30" },
  });
});
