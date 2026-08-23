import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(){
  const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);
  const {default:worker}=await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("renders the lifestyle recommendation homepage",async()=>{
  const response=await render();assert.equal(response.status,200);const html=await response.text();
  assert.match(html,/<title>大象阿宝/);
  assert.match(html,/健康生活助手/);
  assert.match(html,/你好，我是阿宝/);
  assert.match(html,/饮食、作息、运动或日常习惯/);
  assert.match(html,/帮我安排健康的一天/);
  assert.match(html,/给我一份新手运动计划/);
  assert.doesNotMatch(html,/医疗服务|设备数据|体检报告|预约挂号|健康档案/);
});

test("uses deterministic lifestyle boundaries before and after generation",async()=>{
  const rules=await readFile(new URL("../app/api/lifestyle-rules.ts",import.meta.url),"utf8");
  const api=await readFile(new URL("../app/api/product/route.ts",import.meta.url),"utf8");
  assert.match(rules,/prohibitedRequestPattern/);
  assert.match(rules,/prohibitedOutputPattern/);
  assert.match(rules,/BOUNDARY_REPLY/);
  assert.match(rules,/SAFETY_STOP_REPLY/);
  assert.match(api,/classifyLifestyleRequest/);
  assert.match(api,/safeModelReply/);
  assert.match(api,/guard\.responseType !== "recommendation"/);
  assert.doesNotMatch(api,/service_intent|device_status|create_record|media_processing/);
});

test("keeps only lifestyle-facing product language",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  for(const label of ["生活建议","生活偏好","习惯计划","建议记录","数据与隐私"])assert.match(page,new RegExp(label));
  for(const removed of ["医疗服务","设备数据","报告解读","预约挂号","在线问诊","云陪诊"])assert.doesNotMatch(page,new RegExp(removed));
  assert.match(page,/只提供生活方式推荐/);
  assert.match(page,/不会询问或使用疾病、检查和药品信息/);
});
