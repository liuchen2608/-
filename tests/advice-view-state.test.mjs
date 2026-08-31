import assert from "node:assert/strict";
import test from "node:test";
import { getAdviceViewMode } from "../app/advice-view-state.ts";

test("the first submission leaves the welcome layout immediately", () => {
  assert.equal(getAdviceViewMode(0, false), "welcome");
  assert.equal(getAdviceViewMode(0, true), "conversation");
  assert.equal(getAdviceViewMode(2, false), "conversation");
});
