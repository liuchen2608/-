import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { auditEvents } from "../../db/schema";

export async function apiIdentity(request: Request) {
  const user = await getChatGPTUser();
  if (user) return user;
  const host = new URL(request.url).hostname;
  if (host === "localhost" || host === "127.0.0.1") return { userId:"local-preview", email:"preview@local", displayName:"本地预览", fullName:"本地预览" };
  return null;
}

export function unauthorized(){ return Response.json({error:"authentication_required"},{status:401}); }
export function db(){ return getDb(); }
export function files(){ if(!env.FILES) throw new Error("R2 binding `FILES` is unavailable"); return env.FILES; }
export const id = (prefix:string)=>`${prefix}_${crypto.randomUUID()}`;
export const now = ()=>new Date().toISOString();
export const json = (value:unknown)=>JSON.stringify(value ?? {});

export async function audit(ownerUserId:string, action:string, resourceType:string, resourceId?:string|null, subjectId?:string|null, metadata:unknown={}, modelVersion?:string|null){
  await db().insert(auditEvents).values({id:id("audit"),ownerUserId,subjectId:subjectId??null,action,resourceType,resourceId:resourceId??null,metadataJson:json(metadata),modelVersion:modelVersion??null});
}
