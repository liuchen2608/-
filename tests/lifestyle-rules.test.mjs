import assert from "node:assert/strict";
import test from "node:test";
import {
  BOUNDARY_REPLY,
  SAFETY_STOP_REPLY,
  classifyLifestyleRequest,
  containsProhibitedOutput,
  safeModelReply,
} from "../app/api/lifestyle-rules.ts";

const recommendationCases = [
  ["我晚上总是很晚睡，想调整作息", "作息"],
  ["帮我改善早餐习惯", "饮食"],
  ["每天只有十分钟，怎么开始运动", "运动"],
  ["帮我安排早中晚的健康生活计划", "一天计划"],
  ["总是忘记喝水，怎么养成习惯", "饮食"],
];

for (const [input, category] of recommendationCases) {
  test(`classifies lifestyle request: ${category}`, () => {
    const result = classifyLifestyleRequest(input);
    assert.equal(result.responseType, "recommendation");
    assert.equal(result.category, category);
    assert.ok(result.reply.includes("以上仅为日常生活方式参考"));
  });
}

for (const input of ["请帮我诊断是什么病", "能不能推荐药品", "帮我解读检查报告", "应该去哪个科室"]) {
  test("refuses requests outside lifestyle scope", () => {
    const result = classifyLifestyleRequest(input);
    assert.equal(result.responseType, "boundary_refusal");
    assert.equal(result.reply, BOUNDARY_REPLY);
  });
}

test("stops on urgent wording", () => {
  const result = classifyLifestyleRequest("有人意识不清，怎么办");
  assert.equal(result.responseType, "safety_stop");
  assert.equal(result.reply, SAFETY_STOP_REPLY);
});

test("replaces prohibited model output with deterministic fallback", () => {
  const fallback = classifyLifestyleRequest("想改善晚餐习惯").reply;
  assert.equal(containsProhibitedOutput("这里是一份治疗方案"), true);
  assert.equal(safeModelReply("这里是一份治疗方案", fallback), fallback);
  assert.equal(safeModelReply("今晚把晚餐提前半小时。", fallback), "今晚把晚餐提前半小时。");
});
