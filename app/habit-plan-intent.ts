export type HabitPlanType = "作息" | "饮食" | "运动" | "日常习惯";

export type HabitPlanProposal = {
  type: HabitPlanType;
  title: string;
};

const saveAction = "添加|加入|保存|创建|建立|设定|记录|放进|放到|加到";
const planNoun = "习惯计划|计划|目标";
const explicitSavePattern = new RegExp(`(?:${saveAction}).{0,18}(?:${planNoun})|(?:${planNoun}).{0,18}(?:${saveAction})`);
const negatedSavePattern = new RegExp(`(?:不要|不用|别|取消|暂不|先不|无需).{0,18}(?:${saveAction})`);

function inferPlanType(content: string): HabitPlanType {
  if (/(运动|锻炼|跑步|散步|走路|健身|拉伸|骑行|游泳|跳绳)/.test(content)) return "运动";
  if (/(吃|饮食|早餐|午餐|晚餐|外卖|蔬菜|水果|喝水|饮水)/.test(content)) return "饮食";
  if (/(睡|起床|早起|熬夜|作息|休息|午休)/.test(content)) return "作息";
  return "日常习惯";
}

function extractPlanTitle(content: string) {
  let title = content
    .replace(/[。！!？?]+$/g, "")
    .replace(/^(?:请|麻烦)?(?:帮我)?(?:把|将)/, "")
    .replace(/^(?:请|麻烦|帮我)?(?:想要|我要|我想|要|能不能|可以)?(?:帮我)?(?:添加|加入|保存|创建|建立|设定|记录|放进|放到|加到)(?:一个|一项|一份)?(?:习惯计划|计划|目标)?[：:，,\s]*/, "")
    .replace(/(?:的)?(?:计划|目标)?(?:添加|加入|保存|创建|建立|设定|记录|放进|放到|加到)(?:我的)?习惯计划(?:中|里)?(?:吧)?$/g, "")
    .replace(/(?:的)?(?:习惯计划|计划|目标)(?:中|里)?(?:吧)?$/g, "")
    .replace(/^[：:，,\s]+|[：:，,\s]+$/g, "")
    .trim();

  if (!title) title = "从今天开始坚持一项小行动";
  return title.slice(0, 80);
}

export function detectHabitPlanIntent(input: string): HabitPlanProposal | null {
  const content = input.trim().replace(/\s+/g, " ");
  if (!content || negatedSavePattern.test(content) || !explicitSavePattern.test(content)) return null;
  return { type: inferPlanType(content), title: extractPlanTitle(content) };
}

