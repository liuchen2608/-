export type LifestyleCategory =
  | "饮食"
  | "作息"
  | "运动"
  | "习惯"
  | "一天计划"
  | "边界说明"
  | "安全中止";

export type ResponseType = "recommendation" | "boundary_refusal" | "safety_stop";

export type GuardResult = {
  category: LifestyleCategory;
  responseType: ResponseType;
  reply: string;
};

export const BOUNDARY_REPLY =
  "这个问题超出了生活方式推荐范围。我不能判断身体状况，也不能给出相关处理方案。你可以告诉我想改善的饮食、作息、运动或日常习惯，我可以帮你整理一份容易开始的生活计划。";

export const SAFETY_STOP_REPLY =
  "你描述的情况不适合由生活建议助手继续回答。请立即向身边可信赖的人求助，并联系当地紧急求助服务。";

const urgentPattern = /胸痛|呼吸困难|昏迷|意识不清|严重出血|抽搐|无法唤醒|自杀|轻生/;
const prohibitedRequestPattern =
  /诊断|确诊|什么病|病因|治疗|治好|药品|药物|用药|药名|剂量|处方|疗程|中医|西医|检查报告|化验|影像|体检报告|挂号|科室|问诊|医生|医院/;
const prohibitedOutputPattern =
  /确诊|诊断为|患有|病因是|治疗方案|药品|药物|用药|剂量|处方|疗程|中医|西医|检查报告|化验|影像|挂号|科室|问诊/;

export function classifyLifestyleRequest(input: string): GuardResult {
  const text = input.trim();
  if (urgentPattern.test(text)) {
    return { category: "安全中止", responseType: "safety_stop", reply: SAFETY_STOP_REPLY };
  }
  if (prohibitedRequestPattern.test(text)) {
    return { category: "边界说明", responseType: "boundary_refusal", reply: BOUNDARY_REPLY };
  }
  if (/早中晚|一天计划|健康的一天|每日计划|一日安排/.test(text)) {
    return { category: "一天计划", responseType: "recommendation", reply: fallbackFor("一天计划") };
  }
  if (/睡|熬夜|早起|作息|休息|咖啡因|晚起/.test(text)) {
    return { category: "作息", responseType: "recommendation", reply: fallbackFor("作息") };
  }
  if (/吃|早餐|午餐|晚餐|饮食|喝水|咖啡|茶|零食|外卖/.test(text)) {
    return { category: "饮食", responseType: "recommendation", reply: fallbackFor("饮食") };
  }
  if (/运动|健身|久坐|锻炼|走路|训练|拉伸/.test(text)) {
    return { category: "运动", responseType: "recommendation", reply: fallbackFor("运动") };
  }
  return { category: "习惯", responseType: "recommendation", reply: fallbackFor("习惯") };
}

export function containsProhibitedOutput(text: string) {
  return prohibitedOutputPattern.test(text);
}

export function safeModelReply(text: string, fallback: string) {
  const cleaned = text.trim();
  if (!cleaned || containsProhibitedOutput(cleaned)) return fallback;
  return cleaned;
}

export function fallbackFor(category: LifestyleCategory) {
  if (category === "作息") {
    return "最近休息不理想时，可以先从今晚的小调整开始：\n\n1. 睡前六小时尽量不喝咖啡、浓茶或其他含咖啡因的饮品。\n2. 睡前一小时减少手机和电脑使用，换成洗漱、整理或舒缓活动。\n3. 尽量固定上床和起床时间，周末也不要相差太多。\n4. 晚餐避免太晚或太撑，睡前不再大量进食。\n5. 把卧室调整到安静、偏暗且自己感觉舒适的状态。\n\n今晚可以先选择“睡前一小时不刷手机”。你平时通常几点睡觉？\n\n以上仅为日常生活方式参考。";
  }
  if (category === "饮食") {
    return "可以先把一餐调整得简单、均衡一些：\n\n1. 先确定固定的用餐时间，避免饿得太久后一次吃得过多。\n2. 每餐优先安排主食、蔬菜和常见蛋白质食物。\n3. 吃饭时放慢速度，吃到舒适即可。\n4. 把含糖饮料和高油零食改成偶尔选择。\n5. 今天先从准备一份更容易执行的早餐开始。\n\n你最想改善早餐、午餐还是晚餐？\n\n以上仅为日常生活方式参考。";
  }
  if (category === "运动") {
    return "刚开始运动时，重点是轻松完成并愿意继续：\n\n1. 先选择走路、徒手活动或轻松骑行等低门槛方式。\n2. 每次从十到二十分钟开始，不追求一次做到很多。\n3. 开始前做简单热身，结束后放慢节奏。\n4. 久坐时每隔一段时间起身活动几分钟。\n5. 今天先完成一次十分钟活动，并记录自己的感受。\n\n你每周可以安排几次、每次大约多少分钟？\n\n以上仅为日常生活方式参考。";
  }
  if (category === "一天计划") {
    return "可以先用这份轻量安排开始：\n\n早上\n1. 起床后喝水并简单活动几分钟。\n2. 早餐选择主食、蛋白质食物和一份果蔬。\n\n中午\n3. 正常吃午餐，放慢进餐速度。\n4. 饭后安排十分钟轻松走动，下午久坐时定时起身。\n\n晚上\n5. 晚餐不过晚、不过量，睡前一小时减少屏幕和咖啡因。\n6. 在相对固定的时间完成洗漱并准备休息。\n\n今天只需要优先完成其中两项。你的起床时间和工作时间大约是什么时候？\n\n以上仅为日常生活方式参考。";
  }
  return "想把一个习惯坚持下来，可以先把目标缩小：\n\n1. 一次只调整一件事。\n2. 把行动放在固定触发点之后，例如吃完午饭后走十分钟。\n3. 让第一次行动在十分钟内可以完成。\n4. 用简单勾选记录完成情况，不追求连续满分。\n5. 如果中断，第二天直接恢复，不额外补做。\n\n你现在最想改善饮食、作息还是运动？\n\n以上仅为日常生活方式参考。";
}
