export type ParsedAlarmTime = {
  hour: number;
  minute: number;
  display: string;
};

const periodOffset = new Set(["下午", "傍晚", "晚上", "夜里", "夜间"]);
const earlyPeriods = new Set(["凌晨", "早上", "上午"]);

function chineseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, units] = value.split("十");
    const left = tens ? digits[tens] : 1;
    const right = units ? digits[units] : 0;
    return left === undefined || right === undefined ? null : left * 10 + right;
  }
  let parsed = 0;
  for (const character of value) {
    if (digits[character] === undefined) return null;
    parsed = parsed * 10 + digits[character];
  }
  return parsed;
}

export function formatAlarmTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseAlarmTimeFromTitle(title: string): ParsedAlarmTime | null {
  const match = title.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|夜间)?\s*([零〇一二两三四五六七八九十\d]{1,3})\s*(?:(?:点|时)(?:(半|一刻|三刻)|([零〇一二两三四五六七八九十\d]{1,3})\s*分?)?|[:：]\s*([0-5]?\d))/);
  if (!match) return null;

  const period = match[1] ?? "";
  const parsedHour = chineseNumber(match[2]);
  if (parsedHour === null || parsedHour < 0 || parsedHour > 23) return null;

  let minute = 0;
  if (match[3] === "半") minute = 30;
  else if (match[3] === "一刻") minute = 15;
  else if (match[3] === "三刻") minute = 45;
  else if (match[4]) minute = chineseNumber(match[4]) ?? -1;
  else if (match[5]) minute = Number(match[5]);
  if (minute < 0 || minute > 59) return null;

  let hour = parsedHour;
  if (periodOffset.has(period) && hour < 12) hour += 12;
  if (period === "中午" && hour > 0 && hour < 11) hour += 12;
  if ((period === "凌晨" || earlyPeriods.has(period)) && hour === 12) hour = 0;
  if (period === "晚上" && parsedHour === 12) hour = 0;

  return { hour, minute, display: formatAlarmTime(hour, minute) };
}

export function readAlarmEnabled(reminderJson?: string | null) {
  try {
    const reminder = JSON.parse(reminderJson ?? "{}") as { enabled?: unknown; provider?: unknown };
    return reminder.enabled === true && reminder.provider === "android_alarm_clock";
  } catch {
    return false;
  }
}

export function buildAndroidAlarmIntent(input: {
  operation: "set" | "show";
  goalId: string;
  title: string;
  hour?: number;
  minute?: number;
  fallbackUrl: string;
}) {
  const query = new URLSearchParams({ operation: input.operation, goalId: input.goalId, title: input.title });
  if (input.hour !== undefined) query.set("hour", String(input.hour));
  if (input.minute !== undefined) query.set("minute", String(input.minute));
  return `intent://alarm?${query.toString()}#Intent;scheme=daxiangabao;package=com.daxiangabao.health;S.browser_fallback_url=${encodeURIComponent(input.fallbackUrl)};end`;
}
