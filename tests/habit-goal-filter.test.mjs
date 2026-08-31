import assert from "node:assert/strict";
import test from "node:test";
import { filterGoalsByType } from "../app/habit-goal-filter.ts";

const goals = [
  { id: "sleep", type: "作息", title: "晚上十点散步" },
  { id: "meal", type: "饮食", title: "午餐加一份蔬菜" },
  { id: "run", type: "运动", title: "下午跑步" },
  { id: "read", type: "日常习惯", title: "睡前阅读" },
];

test("category tabs show only matching habit plans", () => {
  assert.deepEqual(filterGoalsByType(goals, "作息").map((goal) => goal.id), ["sleep"]);
  assert.deepEqual(filterGoalsByType(goals, "饮食").map((goal) => goal.id), ["meal"]);
  assert.deepEqual(filterGoalsByType(goals, "运动").map((goal) => goal.id), ["run"]);
});

test("日常习惯 is the overview that shows every category together", () => {
  assert.deepEqual(filterGoalsByType(goals, "日常习惯"), goals);
});

