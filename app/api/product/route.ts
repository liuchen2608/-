import { and, desc, eq, like, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { auditEvents, consents, conversations, feedback, goalCheckins, goals, healthSubjects, messages, users } from "../../../db/schema";
import { apiIdentity, audit, db, files, id, json, now, unauthorized } from "../_lib";
import { deleteAccountData, listOwnedObjectKeys } from "../account-deletion";
import { mergeLifestylePreferences } from "../lifestyle-profile";
import { parseGoalInput, parseMessageInput, readJsonObject } from "../product-input";
import { answerDialogue } from "../deepseek-dialogue";
import { AI_CONVERSATION_SCOPE } from "../../lib/ai-consent";

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
  const latest = (await db().select({ status: consents.status }).from(consents).where(and(eq(consents.ownerUserId, ownerUserId), eq(consents.subjectId, subjectId), eq(consents.scope, AI_CONVERSATION_SCOPE))).orderBy(desc(consents.createdAt), desc(consents.status)).limit(1))[0];
  return latest?.status === "granted";
}

function mappedMessage(row: typeof messages.$inferSelect) {
  let context: Record<string, unknown> = {};
  try { context = JSON.parse(row.contextJson || "{}"); } catch { context = {}; }
  return { ...row, category: context.category ?? "生活建议", responseType: context.responseType ?? "recommendation", provider: context.provider ?? null, status: context.status ?? null };
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
    if (body.scope !== AI_CONVERSATION_SCOPE) return Response.json({ error: "unsupported_scope" }, { status: 400 });
    const subjectId = String(body.subjectId ?? "");
    if (!await ownedSubject(identity.userId, subjectId)) return Response.json({ error: "invalid_subject" }, { status: 403 });
    const consentId = id("consent");
    if (body.status !== "granted" && body.status !== "revoked") return Response.json({ error: "invalid_consent_status" }, { status: 400 });
    const status = body.status;
    const consentTimestamp = now();
    await database.insert(consents).values({ id: consentId, ownerUserId: identity.userId, subjectId, scope: AI_CONVERSATION_SCOPE, purpose: "向 DeepSeek 发送本次输入、当前对话最近最多12条可用消息和主动保存的生活偏好，用于多轮生活需求对话", status, grantedAt: status === "granted" ? consentTimestamp : null, revokedAt: status === "revoked" ? consentTimestamp : null, createdAt: consentTimestamp, updatedAt: consentTimestamp });
    await audit(identity.userId, status === "granted" ? "consent_granted" : "consent_revoked", "consent", consentId, subjectId, { scope: AI_CONVERSATION_SCOPE });
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

    const subject = await ownedSubject(identity.userId, conversation.subjectId);
    if (!subject) return Response.json({ error: "invalid_subject" }, { status: 403 });
    // Context comes only from this owned lifestyle conversation, never from the client.
    const recent = await database.select({ role: messages.role, content: messages.content, contextJson: messages.contextJson }).from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(desc(messages.createdAt), desc(messages.id)).limit(12);
    const aiConsent = await hasAiProcessingConsent(identity.userId, conversation.subjectId);
    const answer = await answerDialogue({ content, history: recent.reverse(), profileJson: subject.profileJson, consent: aiConsent, ...deepseekConfig() });
    const userMessageId = id("message");
    const assistantMessageId = id("message");
    const timestamp = Date.now();
    const context = { category: answer.category, responseType: answer.responseType, provider: answer.provider, status: answer.status, productScope: "lifestyle", dialogueVersion: 1 };
    // Persist the complete turn and audit atomically, without orphan user messages.
    await database.batch([
      database.insert(messages).values({ id: userMessageId, conversationId: conversation.id, role: "user", content, inputType: "text", riskLevel: "lifestyle", contextJson: json({ productScope: "lifestyle", dialogueVersion: 1 }), createdAt: new Date(timestamp).toISOString() }),
      database.insert(messages).values({ id: assistantMessageId, conversationId: conversation.id, role: "assistant", content: answer.reply, inputType: "text", riskLevel: answer.responseType, modelVersion: answer.modelVersion, sourcesJson: "[]", contextJson: json(context), createdAt: new Date(timestamp + 1).toISOString() }),
      database.update(conversations).set({ summary: content.slice(0, 120), riskLevel: answer.responseType, updatedAt: new Date(timestamp + 1).toISOString() }).where(eq(conversations.id, conversation.id)),
      database.insert(auditEvents).values({ id: id("audit"), ownerUserId: identity.userId, subjectId: conversation.subjectId, action: "lifestyle_message_processed", resourceType: "conversation", resourceId: conversation.id, metadataJson: json({ ...context, providerError: answer.error ?? null }), modelVersion: answer.modelVersion }),
    ]);
    return Response.json({
      userMessage: { id: userMessageId, role: "user", content },
      assistantMessage: { id: assistantMessageId, role: "assistant", content: answer.reply, category: answer.category, responseType: answer.responseType, modelVersion: answer.modelVersion, provider: answer.provider, status: answer.status },
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
