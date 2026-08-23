import { and, desc, eq, like, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { consents, conversations, feedback, goalCheckins, goals, healthSubjects, messages, users } from "../../../db/schema";
import { apiIdentity, audit, db, id, json, now, unauthorized } from "../_lib";
import { BOUNDARY_REPLY, classifyLifestyleRequest, safeModelReply, type LifestyleCategory } from "../lifestyle-rules";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ModelAnswer = { reply: string; modelVersion: string; provider: "deepseek" | "rules_fallback"; error?: string };

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const LIFESTYLE_SYSTEM_PROMPT = `你是“大象阿宝”，面向普通成年人的中文健康生活助手。
你只提供饮食、作息、运动和习惯管理方面的日常生活建议。

回答要求：
1. 先用一句话回应用户，再给出 3 至 5 条当天可以开始的具体行动。
2. 每条建议必须低门槛、可选择、可判断是否完成，不依赖专业设备或特殊产品。
3. 结尾推荐用户今天先完成一项，必要时只追问 1 至 2 个生活习惯问题。
4. 使用“可以尝试”“建议优先”“如果方便”等温和表达，不承诺效果。
5. 只询问作息时间、饮食偏好、运动频率、可用时间和生活目标。
6. 不判断身体状况，不分析原因，不提供诊断、治疗、药品、检查资料、机构或科室相关内容。
7. 不宣称食物、运动或作息可以治疗任何问题。
8. 结尾写“以上仅为日常生活方式参考”。`;

function deepseekConfig() {
  const runtime = env as unknown as Record<string, unknown>;
  return {
    apiKey: typeof runtime.DEEPSEEK_API_KEY === "string" ? runtime.DEEPSEEK_API_KEY : "",
    model: typeof runtime.DEEPSEEK_MODEL === "string" && runtime.DEEPSEEK_MODEL ? runtime.DEEPSEEK_MODEL : "deepseek-v4-pro",
  };
}

async function ownedSubject(ownerUserId: string, subjectId: string) {
  return (await db().select().from(healthSubjects).where(and(eq(healthSubjects.id, subjectId), eq(healthSubjects.ownerUserId, ownerUserId), eq(healthSubjects.authorizationStatus, "active"))).limit(1))[0];
}

async function ownedConversation(ownerUserId: string, conversationId: string) {
  return (await db().select({ id: conversations.id, subjectId: conversations.subjectId }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.ownerUserId, ownerUserId))).limit(1))[0];
}

async function hasAiProcessingConsent(ownerUserId: string, subjectId: string) {
  const latest = (await db().select({ status: consents.status }).from(consents).where(and(eq(consents.ownerUserId, ownerUserId), eq(consents.subjectId, subjectId), eq(consents.scope, "external_ai_processing"))).orderBy(desc(consents.createdAt)).limit(1))[0];
  return latest?.status === "granted";
}

function lifestylePreferences(subject: typeof healthSubjects.$inferSelect) {
  try { return JSON.parse(subject.profileJson || "{}").lifestylePreferences ?? {}; } catch { return {}; }
}

async function answerWithDeepSeek(history: ChatMessage[], fallback: string, category: LifestyleCategory, preferences: unknown): Promise<ModelAnswer> {
  const { apiKey, model } = deepseekConfig();
  if (!apiKey) return { reply: fallback, modelVersion: "lifestyle-rules-v1", provider: "rules_fallback", error: "missing_api_key" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${LIFESTYLE_SYSTEM_PROMPT}\n当前生活场景：${category}。\n用户主动保存的生活偏好：${JSON.stringify(preferences)}` },
          ...history,
        ],
        temperature: 0.35,
        max_tokens: 750,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`deepseek_http_${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = safeModelReply(payload.choices?.[0]?.message?.content ?? "", fallback);
    return { reply, modelVersion: model, provider: reply === fallback ? "rules_fallback" : "deepseek" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "deepseek_unknown_error";
    return { reply: fallback, modelVersion: "lifestyle-rules-v1", provider: "rules_fallback", error: reason.slice(0, 80) };
  } finally { clearTimeout(timeout); }
}

function mappedMessage(row: typeof messages.$inferSelect) {
  let context: Record<string, unknown> = {};
  try { context = JSON.parse(row.contextJson || "{}"); } catch { context = {}; }
  return { ...row, category: context.category ?? "生活建议", responseType: context.responseType ?? "recommendation", provider: context.provider ?? null };
}

export async function GET(request: Request) {
  const identity = await apiIdentity(request);
  if (!identity) return unauthorized();
  const database = db();
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  if (resource === "messages") {
    const conversationId = url.searchParams.get("conversationId") ?? "";
    if (!await ownedConversation(identity.userId, conversationId)) return Response.json({ error: "not_found" }, { status: 404 });
    const rows = await database.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
    return Response.json({ messages: rows.map(mappedMessage) });
  }
  if (resource === "history") {
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const condition = eq(conversations.ownerUserId, identity.userId);
    const rows = await database.select().from(conversations).where(query ? and(condition, or(like(conversations.title, `%${query}%`), like(conversations.summary, `%${query}%`)))! : condition).orderBy(desc(conversations.updatedAt)).limit(50);
    return Response.json({ conversations: rows });
  }
  return Response.json({ error: "unknown_resource" }, { status: 400 });
}

export async function POST(request: Request) {
  const identity = await apiIdentity(request);
  if (!identity) return unauthorized();
  const database = db();
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "set_consent") {
    if (body.scope !== "external_ai_processing") return Response.json({ error: "unsupported_scope" }, { status: 400 });
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const consentId = id("consent");
    const status = body.status === "granted" ? "granted" : "revoked";
    await database.insert(consents).values({ id: consentId, ownerUserId: identity.userId, subjectId, scope: "external_ai_processing", purpose: "生成饮食、作息、运动和习惯建议", status, grantedAt: status === "granted" ? now() : null, revokedAt: status === "revoked" ? now() : null });
    await audit(identity.userId, status === "granted" ? "consent_granted" : "consent_revoked", "consent", consentId, subjectId, { scope: "external_ai_processing" });
    return Response.json({ id: consentId, status }, { status: 201 });
  }

  if (action === "update_preferences") {
    const subjectId = String(body.subjectId ?? "");
    const subject = await ownedSubject(identity.userId, subjectId);
    if (!subject) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const raw = body.preferences && typeof body.preferences === "object" ? body.preferences as Record<string, unknown> : {};
    const preferences = {
      wakeTime: String(raw.wakeTime ?? "").slice(0, 5),
      sleepTime: String(raw.sleepTime ?? "").slice(0, 5),
      mealStyle: String(raw.mealStyle ?? "").slice(0, 30),
      exerciseLevel: String(raw.exerciseLevel ?? "").slice(0, 30),
      availableMinutes: String(raw.availableMinutes ?? "").slice(0, 3),
      lifestyleGoal: String(raw.lifestyleGoal ?? "").trim().slice(0, 200),
    };
    await database.update(healthSubjects).set({ profileJson: json({ lifestylePreferences: preferences }), updatedAt: now() }).where(eq(healthSubjects.id, subjectId));
    await audit(identity.userId, "lifestyle_preferences_updated", "lifestyle_preferences", subjectId, subjectId, { fields: Object.keys(preferences) });
    return Response.json({ id: subjectId, preferences, updated: true });
  }

  if (action === "create_conversation") {
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const conversationId = id("conversation");
    await database.insert(conversations).values({ id: conversationId, ownerUserId: identity.userId, subjectId, title: String(body.title || "新的生活建议").slice(0, 30), riskLevel: "lifestyle" });
    await audit(identity.userId, "conversation_created", "conversation", conversationId, subjectId, { productScope: "lifestyle" });
    return Response.json({ id: conversationId }, { status: 201 });
  }

  if (action === "send_message") {
    const conversation = await ownedConversation(identity.userId, String(body.conversationId));
    if (!conversation) return Response.json({ error: "not_found" }, { status: 404 });
    const content = String(body.content ?? "").trim();
    if (!content) return Response.json({ error: "content_required" }, { status: 400 });
    if (content.length > 2000) return Response.json({ error: "content_too_long", maxLength: 2000 }, { status: 413 });

    const guard = classifyLifestyleRequest(content);
    const userMessageId = id("message");
    await database.insert(messages).values({ id: userMessageId, conversationId: conversation.id, role: "user", content, inputType: "text", riskLevel: "lifestyle", contextJson: json({ productScope: "lifestyle" }) });

    const subject = await ownedSubject(identity.userId, conversation.subjectId);
    const recentRows = await database.select({ role: messages.role, content: messages.content }).from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(desc(messages.createdAt)).limit(12);
    const history = recentRows.reverse().filter((row) => row.role === "user" || row.role === "assistant").map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
    const aiConsent = await hasAiProcessingConsent(identity.userId, conversation.subjectId);
    const modelAnswer: { reply: string; modelVersion: string; provider: "rules_fallback" | "deepseek"; error?: string } = guard.responseType !== "recommendation"
      ? { reply: guard.reply, modelVersion: "lifestyle-guard-v1", provider: "rules_fallback" as const }
      : aiConsent && subject
        ? await answerWithDeepSeek(history, guard.reply, guard.category, lifestylePreferences(subject))
        : { reply: guard.reply, modelVersion: "lifestyle-rules-v1", provider: "rules_fallback" as const, error: "ai_processing_consent_required" };
    const finalReply = safeModelReply(modelAnswer.reply, guard.responseType === "recommendation" ? guard.reply : BOUNDARY_REPLY);
    const assistantMessageId = id("message");
    await database.insert(messages).values({ id: assistantMessageId, conversationId: conversation.id, role: "assistant", content: finalReply, inputType: "text", riskLevel: guard.responseType, modelVersion: modelAnswer.modelVersion, sourcesJson: "[]", contextJson: json({ category: guard.category, responseType: guard.responseType, provider: modelAnswer.provider, productScope: "lifestyle" }) });
    await database.update(conversations).set({ title: content.slice(0, 30), summary: content.slice(0, 120), riskLevel: guard.responseType, updatedAt: now() }).where(eq(conversations.id, conversation.id));
    await audit(identity.userId, "lifestyle_message_processed", "conversation", conversation.id, conversation.subjectId, { category: guard.category, responseType: guard.responseType, provider: modelAnswer.provider, providerError: modelAnswer.error ?? null }, modelAnswer.modelVersion);
    return Response.json({
      userMessage: { id: userMessageId, role: "user", content },
      assistantMessage: { id: assistantMessageId, role: "assistant", content: finalReply, category: guard.category, responseType: guard.responseType, modelVersion: modelAnswer.modelVersion, provider: modelAnswer.provider },
    });
  }

  if (action === "feedback") {
    const allowed = new Set(["helpful", "too_hard", "not_fit", "inappropriate"]);
    const type = String(body.type ?? "");
    if (!allowed.has(type)) return Response.json({ error: "invalid_feedback" }, { status: 400 });
    const feedbackId = id("feedback");
    await database.insert(feedback).values({ id: feedbackId, ownerUserId: identity.userId, messageId: String(body.messageId), type });
    await audit(identity.userId, "lifestyle_feedback", "message", String(body.messageId), null, { type });
    return Response.json({ id: feedbackId }, { status: 201 });
  }

  if (action === "create_goal") {
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const goalId = id("goal");
    await database.insert(goals).values({ id: goalId, ownerUserId: identity.userId, subjectId, type: String(body.type).slice(0, 20), title: String(body.title).trim().slice(0, 80), planJson: json(body.plan), reminderJson: json({ enabled: false }), status: "active" });
    await audit(identity.userId, "habit_goal_created", "goal", goalId, subjectId, { type: body.type });
    return Response.json({ id: goalId }, { status: 201 });
  }

  if (action === "checkin") {
    const goalId = String(body.goalId ?? "");
    const goal = (await database.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.ownerUserId, identity.userId))).limit(1))[0];
    if (!goal) return Response.json({ error: "not_found" }, { status: 404 });
    const checkinId = id("checkin");
    await database.insert(goalCheckins).values({ id: checkinId, goalId, ownerUserId: identity.userId });
    await audit(identity.userId, "habit_checked_in", "goal", goalId, goal.subjectId);
    return Response.json({ id: checkinId }, { status: 201 });
  }

  return Response.json({ error: "unknown_action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const identity = await apiIdentity(request);
  if (!identity) return unauthorized();
  const url = new URL(request.url);
  if (url.searchParams.get("resource") !== "account") return Response.json({ error: "unsupported_delete" }, { status: 400 });
  await audit(identity.userId, "account_deletion_requested", "user", identity.userId, null, { cascade: true });
  await db().delete(users).where(eq(users.id, identity.userId));
  return Response.json({ deleted: true, signOutPath: "/signout-with-chatgpt?return_to=/" });
}
