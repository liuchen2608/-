const goalTypes = new Set(["作息", "饮食", "运动", "日常习惯"]);

export async function readJsonObject(request: Request): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: "invalid_json" }
> {
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "invalid_json" };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

export function parseMessageInput(body: Record<string, unknown>):
  | { ok: true; value: { conversationId: string; content: string } }
  | { ok: false; error: "invalid_conversation_id" | "invalid_content" | "content_required" | "content_too_long" } {
  if (typeof body.conversationId !== "string" || !body.conversationId.trim()) {
    return { ok: false, error: "invalid_conversation_id" };
  }
  if (typeof body.content !== "string") return { ok: false, error: "invalid_content" };
  const content = body.content.trim();
  if (!content) return { ok: false, error: "content_required" };
  if (content.length > 2000) return { ok: false, error: "content_too_long" };
  return { ok: true, value: { conversationId: body.conversationId.trim(), content } };
}

export function parseGoalInput(body: Record<string, unknown>):
  | { ok: true; value: { type: string; title: string; plan: { cycle: "weekly"; dailyAction: string; checkin: "manual" } } }
  | { ok: false; error: "invalid_goal_type" | "goal_title_required" } {
  const type = String(body.type ?? "");
  if (!goalTypes.has(type)) return { ok: false, error: "invalid_goal_type" };
  const title = String(body.title ?? "").trim().slice(0, 80);
  if (!title) return { ok: false, error: "goal_title_required" };
  return {
    ok: true,
    value: { type, title, plan: { cycle: "weekly", dailyAction: title, checkin: "manual" } },
  };
}
