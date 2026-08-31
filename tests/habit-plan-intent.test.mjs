import assert from "node:assert/strict";
import test from "node:test";
import { detectHabitPlanIntent, getHabitPlanConfirmation } from "../app/habit-plan-intent.ts";

test("detects explicit requests to save a habit plan", () => {
  assert.deepEqual(detectHabitPlanIntent("帮我添加一个晚饭后散步10分钟的计划"), {
    type: "运动",
    title: "",
  });
  assert.deepEqual(detectHabitPlanIntent("把早睡加入习惯计划"), {
    type: "作息",
    title: "",
  });
  assert.deepEqual(detectHabitPlanIntent("保存一个每天喝水的目标"), {
    type: "饮食",
    title: "",
  });
});

test("does not open confirmation for advice or negated requests", () => {
  assert.equal(detectHabitPlanIntent("给我一份新手运动计划"), null);
  assert.equal(detectHabitPlanIntent("不要添加计划"), null);
  assert.equal(detectHabitPlanIntent("先不把早睡加入习惯计划"), null);
});

test("supports a plan-first command and never invents a title", () => {
  assert.deepEqual(detectHabitPlanIntent("添加计划：每天午饭后走路十五分钟"), {
    type: "运动",
    title: "",
  });
  const proposal = detectHabitPlanIntent(`创建目标：${"早睡".repeat(50)}`);
  assert.equal(proposal?.type, "作息");
  assert.equal(proposal?.title, "");
});

test("recognizes 放入习惯计划 as an explicit save request", () => {
  assert.deepEqual(detectHabitPlanIntent("我想下午2点喝水，帮我把计划放入习惯计划中"), {
    type: "饮食",
    title: "",
  });
});

test("never offers habit-plan confirmation after a safety boundary", () => {
  const input = "我想下午2点吃药，帮我把计划放入习惯计划中";
  assert.equal(getHabitPlanConfirmation(input, "boundary_refusal"), null);
  assert.equal(getHabitPlanConfirmation(input, "safety_stop"), null);
  assert.deepEqual(getHabitPlanConfirmation("我想下午2点喝水，帮我把计划放入习惯计划中", "recommendation"), {
    type: "饮食",
    title: "",
  });
});
