// The old ranking-only grant does not authorize sending raw conversation text.
export const AI_CONVERSATION_SCOPE = "external_ai_conversation_v1";
export const AI_CONVERSATION_NOTICE = "为了进行有出处的连续需求对话，大象阿宝会将你本次输入的原文、当前对话最近最多 12 条可用消息、你主动保存的生活偏好，以及服务端检索到的公开健康生活资料片段发送给 DeepSeek API。不会附带账号身份、旧医疗档案或其他对话。请勿输入敏感个人信息。是否同意？你可以在数据与隐私中撤回；撤回不影响已经发出的请求。";

export function hasConversationConsent(consents: Array<{ scope: string; status: string; subjectId: string }>, subjectId: string) {
  return [...consents].reverse().find((item) => item.subjectId === subjectId && item.scope === AI_CONVERSATION_SCOPE)?.status === "granted";
}
