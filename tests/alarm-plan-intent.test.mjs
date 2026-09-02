import assert from "node:assert/strict";
import test from "node:test";
import { getAlarmPlanConfirmation } from "../app/alarm-plan-intent.ts";

test("detects an explicit conversation request to add a timed alarm", () => {
  assert.deepEqual(getAlarmPlanConfirmation("把晚上9:00提醒我喝水添加到习惯计划中"), {
    type: "饮食",
    title: "晚上9:00喝水",
    hour: 21,
    minute: 0,
    displayTime: "21:00",
    source: "user_message",
  });
  assert.deepEqual(getAlarmPlanConfirmation("把早上七点半起床设成闹铃"), {
    type: "作息",
    title: "早上七点半起床",
    hour: 7,
    minute: 30,
    displayTime: "07:30",
    source: "user_message",
  });
});

test("requires explicit alarm intent and an exact time", () => {
  assert.equal(getAlarmPlanConfirmation("给我一个早睡计划"), null);
  assert.equal(getAlarmPlanConfirmation("每天运动十分钟并加入计划"), null);
  assert.equal(getAlarmPlanConfirmation("不要设闹钟，给我一个散步建议"), null);
});

test("never offers alarm confirmation after a safety response", () => {
  assert.equal(getAlarmPlanConfirmation("晚上九点提醒我吃药", "boundary_refusal"), null);
  assert.equal(getAlarmPlanConfirmation("晚上九点提醒我胸痛时休息", "safety_stop"), null);
});

