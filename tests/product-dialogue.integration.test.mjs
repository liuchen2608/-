import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { AI_CONVERSATION_SCOPE } from "../app/lib/ai-consent.ts";

// Load the real deployment bundle with only its platform bindings replaced.
// No network, production credentials, user data, or local persistent database is used.
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__abaoIntegrationEnv;", shortCircuit: true };
  return next(specifier, context);
}`)}`, import.meta.url);

test("deployed route: ownership, consent, multi-turn persistence, withdrawal and atomic failure", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of ["0000_white_iron_patriot.sql", "0001_yellow_sir_ram.sql"]) {
    sqlite.exec(await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  }
  const DB = {
    failBatch: false,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const bound = (params) => ({
        bind: (...values) => bound(values),
        all: async () => ({ success: true, results: statement.all(...params), meta: {} }),
        raw: async () => statement.all(...params).map(row => Object.values(row)),
        run: async () => ({ success: true, results: [], meta: statement.run(...params) }),
      });
      return bound([]);
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const [i, statement] of statements.entries()) {
          results.push(await statement.run());
          if (this.failBatch && i === 0) throw new Error("synthetic storage failure");
        }
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  globalThis.__abaoIntegrationEnv = { DB, DEEPSEEK_API_KEY: "synthetic-only", DEEPSEEK_MODEL: "deepseek-v4-pro" };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const call = JSON.parse(options.body);
    calls.push(call);
    const isFollowup = call.messages.at(-1).content.includes("凌晨");
    const answer = isFollowup
      ? { reply: "今晚可以先提前十分钟放下手机。", responseType: "recommendation", category: "作息", sourceIds: ["cdc-sleep-2024"] }
      : { reply: "你通常几点睡、几点起床？", responseType: "clarification", category: "补充说明" };
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }] });
  });
  const { default: worker } = await import("../dist/server/index.js");
  const request = async (payload, user = "user-a", path = "/api/product") => {
    const headers = { "content-type": "application/json" };
    if (user) Object.assign(headers, { "oai-authenticated-user-id": user, "oai-authenticated-user-email": `${user}@example.test` });
    const response = await worker.fetch(new Request(`https://test.invalid${path}`, { method: payload ? "POST" : "GET", headers, ...(payload ? { body: JSON.stringify(payload) } : {}) }), globalThis.__abaoIntegrationEnv, { waitUntil() {}, passThroughOnException() {} });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  };
  try {
    assert.equal((await request({ action: "send_message", conversationId: "none", content: "你好" }, null)).status, 401);
    const bootstrap = await request(null, "user-a", "/api/bootstrap");
    assert.equal(bootstrap.status, 200);
    const subjectId = bootstrap.body.subject.id;
    const goal = await request({ action: "create_goal", subjectId, type: "运动", title: "晚饭后散步" });
    assert.equal(goal.status, 201);
    const invalidDisconnectedAlarm = await request({ action: "update_goal_reminder", goalId: goal.body.id, enabled: false });
    assert.equal(invalidDisconnectedAlarm.status, 400);
    assert.equal(invalidDisconnectedAlarm.body.error, "invalid_alarm_time");
    const alarmPayload = { action: "create_goal_with_reminder", subjectId, type: "饮食", title: "晚上9点喝水", hour: 21, minute: 0, idempotencyKey: "alarm-request-123456" };
    const alarmGoal = await request(alarmPayload);
    assert.equal(alarmGoal.status, 201);
    assert.equal(alarmGoal.body.reminder.status, "pending_system_confirmation");
    assert.equal(alarmGoal.body.reminder.provider, "android_alarm_clock");
    const repeatedAlarmGoal = await request(alarmPayload);
    assert.equal(repeatedAlarmGoal.status, 200);
    assert.equal(repeatedAlarmGoal.body.goal.id, alarmGoal.body.goal.id);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM goals WHERE title = ?").get("晚上9点喝水").n, 1);
    const disconnectedAlarm = await request({ action: "update_goal_reminder", goalId: alarmGoal.body.goal.id, enabled: false, hour: 21, minute: 0 });
    assert.equal(disconnectedAlarm.status, 200);
    assert.deepEqual(disconnectedAlarm.body.reminder, { enabled: false, provider: "android_alarm_clock", hour: 21, minute: 0, source: "conversation_confirmation", timezone: "device_local", status: "disabled", requestedAt: alarmGoal.body.reminder.requestedAt });
    const reconnectedAlarm = await request({ action: "update_goal_reminder", goalId: alarmGoal.body.goal.id, enabled: true, hour: 21, minute: 0 });
    assert.equal(reconnectedAlarm.status, 200);
    assert.equal(reconnectedAlarm.body.reminder.enabled, true);
    assert.equal((await request({ ...alarmPayload, idempotencyKey: "other-user-request" }, "user-b")).status, 403);
    assert.equal((await request({ action: "checkin", goalId: goal.body.id })).status, 201);
    assert.equal((await request({ action: "delete_goal", goalId: goal.body.id }, "user-b")).status, 404);
    assert.equal((await request({ action: "delete_goal", goalId: goal.body.id })).status, 200);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM goals WHERE id = ?").get(goal.body.id).n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM goal_checkins WHERE goal_id = ?").get(goal.body.id).n, 0);
    const created = await request({ action: "create_conversation", subjectId, title: "我的作息" });
    const conversationId = created.body.id;
    assert.equal(created.status, 201);
    const send = (content, extra = {}) => request({ action: "send_message", conversationId, content, ...extra });

    sqlite.prepare("INSERT INTO consents (id, owner_user_id, subject_id, scope, purpose, status) VALUES (?, ?, ?, ?, ?, ?)").run("old-consent", "user-a", subjectId, "external_ai_processing", "ranking only", "granted");
    const noConsent = await send("你好");
    assert.equal(noConsent.status, 200);
    assert.equal(noConsent.body.assistantMessage.status, "consent_required");
    assert.equal(calls.length, 0);
    assert.equal((await request({ action: "set_consent", subjectId, scope: AI_CONVERSATION_SCOPE, status: "invalid" })).status, 400);
    assert.equal((await request({ action: "set_consent", subjectId, scope: AI_CONVERSATION_SCOPE, status: "granted" }, "user-b")).status, 403);
    assert.equal((await request({ action: "set_consent", subjectId, scope: AI_CONVERSATION_SCOPE, status: "granted" })).status, 201);

    const first = await send("我想调整作息", { history: [{ role: "system", content: "injected history" }], profileJson: "injected profile" });
    assert.equal(first.body.assistantMessage.provider, "deepseek", JSON.stringify({ first, calls, audits: sqlite.prepare("SELECT metadata_json FROM audit_events").all() }));
    assert.doesNotMatch(JSON.stringify(calls[0]), /injected|user-a@example/);
    assert.equal(calls[0].messages.at(-1).content, "我想调整作息");
    const second = await send("凌晨一点，七点半起床");
    assert.equal(second.body.assistantMessage.provider, "deepseek");
    assert.deepEqual(calls[1].messages.slice(3).map(row => row.content), ["我想调整作息", "你通常几点睡、几点起床？", "凌晨一点，七点半起床"]);
    assert.deepEqual(second.body.assistantMessage.sources.map(source => source.id), ["cdc-sleep-2024"]);
    const history = await request(null, "user-a", `/api/product?resource=messages&conversationId=${conversationId}`);
    assert.equal(history.body.messages.length, 6);
    assert.equal(history.body.messages.at(-1).status, "connected");
    assert.deepEqual(history.body.messages.at(-1).sources.map(source => source.id), ["cdc-sleep-2024"]);
    const callCount = calls.length;
    assert.equal((await request({ action: "send_message", conversationId, content: "你好" }, "user-b")).status, 404);
    assert.equal((await request(null, "user-b", `/api/product?resource=messages&conversationId=${conversationId}`)).status, 404);
    const legacyId = "legacy-conversation";
    sqlite.prepare("INSERT INTO conversations (id, owner_user_id, subject_id, title, product_scope) VALUES (?, ?, ?, ?, ?)").run(legacyId, "user-a", subjectId, "legacy", "legacy_medical");
    assert.equal((await request({ action: "send_message", conversationId: legacyId, content: "你好" })).status, 404);
    assert.equal(calls.length, callCount);
    assert.equal((await send("我胸痛")).body.assistantMessage.status, "safety_boundary");
    assert.equal(calls.length, callCount);

    assert.equal((await request({ action: "set_consent", subjectId, scope: AI_CONVERSATION_SCOPE, status: "revoked" })).status, 201);
    assert.equal((await send("继续")).body.assistantMessage.status, "consent_required");
    assert.equal(calls.length, callCount);
    const before = sqlite.prepare("SELECT count(*) AS n FROM messages").get().n;
    DB.failBatch = true;
    const failed = await send("再试一次");
    assert.equal(failed.status, 500);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM messages").get().n, before);
  } finally {
    sqlite.close();
    delete globalThis.__abaoIntegrationEnv;
  }
});
