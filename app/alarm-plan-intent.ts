import { parseAlarmTimeFromTitle } from "./alarm-reminder.ts";

export type AlarmPlanType = "作息" | "饮食" | "运动" | "日常习惯";

export type AlarmPlanProposal = {
  type: AlarmPlanType;
  title: string;
  hour: number;
  minute: number;
  displayTime: string;
  source: "user_message";
};

const alarmActionPattern = /(提醒|闹钟|闹铃|叫我)/;
const planActionPattern = /(?:添加|加入|保存|创建|建立|设定|记录|放进|放入|放到|加到).{0,18}(?:习惯计划|计划|目标)|(?:习惯计划|计划|目标).{0,18}(?:添加|加入|保存|创建|建立|设定|记录|放进|放入|放到|加到)/;
const negatedPattern = /(?:不要|不用|别|取消|暂不|先不|无需|不想).{0,18}(?:提醒|闹钟|闹铃|叫我|添加|加入|保存|创建|设定)/;

function inferType(content: string): AlarmPlanType {
  if (/(运动|锻炼|跑步|散步|走路|健身|拉伸|骑行|游泳|跳绳)/.test(content)) return "运动";
  if (/(吃|饮食|早餐|午餐|晚餐|外卖|蔬菜|水果|喝水|饮水)/.test(content)) return "饮食";
  if (/(睡|起床|早起|熬夜|作息|休息|午休)/.test(content)) return "作息";
  return "日常习惯";
}

function cleanTitle(content: string) {
  return content
    .replace(/^(?:请|请你|麻烦|麻烦你|帮我)?把?\s*/, "")
    .replace(/(?:并|再|然后)?\s*(?:添加|加入|保存|创建|建立|设定|记录|放进|放入|放到|加到)\s*(?:到|进|入)?\s*(?:我的)?\s*(?:习惯计划|计划|目标|闹钟|闹铃)(?:中|里)?/g, "")
    .replace(/(?:设置|设成|设为|添加|加入|创建)\s*(?:一个|为)?\s*(?:系统)?\s*(?:闹钟|闹铃)/g, "")
    .replace(/(?:请)?提醒我|叫我/g, "")
    .replace(/[，,。；;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAlarmPlanConfirmation(input: string, responseType?: string): AlarmPlanProposal | null {
  if (responseType === "boundary_refusal" || responseType === "safety_stop") return null;
  const content = input.trim().replace(/\s+/g, " ");
  if (!content || negatedPattern.test(content)) return null;
  const alarmTime = parseAlarmTimeFromTitle(content);
  if (!alarmTime || (!alarmActionPattern.test(content) && !planActionPattern.test(content))) return null;
  const title = cleanTitle(content);
  if (!title) return null;
  return {
    type: inferType(content),
    title,
    hour: alarmTime.hour,
    minute: alarmTime.minute,
    displayTime: alarmTime.display,
    source: "user_message",
  };
}
