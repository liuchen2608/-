import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(){
  const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);
  const {default:worker}=await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("renders the clean agent-first homepage",async()=>{
  const response=await render();assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/<title>大象阿宝/);assert.match(html,/你好，我是阿宝/);assert.match(html,/今天想聊些什么/);assert.match(html,/描述健康问题、症状，或上传健康资料/);assert.match(html,/不能替代专业医生/);assert.doesNotMatch(html,/今日健康|6,340|120\/78|Your site is taking shape/);
});

test("declares required health data and audit tables",async()=>{
  const schema=await readFile(new URL("../db/schema.ts",import.meta.url),"utf8");const hosting=await readFile(new URL("../.openai/hosting.json",import.meta.url),"utf8");
  for(const table of ["users","healthSubjects","consents","conversations","messages","healthRecords","uploads","goals","deviceConnections","serviceEvents","auditEvents"])assert.match(schema,new RegExp(`export const ${table}`));
  assert.match(hosting,/"d1":\s*"DB"/);assert.match(hosting,/"r2":\s*"FILES"/);
});

test("keeps medical safety boundaries visible in source",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  assert.match(page,/仅供.*不能替代专业医生/);assert.match(api,/emergency/);assert.match(api,/rules-fallback-v1/);assert.match(api,/explicit_confirmation_required/);
});
