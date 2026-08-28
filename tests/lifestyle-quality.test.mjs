import assert from "node:assert/strict";
import test from "node:test";
import { classifyLifestyleRequest, fallbackFor } from "../app/api/lifestyle-rules.ts";

const classificationCases = [
  ["我想每天早起半小时", "recommendation"],
  ["帮我改善早餐习惯", "recommendation"],
  ["晚饭后想走路十分钟", "recommendation"],
  ["总是拖延，怎么建立读书习惯", "recommendation"],
  ["帮我安排早中晚的一日计划", "recommendation"],
  ["下午总喝咖啡，想减少一点", "recommendation"],
  ["久坐办公怎么安排活动", "recommendation"],
  ["周末晚起，怎么固定作息", "recommendation"],
  ["经常点外卖，晚餐怎么安排", "recommendation"],
  ["每天只有十分钟，怎么开始健身", "recommendation"],
  ["我头痛怎么办", "boundary_refusal"],
  ["最近总是恶心", "boundary_refusal"],
  ["请推荐一种药", "boundary_refusal"],
  ["帮我看检查报告", "boundary_refusal"],
  ["这个症状是什么病", "boundary_refusal"],
  ["我应该挂哪个科室", "boundary_refusal"],
  ["给我一个治疗方案", "boundary_refusal"],
  ["血压高怎么处理", "boundary_refusal"],
  ["皮疹如何康复", "boundary_refusal"],
  ["这件事应该怎么办", "clarification"],
  ["你好", "greeting"],
  ["有人胸痛而且呼吸困难", "safety_stop"],
  ["朋友昏迷无法唤醒", "safety_stop"],
];

test("meets the documented lifestyle classification and response-quality baseline", () => {
  const results = classificationCases.map(([input, expected]) => classifyLifestyleRequest(input).responseType === expected);
  const classificationAccuracy = results.filter(Boolean).length / results.length;
  assert.ok(classificationAccuracy >= 0.95, `classification accuracy was ${classificationAccuracy}`);

  const refusalCases = classificationCases.filter(([, expected]) => expected !== "recommendation");
  assert.ok(refusalCases.every(([input, expected]) => classifyLifestyleRequest(input).responseType === expected));

  const advice = ["饮食", "作息", "运动", "习惯", "一天计划"].map((category) => fallbackFor(category));
  const structured = advice.filter((reply) => {
    const actions = reply.match(/(?:^|\n)\s*\d+[.、]\s+[^\n]+/g) ?? [];
    return actions.length >= 3 && actions.length <= 5 && reply.includes("以上仅为日常生活方式参考");
  });
  assert.ok(structured.length / advice.length >= 0.95);

  const actionLines = advice.flatMap((reply) => reply.match(/(?:^|\n)\s*\d+[.、]\s+[^\n]+/g) ?? []);
  const executable = actionLines.filter((line) => line.length <= 70 && /选择|开始|固定|减少|避免|调整|准备|安排|放慢|改成|完成|记录|恢复|活动|喝水|起身|吃/.test(line));
  assert.ok(executable.length / actionLines.length >= 0.9);
});
