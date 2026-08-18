import { and, desc, eq, like, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { consents, conversations, deviceConnections, feedback, goalCheckins, goals, healthRecords, healthSubjects, messages, serviceEvents, users } from "../../../db/schema";
import { apiIdentity, audit, db, id, json, now, unauthorized } from "../_lib";

async function ownedSubject(ownerUserId:string,subjectId:string){return (await db().select({id:healthSubjects.id}).from(healthSubjects).where(and(eq(healthSubjects.id,subjectId),eq(healthSubjects.ownerUserId,ownerUserId),eq(healthSubjects.authorizationStatus,"active"))).limit(1))[0];}
async function ownedConversation(ownerUserId:string,conversationId:string){return (await db().select({id:conversations.id,subjectId:conversations.subjectId}).from(conversations).where(and(eq(conversations.id,conversationId),eq(conversations.ownerUserId,ownerUserId))).limit(1))[0];}
async function hasAiProcessingConsent(ownerUserId:string,subjectId:string){const latest=(await db().select({status:consents.status}).from(consents).where(and(eq(consents.ownerUserId,ownerUserId),eq(consents.subjectId,subjectId),eq(consents.scope,"external_ai_processing"))).orderBy(desc(consents.createdAt)).limit(1))[0];return latest?.status==="granted";}
function triage(text:string){
  if(/胸痛|呼吸困难|昏迷|意识不清|严重出血|抽搐|无法唤醒/.test(text)) return {level:"emergency",reply:"你描述的情况可能需要立即处理。请立即联系当地急救电话或前往最近的急诊，不要等待在线回复。",next:"emergency"};
  if(/孕|婴儿|儿童|老人|高血压|糖尿病|心脏病/.test(text)) return {level:"high_risk",reply:"为了安全起见，这类特殊人群或既往情况需要更谨慎评估。目前信息不足以判断，请尽快联系专业医生，并补充症状持续时间、严重程度、既往史、用药和过敏信息。",next:"professional_care"};
  return {level:"general_consultation",reply:"为了更准确地理解，我还想确认：这种情况持续多久、严重程度有没有变化？是否有既往病史、正在使用的药物或已知过敏？",next:"followup"};
}

const DEEPSEEK_ENDPOINT="https://api.deepseek.com/chat/completions";
const DEEPSEEK_SYSTEM_PROMPT=`你是“大象阿宝”，一个谨慎、温和的中文健康信息助手。
你的职责是帮助用户整理症状、理解常见健康知识并准备就医信息，不做诊断，不替代医生。
要求：
1. 使用简洁、易懂的中文，先回应用户最关心的问题，再提出最多 3 个必要的追问。
2. 不编造检查结果、药物剂量、引用或数据来源；没有把握时明确说明不确定性。
3. 不建议用户自行停药、换药或调整处方药剂量。
4. 涉及儿童、孕产妇、老人、慢病、严重或持续加重症状时，提醒尽快咨询专业医生。
5. 如果对话中出现胸痛、呼吸困难、昏迷、意识不清、严重出血、抽搐或无法唤醒，立即建议联系当地急救电话或前往急诊。
6. 不复述不必要的敏感个人信息。结尾保留“仅供健康信息参考，不能替代专业医生诊断”。`;

type ChatMessage={role:"system"|"user"|"assistant";content:string};
type ModelAnswer={reply:string;modelVersion:string;provider:"deepseek"|"rules_fallback";error?:string};

function deepseekConfig(){
  const runtime=env as unknown as Record<string,unknown>;
  return {
    apiKey:typeof runtime.DEEPSEEK_API_KEY==="string"?runtime.DEEPSEEK_API_KEY:"",
    model:typeof runtime.DEEPSEEK_MODEL==="string"&&runtime.DEEPSEEK_MODEL?runtime.DEEPSEEK_MODEL:"deepseek-v4-pro",
  };
}

async function answerWithDeepSeek(history:ChatMessage[],fallback:string,riskLevel:string):Promise<ModelAnswer>{
  const {apiKey,model}=deepseekConfig();
  if(!apiKey)return {reply:fallback,modelVersion:"rules-fallback-v1",provider:"rules_fallback",error:"missing_api_key"};
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),18000);
  try{
    const response=await fetch(DEEPSEEK_ENDPOINT,{method:"POST",headers:{authorization:`Bearer ${apiKey}`,"content-type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:`${DEEPSEEK_SYSTEM_PROMPT}\n当前服务端风险分级：${riskLevel}。不得降低该风险等级。`},...history],temperature:0.3,max_tokens:700,stream:false}),signal:controller.signal});
    if(!response.ok)throw new Error(`deepseek_http_${response.status}`);
    const payload=await response.json() as {choices?:Array<{message?:{content?:string}}>};
    const reply=payload.choices?.[0]?.message?.content?.trim();
    if(!reply)throw new Error("deepseek_empty_response");
    const safeReply=riskLevel==="high_risk"&&!/专业医生|就医|医疗机构/.test(reply)?`${reply}\n\n由于涉及特殊人群或慢性病情况，建议尽快咨询专业医生。`:reply;
    return {reply:safeReply,modelVersion:model,provider:"deepseek"};
  }catch(error){
    const reason=error instanceof Error?error.message:"deepseek_unknown_error";
    return {reply:fallback,modelVersion:"rules-fallback-v1",provider:"rules_fallback",error:reason.slice(0,80)};
  }finally{clearTimeout(timeout);}
}

export async function GET(request:Request){
  const identity=await apiIdentity(request);if(!identity)return unauthorized();const database=db();const url=new URL(request.url);const resource=url.searchParams.get("resource");
  if(resource==="messages"){const conversationId=url.searchParams.get("conversationId")??"";if(!await ownedConversation(identity.userId,conversationId))return Response.json({error:"not_found"},{status:404});return Response.json({messages:await database.select().from(messages).where(eq(messages.conversationId,conversationId)).orderBy(messages.createdAt)});}
  if(resource==="history"){const q=(url.searchParams.get("q")??"").trim();const subjectId=url.searchParams.get("subjectId");let condition=eq(conversations.ownerUserId,identity.userId);if(subjectId)condition=and(condition,eq(conversations.subjectId,subjectId))!;const rows=await database.select().from(conversations).where(q?and(condition,or(like(conversations.title,`%${q}%`),like(conversations.summary,`%${q}%`)))!:condition).orderBy(desc(conversations.updatedAt)).limit(50);return Response.json({conversations:rows});}
  if(resource==="records"){const subjectId=url.searchParams.get("subjectId")??"";return Response.json({records:await database.select().from(healthRecords).where(and(eq(healthRecords.ownerUserId,identity.userId),eq(healthRecords.subjectId,subjectId))).orderBy(desc(healthRecords.occurredAt)).limit(100)});}
  return Response.json({error:"unknown_resource"},{status:400});
}

export async function POST(request:Request){
  const identity=await apiIdentity(request);if(!identity)return unauthorized();const database=db();const body=await request.json() as Record<string,any>;const action=String(body.action??"");
  if(action==="create_subject"){const subjectId=id("subject");await database.insert(healthSubjects).values({id:subjectId,ownerUserId:identity.userId,name:String(body.name||"家庭成员"),relation:String(body.relation||"family"),authorizationStatus:"pending"});await audit(identity.userId,"subject_created","health_subject",subjectId,subjectId,{relation:body.relation,status:"pending"});return Response.json({id:subjectId,status:"pending"},{status:201});}
  if(action==="authorize_subject"){const subjectId=String(body.subjectId);const row=(await database.select().from(healthSubjects).where(and(eq(healthSubjects.id,subjectId),eq(healthSubjects.ownerUserId,identity.userId))).limit(1))[0];if(!row)return Response.json({error:"not_found"},{status:404});if(body.confirmed!==true)return Response.json({error:"explicit_confirmation_required"},{status:400});await database.update(healthSubjects).set({authorizationStatus:"active",updatedAt:now()}).where(eq(healthSubjects.id,subjectId));await audit(identity.userId,"subject_authorized","health_subject",subjectId,subjectId,{relation:row.relation,confirmed:true});return Response.json({id:subjectId,status:"active"});}
  if(action==="cancel_subject"){const subjectId=String(body.subjectId);const row=(await database.select().from(healthSubjects).where(and(eq(healthSubjects.id,subjectId),eq(healthSubjects.ownerUserId,identity.userId),eq(healthSubjects.authorizationStatus,"pending"))).limit(1))[0];if(!row)return Response.json({error:"pending_subject_not_found"},{status:404});await database.delete(healthSubjects).where(eq(healthSubjects.id,subjectId));await audit(identity.userId,"subject_authorization_cancelled","health_subject",subjectId,null,{relation:row.relation,previousStatus:"pending"});return Response.json({id:subjectId,cancelled:true});}
  if(action==="set_consent"){const consentId=id("consent"),status=body.status==="granted"?"granted":"revoked";await database.insert(consents).values({id:consentId,ownerUserId:identity.userId,subjectId:body.subjectId??null,scope:String(body.scope),purpose:String(body.purpose||"健康功能使用"),status,grantedAt:status==="granted"?now():null,revokedAt:status==="revoked"?now():null});await audit(identity.userId,status==="granted"?"consent_granted":"consent_revoked","consent",consentId,body.subjectId,{scope:body.scope});return Response.json({id:consentId,status},{status:201});}
  if(action==="create_conversation"){if(!await ownedSubject(identity.userId,String(body.subjectId)))return Response.json({error:"invalid_subject"},{status:403});const conversationId=id("conversation");await database.insert(conversations).values({id:conversationId,ownerUserId:identity.userId,subjectId:String(body.subjectId),title:String(body.title||"新的健康对话")});await audit(identity.userId,"conversation_created","conversation",conversationId,String(body.subjectId));return Response.json({id:conversationId},{status:201});}
  if(action==="send_message"){
    const conversation=await ownedConversation(identity.userId,String(body.conversationId));if(!conversation)return Response.json({error:"not_found"},{status:404});const content=String(body.content??"").trim();if(!content)return Response.json({error:"content_required"},{status:400});
    const userMessageId=id("message");await database.insert(messages).values({id:userMessageId,conversationId:conversation.id,role:"user",content,inputType:String(body.inputType||"text"),contextJson:json({subjectId:conversation.subjectId})});const result=triage(content);
    const recentRows=await database.select({role:messages.role,content:messages.content}).from(messages).where(eq(messages.conversationId,conversation.id)).orderBy(desc(messages.createdAt)).limit(12);
    const history=recentRows.reverse().filter(row=>row.role==="user"||row.role==="assistant").map(row=>({role:row.role as "user"|"assistant",content:row.content}));
    const aiConsent=await hasAiProcessingConsent(identity.userId,conversation.subjectId);
    const modelAnswer=result.level==="emergency"?{reply:result.reply,modelVersion:"rules-emergency-v1",provider:"rules_fallback" as const}:aiConsent?await answerWithDeepSeek(history,result.reply,result.level):{reply:result.reply,modelVersion:"rules-fallback-v1",provider:"rules_fallback" as const,error:"ai_processing_consent_required"};
    const assistantMessageId=id("message");await database.insert(messages).values({id:assistantMessageId,conversationId:conversation.id,role:"assistant",content:modelAnswer.reply,riskLevel:result.level,modelVersion:modelAnswer.modelVersion,sourcesJson:"[]",contextJson:json({subjectId:conversation.subjectId,next:result.next,provider:modelAnswer.provider})});await database.update(conversations).set({title:content.slice(0,30),summary:content.slice(0,120),riskLevel:result.level,updatedAt:now()}).where(eq(conversations.id,conversation.id));await audit(identity.userId,"message_processed","conversation",conversation.id,conversation.subjectId,{riskLevel:result.level,inputType:body.inputType||"text",provider:modelAnswer.provider,providerError:modelAnswer.error??null},modelAnswer.modelVersion);return Response.json({userMessage:{id:userMessageId,role:"user",content},assistantMessage:{id:assistantMessageId,role:"assistant",content:modelAnswer.reply,riskLevel:result.level,modelVersion:modelAnswer.modelVersion,sources:[],provider:modelAnswer.provider}});
  }
  if(action==="feedback"){const feedbackId=id("feedback");await database.insert(feedback).values({id:feedbackId,ownerUserId:identity.userId,messageId:String(body.messageId),type:String(body.type),details:body.details?String(body.details):null});await audit(identity.userId,"answer_feedback","message",String(body.messageId),null,{type:body.type});return Response.json({id:feedbackId},{status:201});}
  if(action==="create_record"){if(!await ownedSubject(identity.userId,String(body.subjectId)))return Response.json({error:"invalid_subject"},{status:403});const recordId=id("record");await database.insert(healthRecords).values({id:recordId,ownerUserId:identity.userId,subjectId:String(body.subjectId),type:String(body.type||"note"),title:String(body.title||"健康记录"),valueJson:json(body.value),sourceType:String(body.sourceType||"user_input"),sourceRef:body.sourceRef?String(body.sourceRef):null,qualityStatus:String(body.qualityStatus||"user_confirmed"),occurredAt:String(body.occurredAt||now())});await audit(identity.userId,"record_created","health_record",recordId,String(body.subjectId),{type:body.type,sourceType:body.sourceType});return Response.json({id:recordId},{status:201});}
  if(action==="create_goal"){if(!await ownedSubject(identity.userId,String(body.subjectId)))return Response.json({error:"invalid_subject"},{status:403});const goalId=id("goal");await database.insert(goals).values({id:goalId,ownerUserId:identity.userId,subjectId:String(body.subjectId),type:String(body.type),title:String(body.title),planJson:json(body.plan),reminderJson:json(body.reminder),status:"active"});await audit(identity.userId,"goal_created","goal",goalId,String(body.subjectId),{type:body.type});return Response.json({id:goalId},{status:201});}
  if(action==="checkin"){const goalId=String(body.goalId);const goal=(await database.select().from(goals).where(and(eq(goals.id,goalId),eq(goals.ownerUserId,identity.userId))).limit(1))[0];if(!goal)return Response.json({error:"not_found"},{status:404});const checkinId=id("checkin");await database.insert(goalCheckins).values({id:checkinId,goalId,ownerUserId:identity.userId,note:body.note?String(body.note):null});await audit(identity.userId,"goal_checked_in","goal",goalId,goal.subjectId);return Response.json({id:checkinId},{status:201});}
  if(action==="device_status"){if(!await ownedSubject(identity.userId,String(body.subjectId)))return Response.json({error:"invalid_subject"},{status:403});const deviceId=id("device");await database.insert(deviceConnections).values({id:deviceId,ownerUserId:identity.userId,subjectId:String(body.subjectId),provider:String(body.provider||"pending_provider"),scopesJson:json(body.scopes),status:String(body.status||"pending")});await audit(identity.userId,"device_status_changed","device_connection",deviceId,String(body.subjectId),{status:body.status,provider:body.provider});return Response.json({id:deviceId,status:body.status},{status:201});}
  if(action==="service_intent"){if(!await ownedSubject(identity.userId,String(body.subjectId)))return Response.json({error:"invalid_subject"},{status:403});const eventId=id("service");await database.insert(serviceEvents).values({id:eventId,ownerUserId:identity.userId,subjectId:String(body.subjectId),serviceType:String(body.serviceType),status:"awaiting_provider",consentJson:json(body.consent)});await audit(identity.userId,"service_referred","service_event",eventId,String(body.subjectId),{serviceType:body.serviceType,status:"awaiting_provider"});return Response.json({id:eventId,status:"awaiting_provider",externalIntegration:false},{status:201});}
  return Response.json({error:"unknown_action"},{status:400});
}

export async function DELETE(request:Request){const identity=await apiIdentity(request);if(!identity)return unauthorized();const database=db();const url=new URL(request.url);const resource=url.searchParams.get("resource"),resourceId=url.searchParams.get("id")??"";if(resource==="record"){const row=(await database.select().from(healthRecords).where(and(eq(healthRecords.id,resourceId),eq(healthRecords.ownerUserId,identity.userId))).limit(1))[0];if(!row)return Response.json({error:"not_found"},{status:404});await database.delete(healthRecords).where(eq(healthRecords.id,resourceId));await audit(identity.userId,"record_deleted","health_record",resourceId,row.subjectId,{impact:"关联摘要、趋势和问答上下文需重新计算"});return Response.json({deleted:true});}if(resource==="account"){await audit(identity.userId,"account_deletion_requested","user",identity.userId,null,{cascade:true});await database.delete(users).where(eq(users.id,identity.userId));return Response.json({deleted:true,signOutPath:"/signout-with-chatgpt?return_to=/"});}return Response.json({error:"unsupported_delete"},{status:400});}
