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

const urgentPattern = /胸痛|心梗|心肌梗死|脑卒中|中风|偏瘫|瘫痪|口角歪斜|说话不清|呼吸困难|无法呼吸|喘不过气|窒息|噎住|喉咙肿|昏迷|意识不清|出血|休克|抽搐|癫痫发作|无法唤醒|溺水|中毒|误食|吞了很多|服药过量|药物过量|安眠药|触电|坠落|车祸|严重烧伤|严重烫伤|自杀|轻生|跳楼|割腕/;
const prohibitedRequestPattern =
  /诊断|确诊|什么病|病因|治疗|治好|药|口服|服用|胶囊|注射|打针|针剂|疫苗|抗生素|止痛|消炎|剂量|处方|疗程|头孢|胰岛素|布洛芬|阿司匹林|对乙酰氨基酚|中医|西医|检查报告|化验|影像|体检报告|挂号|科室|问诊|医生|医院/;
const symptomPattern =
  /头疼|头痛|腹痛|肚子疼|恶心|呕吐|发烧|发热|咳嗽|头晕|眩晕|心悸|胸闷|皮疹|疼痛|不舒服|症状|血压|血糖|过敏|受伤|骨折|感染|炎症/;
const medicalEntityPattern =
  /糖尿病|高血压|冠心病|心脏病|肾病|肝病|癌症|肿瘤|哮喘|抑郁症|焦虑症|患者|病人|孕妇|孕期|备孕|哺乳期|婴儿|儿童|未成年人|老年人|术后|康复期/;
const medicationNamePattern =
  /[\u4e00-\u9fff]{2,10}(?:林|唑|沙坦|普利|地平|洛尔|汀|霉素|西林)(?=怎么|如何|搭配|早餐|午餐|晚餐|吃|服|用|$)/;
const approvedLifestyleTerms = [
  "健康的一天", "日常生活", "时间管理", "早中晚", "晚饭后", "睡觉前", "睡前", "起床后", "饭后", "工作日",
  "生活", "健康", "安排", "计划", "目标", "习惯", "坚持", "建立", "养成", "改善", "调整", "固定", "开始", "完成", "记录", "打卡", "减少", "增加", "准备", "选择", "专注", "拖延", "忘记",
  "作息", "休息", "睡觉", "睡眠", "入睡", "早起", "起床", "晚起", "熬夜", "午睡", "晚上", "早上", "中午", "下午", "周末", "平时",
  "饮食", "用餐", "进食", "食物", "早餐", "午餐", "晚餐", "三餐", "主食", "蔬菜", "水果", "零食", "外卖", "喝水", "咖啡", "茶", "饭",
  "运动", "健身", "锻炼", "训练", "活动", "走路", "散步", "跑步", "骑车", "拉伸", "瑜伽", "久坐", "新手",
  "手机", "屏幕", "阅读", "读书", "办公", "工作", "上班", "下班", "通勤", "空闲", "规律", "简单", "轻松",
  "告诉", "帮助", "帮", "请", "给", "我", "你", "想", "希望", "可以", "能不能", "怎么", "如何", "怎样", "要", "会", "总是", "经常", "每天", "今天", "最近", "只有", "一点", "比较", "很", "总", "更", "晚", "睡", "喝", "吃", "点", "放下", "搭配", "的", "了", "吗", "呢", "和", "或", "后", "前",
].sort((left, right) => right.length - left.length);
const prohibitedOutputPattern =
  /确诊|诊断为|患有|病因是|治疗方案|药品|药物|用药|服用|口服|外用|剂量|处方|疗程|止痛|消炎|抗生素|布洛芬|阿司匹林|对乙酰氨基酚|中医|西医|检查报告|化验|影像|挂号|科室|问诊|医生|医院|缓解症状|康复|\d+(?:\.\d+)?\s*(?:mg|ml|毫克|毫升|片|粒|滴)|每天.{0,8}\d+次|连续.{0,8}\d+天/i;

export function classifyLifestyleRequest(input: string): GuardResult {
  const text = input.trim();
  if (urgentPattern.test(text)) {
    return { category: "安全中止", responseType: "safety_stop", reply: SAFETY_STOP_REPLY };
  }
  if (prohibitedRequestPattern.test(text) || symptomPattern.test(text) || medicalEntityPattern.test(text) || medicationNamePattern.test(text)) {
    return { category: "边界说明", responseType: "boundary_refusal", reply: BOUNDARY_REPLY };
  }
  if (!containsOnlyApprovedLifestyleTerms(text)) {
    return { category: "边界说明", responseType: "boundary_refusal", reply: BOUNDARY_REPLY };
  }
  if (/早中晚|一天计划|健康的一天|每日计划|一日安排/.test(text)) {
    return { category: "一天计划", responseType: "recommendation", reply: fallbackFor("一天计划") };
  }
  if (/睡|熬夜|早起|作息|休息|咖啡因|晚起/.test(text)) {
    return { category: "作息", responseType: "recommendation", reply: fallbackFor("作息") };
  }
  if (/早餐|午餐|晚餐|三餐|饮食|用餐|进食|食物|主食|蔬菜|水果|喝水|咖啡|茶|零食|外卖/.test(text)) {
    return { category: "饮食", responseType: "recommendation", reply: fallbackFor("饮食") };
  }
  if (/运动|健身|久坐|锻炼|走路|训练|拉伸/.test(text)) {
    return { category: "运动", responseType: "recommendation", reply: fallbackFor("运动") };
  }
  if (/习惯|坚持|拖延|计划|目标|打卡|时间管理|专注|手机|久坐/.test(text)) {
    return { category: "习惯", responseType: "recommendation", reply: fallbackFor("习惯") };
  }
  return { category: "边界说明", responseType: "boundary_refusal", reply: BOUNDARY_REPLY };
}

export function containsProhibitedOutput(text: string) {
  return prohibitedOutputPattern.test(text);
}

function containsOnlyApprovedLifestyleTerms(text: string) {
  let remaining = text;
  for (const term of approvedLifestyleTerms) remaining = remaining.replaceAll(term, "");
  remaining = remaining.replace(/[\s0-9０-９一二三四五六七八九十百千万半个份次周天日月年点分秒小时分钟、，。！？?!：:；;（）()【】《》“”‘’"'—…·+\-/]/g, "");
  return remaining.length === 0;
}

export function safeModelReply(text: string, fallback: string) {
  const cleaned = text.trim();
  const approved = fallback.trim();
  const actionCount = cleaned.match(/(?:^|\n)\s*(?:\d+[.、]|[-*•])\s+/g)?.length ?? 0;
  const hasDisclaimer = cleaned.includes("以上仅为日常生活方式参考");
  if (!cleaned || cleaned !== approved || containsProhibitedOutput(cleaned) || actionCount < 3 || actionCount > 5 || !hasDisclaimer) return fallback;
  return fallback;
}

export function prioritizeFallbackReply(fallback: string, priority: number) {
  const actionCount = fallback.match(/(?:^|\n)\s*\d+[.、]\s+/g)?.length ?? 0;
  if (!Number.isInteger(priority) || priority < 1 || priority > actionCount) return fallback;
  const marker = "\n\n以上仅为日常生活方式参考。";
  if (!fallback.includes(marker)) return fallback;
  return fallback.replace(marker, `\n\n根据你保存的生活偏好，建议优先从第 ${priority} 项开始。${marker}`);
}

export function finalizeLifestyleReply(guard: GuardResult, modelReply: string) {
  if (guard.responseType !== "recommendation") return guard.reply;
  const approvedReplies = new Set([guard.reply]);
  for (let priority = 1; priority <= 5; priority += 1) {
    approvedReplies.add(prioritizeFallbackReply(guard.reply, priority));
  }
  return approvedReplies.has(modelReply) ? modelReply : guard.reply;
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
    return "可以先用这份轻量安排开始：\n\n早上\n1. 起床后喝水并简单活动几分钟。\n2. 早餐选择主食、蛋白质食物和一份果蔬。\n\n中午\n3. 正常吃午餐，放慢进餐速度。\n4. 饭后安排十分钟轻松走动，下午久坐时定时起身。\n\n晚上\n5. 晚餐不过晚、不过量，睡前一小时减少屏幕和咖啡因，并在相对固定的时间准备休息。\n\n今天只需要优先完成其中两项。你的起床时间和工作时间大约是什么时候？\n\n以上仅为日常生活方式参考。";
  }
  return "想把一个习惯坚持下来，可以先把目标缩小：\n\n1. 一次只调整一件事。\n2. 把行动放在固定触发点之后，例如吃完午饭后走十分钟。\n3. 让第一次行动在十分钟内可以完成。\n4. 用简单勾选记录完成情况，不追求连续满分。\n5. 如果中断，第二天直接恢复，不额外补做。\n\n你现在最想改善饮食、作息还是运动？\n\n以上仅为日常生活方式参考。";
}
