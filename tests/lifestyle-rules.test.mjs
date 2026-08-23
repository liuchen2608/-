import assert from "node:assert/strict";
import test from "node:test";
import {
  BOUNDARY_REPLY,
  SAFETY_STOP_REPLY,
  classifyLifestyleRequest,
  containsProhibitedOutput,
  finalizeLifestyleReply,
  prioritizeFallbackReply,
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
    const actionCount = result.reply.match(/(?:^|\n)\s*\d+[.、]\s+/g)?.length ?? 0;
    assert.ok(actionCount >= 3 && actionCount <= 5, `expected 3–5 actions, received ${actionCount}`);
  });
}

for (const input of [
  "请帮我诊断是什么病",
  "能不能推荐药品",
  "帮我解读检查报告",
  "应该去哪个科室",
  "我头疼怎么办",
  "最近一直肚子疼",
  "吃完饭总是恶心怎么缓解",
  "头疼的时候怎么运动",
  "最近身体很不舒服",
  "头孢怎么吃",
  "华法林怎么搭配早餐",
  "糖尿病人早餐怎么吃",
  "孕妇怎么安排运动",
  "甲亢怎么运动",
  "痛风晚餐怎么安排",
  "癫痫如何调整作息",
  "红斑狼疮患者怎么健身",
]) {
  test("refuses requests outside lifestyle scope", () => {
    const result = classifyLifestyleRequest(input);
    assert.equal(result.responseType, "boundary_refusal");
    assert.equal(result.reply, BOUNDARY_REPLY);
  });
}

for (const input of ["有人意识不清，怎么办", "有人窒息了", "疑似心梗", "大量出血", "有人噎住了", "疑似脑卒中", "吞了很多安眠药"]) {
  test("stops on urgent wording", () => {
    const result = classifyLifestyleRequest(input);
    assert.equal(result.responseType, "safety_stop");
    assert.equal(result.reply, SAFETY_STOP_REPLY);
  });
}

test("preserves deterministic guard replies instead of applying recommendation formatting", () => {
  const urgent = classifyLifestyleRequest("有人意识不清，怎么办");
  const boundary = classifyLifestyleRequest("请帮我诊断是什么病");
  assert.equal(finalizeLifestyleReply(urgent, "模型不应处理这条请求"), SAFETY_STOP_REPLY);
  assert.equal(finalizeLifestyleReply(boundary, "模型不应处理这条请求"), BOUNDARY_REPLY);
});

test("replaces prohibited model output with deterministic fallback", () => {
  const fallback = classifyLifestyleRequest("想改善晚餐习惯").reply;
  const valid = "可以从今天晚餐开始：\n\n1. 提前半小时吃饭。\n2. 先准备一份蔬菜。\n3. 吃到舒适就停下。\n\n以上仅为日常生活方式参考。";
  assert.equal(containsProhibitedOutput("这里是一份治疗方案"), true);
  assert.equal(containsProhibitedOutput("1. 口服布洛芬 200mg。\n2. 每天两次。\n3. 连续三天。\n\n以上仅为日常生活方式参考。"), true);
  assert.equal(safeModelReply("这里是一份治疗方案", fallback), fallback);
  assert.equal(safeModelReply("1. 口服布洛芬 200mg。\n2. 每天两次。\n3. 连续三天。\n\n以上仅为日常生活方式参考。", fallback), fallback);
  assert.equal(safeModelReply("今晚把晚餐提前半小时。", fallback), fallback);
  assert.equal(safeModelReply(valid, fallback), fallback);
  assert.equal(safeModelReply(fallback, fallback), fallback);
  const prioritized = prioritizeFallbackReply(fallback, 2);
  assert.match(prioritized, /建议优先从第 2 项开始/);
  assert.equal(finalizeLifestyleReply(classifyLifestyleRequest("想改善晚餐习惯"), prioritized), prioritized);
  assert.equal(finalizeLifestyleReply(classifyLifestyleRequest("想改善晚餐习惯"), valid), fallback);
  assert.equal(prioritizeFallbackReply(fallback, 9), fallback);
});

test("keeps explicit non-medical habit requests in scope", () => {
  const result = classifyLifestyleRequest("总是拖延，想建立每天读书十分钟的习惯");
  assert.equal(result.responseType, "recommendation");
  assert.equal(result.category, "习惯");
});
