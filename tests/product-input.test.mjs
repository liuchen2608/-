import assert from "node:assert/strict";
import test from "node:test";
import { parseGoalInput, parseMessageInput, readJsonObject } from "../app/api/product-input.ts";

test("goal input accepts only supported types and a non-empty title", () => {
  assert.deepEqual(parseGoalInput({ type: "运动", title: "  晚饭后散步 10 分钟  " }), {
    ok: true,
    value: {
      type: "运动",
      title: "晚饭后散步 10 分钟",
      plan: { cycle: "weekly", dailyAction: "晚饭后散步 10 分钟", checkin: "manual" },
    },
  });
  assert.deepEqual(parseGoalInput({ type: "医疗", title: "每天吃药" }), { ok: false, error: "invalid_goal_type" });
  assert.deepEqual(parseGoalInput({ type: "运动", title: "   " }), { ok: false, error: "goal_title_required" });
});

test("invalid JSON produces a stable client error instead of throwing", async () => {
  const result = await readJsonObject(new Request("http://localhost/api/product", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.deepEqual(result, { ok: false, error: "invalid_json" });
});

test("message input accepts only non-empty strings", () => {
  assert.deepEqual(parseMessageInput({ conversationId: " conversation-1 ", content: "  调整晚餐时间  " }), {
    ok: true,
    value: { conversationId: "conversation-1", content: "调整晚餐时间" },
  });
  assert.deepEqual(parseMessageInput({ conversationId: ["conversation-1"], content: "hello" }), { ok: false, error: "invalid_conversation_id" });
  assert.deepEqual(parseMessageInput({ conversationId: "conversation-1", content: { text: "hello" } }), { ok: false, error: "invalid_content" });
  assert.deepEqual(parseMessageInput({ conversationId: "conversation-1", content: " ".repeat(3) }), { ok: false, error: "content_required" });
  assert.deepEqual(parseMessageInput({ conversationId: "conversation-1", content: "x".repeat(2001) }), { ok: false, error: "content_too_long" });
});
