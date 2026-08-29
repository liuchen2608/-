import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyLifestyleRequest } from "../app/api/lifestyle-rules.ts";

async function render(headers={}){
  const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);
  const {default:worker}=await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html",...headers}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("renders the lifestyle recommendation homepage",async()=>{
  const response=await render({"oai-authenticated-user-id":"test-user","oai-authenticated-user-email":"test@example.com"});assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/<title>大象阿宝/);
  assert.match(html,/健康生活助手/);
  assert.match(html,/你好，我是阿宝/);
  assert.match(html,/饮食、作息、运动或日常习惯/);
  assert.match(html,/帮我安排健康的一天/);
  assert.match(html,/给我一份新手运动计划/);
  assert.doesNotMatch(html,/医疗服务|设备数据|体检报告|预约挂号|健康档案/);
  const promptGrid=html.match(/class="prompt-grid">([\s\S]*?)class="scope-note"/);
  assert.ok(promptGrid,"homepage suggestion buttons must be rendered");
  const suggestedInputs=[...promptGrid[1].matchAll(/<b>([^<]+)<\/b>/g)].map((match)=>match[1]);
  assert.equal(suggestedInputs.length,4);
  for(const input of suggestedInputs)assert.equal(classifyLifestyleRequest(input).responseType,"recommendation",`homepage suggestion: ${input}`);
});

test("asks anonymous visitors to sign in before loading personal features",async()=>{
  const response=await render();assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/使用 ChatGPT 登录/);
  assert.match(html,/\/signin-with-chatgpt\?return_to=%2F/);
  assert.doesNotMatch(html,/你好，我是阿宝/);
});

test("routes lifestyle messages through the consent-gated dialogue adapter",async()=>{
  const rules=await readFile(new URL("../app/api/lifestyle-rules.ts",import.meta.url),"utf8");
  const rag=await readFile(new URL("../app/api/lifestyle-rag.ts",import.meta.url),"utf8");
  const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.match(rules,/prohibitedRequestPattern/);
  assert.match(rules,/prohibitedOutputPattern/);
  assert.match(rules,/BOUNDARY_REPLY/);
  assert.match(rules,/SAFETY_STOP_REPLY/);
  assert.match(api,/answerDialogue/);
  assert.match(api,/eq\(consents.scope, AI_CONVERSATION_SCOPE\)/);
  assert.match(api,/where\(eq\(messages.conversationId, conversation.id\)\)/);
  assert.match(api,/database.batch/);
  assert.match(api,/restoreStoredSources/);
  assert.match(rag,/retrieveLifestyleKnowledge/);
  assert.match(rag,/resolveCitedSources/);
  assert.match(page,/className="rag-sources"/);
  assert.doesNotMatch(api,/body.history|body.profileJson|body.apiKey/);
  assert.doesNotMatch(api,/service_intent|device_status|create_record|media_processing/);
});

test("isolates legacy medical conversations from the lifestyle product",async()=>{
  const schema=await readFile(new URL("../db/schema.ts",import.meta.url),"utf8");
  const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  const bootstrap=await readFile(new URL("../app/api/bootstrap/route.ts",import.meta.url),"utf8");
  const migration=await readFile(new URL("../drizzle/0001_yellow_sir_ram.sql",import.meta.url),"utf8");
  assert.match(schema,/productScope:text\("product_scope"\).*default\("legacy_medical"\)/);
  assert.match(api,/productScope:\s*"lifestyle"/);
  assert.match(api,/eq\(conversations\.productScope,\s*"lifestyle"\)/);
  assert.match(bootstrap,/eq\(conversations\.productScope,\s*"lifestyle"\)/);
  assert.match(migration,/DEFAULT 'legacy_medical'/);
  assert.match(migration,/risk_level.*'lifestyle'.*'boundary_refusal'.*'safety_stop'/);
  assert.doesNotMatch(migration,/DELETE FROM/);
});

test("checks message ownership before accepting feedback",async()=>{
  const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  assert.match(api,/innerJoin\(conversations,\s*eq\(messages\.conversationId,\s*conversations\.id\)\)/);
  assert.match(api,/eq\(conversations\.ownerUserId,\s*identity\.userId\)/);
  assert.match(api,/eq\(messages\.role,\s*"assistant"\)/);
});

test("orders consent history and timestamps new decisions explicitly",async()=>{
  const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  const bootstrap=await readFile(new URL("../app/api/bootstrap/route.ts",import.meta.url),"utf8");
  assert.match(api,/createdAt:\s*consentTimestamp/);
  assert.match(api,/updatedAt:\s*consentTimestamp/);
  assert.match(bootstrap,/orderBy\(asc\(consents\.createdAt\), asc\(consents\.status\)\)/);
});

test("keeps only lifestyle-facing product language",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  for(const label of ["生活建议","生活偏好","习惯计划","建议记录","数据与隐私"])assert.match(page,new RegExp(label));
  for(const removed of ["医疗服务","设备数据","报告解读","预约挂号","在线问诊","云陪诊"])assert.doesNotMatch(page,new RegExp(removed));
  assert.match(page,/只提供生活方式推荐/);
  assert.match(page,/不会询问或使用疾病、检查和药品信息/);
});

test("ships the elephant identity and accessible motion states",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const motion=await readFile(new URL("../app/motion.css",import.meta.url),"utf8");
  const globals=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  const theme=await readFile(new URL("../app/auth.css",import.meta.url),"utf8");
  assert.match(page,/阿宝正在整理生活建议/);
  assert.match(page,/is-success/);
  assert.match(page,/is-complete/);
  assert.doesNotMatch(page,/[‹›×→]/);
  assert.match(page,/"chevron-left"/);
  assert.match(page,/"arrow-right"/);
  assert.match(motion,/abao-elephant-avatar\.webp/);
  assert.match(motion,/prefers-reduced-motion/);
  assert.match(motion,/thinking-dot/);
  assert.match(globals,/--primary:#6b7280/);
  assert.match(globals,/--accent:#0891b2/);
  assert.match(globals,/font-family:Raleway/);
  assert.match(theme,/a:focus-visible/);
});
