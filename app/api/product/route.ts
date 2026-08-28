import { and, desc, eq, like, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { consents, conversations, feedback, goalCheckins, goals, healthSubjects, messages, users } from "../../../db/schema";
import { apiIdentity, audit, db, files, id, json, now, unauthorized } from "../_lib";
import { deleteAccountData, listOwnedObjectKeys } from "../account-deletion";
import { mergeLifestylePreferences } from "../lifestyle-profile";
import { parseGoalInput, parseMessageInput, readJsonObject } from "../product-input";
import { classifyLifestyleRequest, finalizeLifestyleReply, prioritizeFallbackReply, type LifestyleCategory } from "../lifestyle-rules";

type ModelAnswer = { reply: string; modelVersion: string; provider: "deepseek" | "rules_fallback"; error?: string };

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const LIFESTYLE_SYSTEM_PROMPT = `你是“大象阿宝”的行动排序器。服务端已经准备了 3 至 5 条经过审核的生活方式行动。
你只能结合用户的饮食、作息、运动、习惯偏好，从这些行动中选择今天最适合优先开始的一项。
只输出一个 JSON 对象，格式必须是 {"priority":1}，priority 必须是 1 至 5 的整数。
不得输出解释、建议正文、诊断、治疗、药品、剂量、检查资料、机构或科室相关内容。`;

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
  return (await db().select({ id: conversations.id, subjectId: conversations.subjectId }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.ownerUserId, ownerUserId), eq(conversations.productScope, "lifestyle"))).limit(1))[0];
}

async function hasAiProcessingConsent(ownerUserId: string, subjectId: string) {
  const latest = (await db().select({ status: consents.status }).from(consents).where(and(eq(consents.ownerUserId, ownerUserId), eq(consents.subjectId, subjectId), eq(consents.scope, "external_ai_processing"))).orderBy(desc(consents.createdAt)).limit(1))[0];
  return latest?.status === "granted";
}

function lifestylePreferences(subject: typeof healthSubjects.$inferSelect) {
  try { return JSON.parse(subject.profileJson || "{}").lifestylePreferences ?? {}; } catch { return {}; }
}

async function answerWithDeepSeek(fallback: string, category: LifestyleCategory, preferences: unknown): Promise<ModelAnswer> {
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
        ],
        temperature: 0,
        max_tokens: 30,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`deepseek_http_${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const jsonObject = raw.match(/\{[\s\S]*\}/)?.[0];
    const priority = jsonObject ? Number((JSON.parse(jsonObject) as { priority?: unknown }).priority) : Number.NaN;
    const reply = prioritizeFallbackReply(fallback, priority);
    if (reply === fallback) throw new Error("deepseek_invalid_priority");
    return { reply, modelVersion: model, provider: "deepseek" };
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
    const condition = and(eq(conversations.ownerUserId, identity.userId), eq(conversations.productScope, "lifestyle"))!;
    const rows = await database.select().from(conversations).where(query ? and(condition, or(like(conversations.title, `%${query}%`), like(conversations.summary, `%${query}%`)))! : condition).orderBy(desc(conversations.updatedAt)).limit(50);
    return Response.json({ conversations: rows });
  }
  return Response.json({ error: "unknown_resource" }, { status: 400 });
}

export async function POST(request: Request) {
  const identity = await apiIdentity(request);
  if (!identity) return unauthorized();
  const database = db();
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) return Response.json({ error: parsedBody.error }, { status: 400 });
  const body = parsedBody.value;
  const action = String(body.action ?? "");

  if (action === "set_consent") {
    if (body.scope !== "external_ai_processing") return Response.json({ error: "unsupported_scope" }, { status: 400 });
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const consentId = id("consent");
    const status = body.status === "granted" ? "granted" : "revoked";
    const consentTimestamp = now();
    await database.insert(consents).values({ id: consentId, ownerUserId: identity.userId, subjectId, scope: "external_ai_processing", purpose: "生成饮食、作息、运动和习惯建议", status, grantedAt: status === "granted" ? consentTimestamp : null, revokedAt: status === "revoked" ? consentTimestamp : null, createdAt: consentTimestamp, updatedAt: consentTimestamp });
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
    await database.update(healthSubjects).set({ profileJson: mergeLifestylePreferences(subject.profileJson, preferences), updatedAt: now() }).where(eq(healthSubjects.id, subjectId));
    await audit(identity.userId, "lifestyle_preferences_updated", "lifestyle_preferences", subjectId, subjectId, { fields: Object.keys(preferences) });
    return Response.json({ id: subjectId, preferences, updated: true });
  }

  if (action === "create_conversation") {
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const conversationId = id("conversation");
    await database.insert(conversations).values({ id: conversationId, ownerUserId: identity.userId, subjectId, title: String(body.title || "新的生活建议").slice(0, 30), riskLevel: "lifestyle", productScope: "lifestyle" });
    await audit(identity.userId, "conversation_created", "conversation", conversationId, subjectId, { productScope: "lifestyle" });
    return Response.json({ id: conversationId }, { status: 201 });
  }

  if (action === "send_message") {
    const parsedMessage = parseMessageInput(body);
    if (!parsedMessage.ok) return Response.json(
      { error: parsedMessage.error, ...(parsedMessage.error === "content_too_long" ? { maxLength: 2000 } : {}) },
      { status: parsedMessage.error === "content_too_long" ? 413 : 400 },
    );
    const { conversationId, content } = parsedMessage.value;
    const conversation = await ownedConversation(identity.userId, conversationId);
    if (!conversation) return Response.json({ error: "not_found" }, { status: 404 });

    const guard = classifyLifestyleRequest(content);
    const userMessageId = id("message");
    await database.insert(messages).values({ id: userMessageId, conversationId: conversation.id, role: "user", content, inputType: "text", riskLevel: "lifestyle", contextJson: json({ productScope: "lifestyle" }) });

    const subject = await ownedSubject(identity.userId, conversation.subjectId);
    const aiConsent = await hasAiProcessingConsent(identity.userId, conversation.subjectId);
    const modelAnswer: { reply: string; modelVersion: string; provider: "rules_fallback" | "deepseek"; error?: string } = guard.responseType !== "recommendation"
      ? { reply: guard.reply, modelVersion: "lifestyle-guard-v2", provider: "rules_fallback" as const }
      : aiConsent && subject
        ? await answerWithDeepSeek(guard.reply, guard.category, lifestylePreferences(subject))
        : { reply: guard.reply, modelVersion: "lifestyle-rules-v1", provider: "rules_fallback" as const, error: "ai_processing_consent_required" };
    const finalReply = finalizeLifestyleReply(guard, modelAnswer.reply);
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
    const messageId = String(body.messageId ?? "");
    const ownedMessage = (await database.select({ id: messages.id }).from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(
        eq(messages.id, messageId),
        eq(messages.role, "assistant"),
        eq(conversations.ownerUserId, identity.userId),
        eq(conversations.productScope, "lifestyle"),
      )).limit(1))[0];
    if (!ownedMessage) return Response.json({ error: "message_not_found" }, { status: 404 });
    const feedbackId = id("feedback");
    await database.insert(feedback).values({ id: feedbackId, ownerUserId: identity.userId, messageId, type });
    await audit(identity.userId, "lifestyle_feedback", "message", messageId, null, { type });
    return Response.json({ id: feedbackId }, { status: 201 });
  }

  if (action === "create_goal") {
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const parsedGoal = parseGoalInput(body);
    if (!parsedGoal.ok) return Response.json({ error: parsedGoal.error }, { status: 400 });
    const { type, title, plan } = parsedGoal.value;
    const goalId = id("goal");
    await database.insert(goals).values({ id: goalId, ownerUserId: identity.userId, subjectId, type, title, planJson: json(plan), reminderJson: json({ enabled: false }), status: "active" });
    await audit(identity.userId, "habit_goal_created", "goal", goalId, subjectId, { type });
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
  const database = db();
  try {
    const result = await deleteAccountData(identity.userId, {
      listObjectKeys: async (ownerUserId) => listOwnedObjectKeys(files(), ownerUserId),
      deleteObject: async (objectKey) => { await files().delete(objectKey); },
      recordAudit: async (ownerUserId, deletedObjectCount) => { await audit(ownerUserId, "account_deletion_requested", "user", ownerUserId, null, { cascade: true, deletedObjectCount }); },
      deleteUser: async (ownerUserId) => { await database.delete(users).where(eq(users.id, ownerUserId)); },
    });
    return Response.json({ deleted: true, ...result, signOutPath: "/signout-with-chatgpt?return_to=/" });
  } catch (error) {
    if (error instanceof Error && error.message === "account_object_cleanup_failed") {
      return Response.json({ error: "account_deletion_storage_cleanup_failed" }, { status: 503 });
    }
    throw error;
  }
}
