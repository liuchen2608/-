import assert from "node:assert/strict";
import test from "node:test";
import { buildRagContext, resolveCitedSources, restoreStoredSources, retrieveLifestyleKnowledge, RAG_SOURCE_COUNT } from "../app/api/lifestyle-rag.ts";

test("retrieves relevant authoritative lifestyle knowledge", () => {
  assert.ok(RAG_SOURCE_COUNT >= 7);
  assert.equal(retrieveLifestyleKnowledge("我经常熬夜，睡前还在刷手机")[0].source.id, "cdc-sleep-2024");
  assert.equal(retrieveLifestyleKnowledge("刚开始运动，每天只有十分钟")[0].category, "运动");
  assert.equal(retrieveLifestyleKnowledge("怎么建立读书习惯并记录坚持情况")[0].source.id, "niddk-changing-habits");
  const day = retrieveLifestyleKnowledge("帮我安排健康的一天");
  assert.ok(day.some((hit) => hit.category === "一天计划"));
  assert.ok(day.some((hit) => ["饮食", "作息", "运动"].includes(hit.category)));
});

test("returns no context for unrelated greetings and clarification", () => {
  assert.deepEqual(retrieveLifestyleKnowledge("你好"), []);
  assert.deepEqual(retrieveLifestyleKnowledge("这件事怎么办"), []);
});

test("builds bounded reference context without user-controlled links", () => {
  const hits = retrieveLifestyleKnowledge("晚餐总点外卖，想吃得均衡");
  const context = buildRagContext(hits);
  assert.match(context, /来源ID: who-healthy-diet-2026/);
  assert.match(context, /不要混淆盐与钠/);
  assert.doesNotMatch(context, /javascript:|<script/i);
  assert.ok(context.length < 5000);
});

test("only resolves server-allowlisted source ids and removes duplicates", () => {
  const hits = retrieveLifestyleKnowledge("我想调整作息");
  const sources = resolveCitedSources(hits, ["cdc-sleep-2024", "invented-source", "cdc-sleep-2024"]);
  assert.deepEqual(sources.map((source) => source.id), ["cdc-sleep-2024"]);
  assert.match(sources[0].url, /^https:\/\/(?:www\.)?cdc\.gov\//);
  assert.deepEqual(restoreStoredSources(JSON.stringify(["cdc-sleep-2024", "javascript:alert(1)"])).map((source) => source.id), ["cdc-sleep-2024"]);
  assert.deepEqual(restoreStoredSources("not json"), []);
});
