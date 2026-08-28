"use client";

import { useCallback, useEffect, useState } from "react";
import { AI_CONVERSATION_NOTICE, AI_CONVERSATION_SCOPE, hasConversationConsent } from "./lib/ai-consent";

type PageName = "生活建议" | "生活偏好" | "习惯计划";
type IconName = "chat" | "sliders" | "target" | "history" | "privacy" | "menu" | "send" | "check" | "chevron-left" | "chevron-right" | "close" | "arrow-right";
type Subject = { id: string; profileJson?: string | null };
type Consent = { subjectId: string; scope: string; status: string };
type Goal = { id: string; type: string; title: string };
type Message = { id?: string; role: "user" | "assistant"; content: string; category?: string; responseType?: string; provider?: string; status?: string };
type Conversation = { userMessage?: Message; assistantMessage?: Message; items?: Message[] };
type BootstrapData = { subject?: Subject; consents?: Consent[]; goals?: Goal[] };
type SetNotice = (message: string) => void;

const nav: Array<{ label: PageName; icon: IconName }> = [
  { label: "生活建议", icon: "chat" },
  { label: "生活偏好", icon: "sliders" },
  { label: "习惯计划", icon: "target" },
];

const prompts = [
  ["帮我安排健康的一天", "早、中、晚的饮食、活动与休息建议"],
  ["我想调整作息", "从今晚能做到的小调整开始"],
  ["给我一份新手运动计划", "按时间和经验安排低门槛活动"],
  ["帮我改善晚餐习惯", "减少太晚、太撑和随意进食"],
];

const request = async <T,>(payload: Record<string, unknown>): Promise<T> => {
  const response = await fetch("/api/product", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "request_failed");
  return data as T;
};

const fetchBootstrap = async () => {
  const response = await fetch("/api/bootstrap");
  if (!response.ok) throw new Error("bootstrap_unavailable");
  return await response.json() as BootstrapData;
};

export default function Home() {
  const [page, setPage] = useState<PageName>("生活建议");
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && (localStorage.getItem("abao-sidebar-collapsed") ?? String(window.innerWidth < 760)) === "true");
  const [notice, setNotice] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [history, setHistory] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationId, setConversationId] = useState("");

  const load = useCallback(async () => {
    try {
      setBootstrap(await fetchBootstrap());
    } catch {
      setNotice("生活偏好暂时无法读取，你仍然可以继续浏览页面");
    }
  }, []);

  useEffect(() => {
    const scheduledLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(scheduledLoad);
  }, [load]);

  const subjectId = bootstrap?.subject?.id ?? "";
  const go = (next: PageName) => {
    setPage(next);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = () => setCollapsed((current) => {
    const next = !current;
    localStorage.setItem("abao-sidebar-collapsed", String(next));
    return next;
  });
  const newConversation = () => {
    setConversation(null);
    setConversationId("");
    go("生活建议");
  };
  const openConversation = async (id: string) => {
    try {
      const response = await fetch(`/api/product?resource=messages&conversationId=${encodeURIComponent(id)}`);
      const data = await response.json() as { messages?: Message[] };
      if (!response.ok) throw new Error("history_unavailable");
      setConversationId(id);
      setConversation({ items: data.messages });
      setHistory(false);
      go("生活建议");
    } catch {
      setNotice("建议记录暂时无法读取");
    }
  };
  const authorizeDialogue = async () => {
    // Refresh on every send so a withdrawal in another tab is not overwritten.
    const fresh = await fetchBootstrap();
    setBootstrap(fresh);
    const activeSubjectId = fresh.subject?.id;
    if (!activeSubjectId) throw new Error("profile_unavailable");
    if (hasConversationConsent(fresh.consents ?? [], activeSubjectId)) return;
    const latest = [...(fresh.consents ?? [])].reverse().find((item) => item.subjectId === activeSubjectId && item.scope === AI_CONVERSATION_SCOPE);
    if (latest) return; // A declined/revoked grant stays off until changed in privacy settings.
    const confirmed = window.confirm(AI_CONVERSATION_NOTICE);
    await request({ action: "set_consent", subjectId: activeSubjectId, scope: AI_CONVERSATION_SCOPE, status: confirmed ? "granted" : "revoked" });
    await load();
  };
  const begin = async (text: string) => {
    const activeSubjectId = subjectId || (await fetchBootstrap()).subject?.id;
    if (!activeSubjectId) throw new Error("profile_unavailable");
    const created = await request<{ id: string }>({ action: "create_conversation", subjectId: activeSubjectId, title: text.slice(0, 30) });
    const result = await request<Conversation>({ action: "send_message", conversationId: created.id, content: text, inputType: "text" });
    setConversationId(created.id);
    setConversation(result);
    setPage("生活建议");
  };

  return (
    <main className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <button className="brand" onClick={newConversation} aria-label="返回大象阿宝首页">
            <LogoMark />
            <span><b>大象阿宝</b><small>健康生活助手</small></span>
          </button>
          <button className="collapse-button" onClick={toggle} aria-label={collapsed ? "展开侧栏" : "收起侧栏"} aria-expanded={!collapsed}>
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
          </button>
        </div>
        <nav aria-label="主要功能">
          <button className={page === "生活建议" ? "active" : ""} onClick={newConversation}>
            <Icon name="chat" /><span>新对话</span>
          </button>
          {nav.slice(1).map((item) => (
            <button key={item.label} className={page === item.label ? "active" : ""} onClick={() => go(item.label)}>
              <Icon name={item.icon} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button onClick={() => setHistory(true)}><Icon name="history" /><span>建议记录</span></button>
          <button onClick={() => setPrivacy(true)}><Icon name="privacy" /><span>数据与隐私</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" onClick={toggle} aria-label="切换导航"><Icon name="menu" /></button>
          <button className="product-title" onClick={newConversation}>大象阿宝 <span>健康生活助手</span></button>
          <div className="top-actions">
            <span className="scope-badge">只提供生活方式推荐</span>
            <button className="icon-button" onClick={() => setHistory(true)} aria-label="打开建议记录"><Icon name="history" /></button>
            <button className="avatar" onClick={() => setPrivacy(true)} aria-label="打开数据与隐私">我</button>
          </div>
        </header>

        <div className={`content ${page === "生活建议" ? "chat-content" : ""}`}>
          {page === "生活建议" && <AdvicePage key={conversationId || conversation?.assistantMessage?.content || "new"} conversation={conversation} conversationId={conversationId} onStart={begin} onAuthorize={authorizeDialogue} onChange={(items) => setConversation({ items })} setNotice={setNotice} />}
          {page === "生活偏好" && <PreferencePage subject={bootstrap?.subject} reload={load} setNotice={setNotice} />}
          {page === "习惯计划" && <HabitPage subjectId={subjectId} goals={bootstrap?.goals ?? []} reload={load} setNotice={setNotice} />}
        </div>
      </section>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="关闭提示"><Icon name="close" /></button></div>}
      {privacy && <PrivacyModal close={() => setPrivacy(false)} subjectId={subjectId} reload={load} setNotice={setNotice} />}
      {history && <HistoryModal close={() => setHistory(false)} openConversation={openConversation} />}
    </main>
  );
}

function AdvicePage({ conversation, conversationId, onStart, onAuthorize, onChange, setNotice }: { conversation: Conversation | null; conversationId: string; onStart: (text: string) => Promise<void>; onAuthorize: () => Promise<void>; onChange: (items: Message[]) => void; setNotice: SetNotice }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Message[]>(() => conversation?.items ?? [conversation?.userMessage, conversation?.assistantMessage].filter((item): item is Message => Boolean(item)));
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState("");

  const submit = async (value?: string) => {
    const content = (value ?? text).trim();
    if (!content || sending) return;
    setSending(true);
    setPendingText(content);
    setNotice("");
    try {
      await onAuthorize();
      if (conversationId) {
        const result = await request<Required<Pick<Conversation, "userMessage" | "assistantMessage">>>({ action: "send_message", conversationId, content, inputType: "text" });
        const nextItems = [...items, result.userMessage, result.assistantMessage];
        setItems(nextItems);
        onChange(nextItems);
      } else {
        await onStart(content);
      }
      setText("");
    } catch {
      setText(content);
      setNotice("消息未能完成发送，输入已保留，请稍后重试或重新登录");
    } finally {
      setSending(false);
      setPendingText("");
    }
  };
  const rate = async (messageId: string | undefined, type: string) => {
    if (!messageId) return;
    try {
      await request({ action: "feedback", messageId, type });
      setNotice("感谢反馈，我们会继续优化建议的可执行性");
    } catch {
      setNotice("反馈暂时无法保存");
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-scroll">
        {!items.length ? (
          <section className="welcome">
            <div className="welcome-mark"><LogoMark /></div>
            <span className="eyebrow">今天从一件小事开始</span>
            <h1>你好，我是阿宝</h1>
            <p>告诉我你想改善的饮食、作息、运动或日常习惯。授权后，我会通过 DeepSeek 和你聊清需求，再一起找到适合你的小行动。</p>
            <div className="prompt-grid">
              {prompts.map(([title, description]) => (
                <button key={title} onClick={() => submit(title)} disabled={sending}>
                  <span><b>{title}</b><small>{description}</small></span><span className="prompt-arrow"><Icon name="arrow-right" /></span>
                </button>
              ))}
            </div>
            <div className="scope-note"><Icon name="check" /><span>只讨论日常生活方式，不判断身体问题，不提供相关处理方案。</span></div>
          </section>
        ) : (
          <div className="conversation">
            {items.map((message, index) => message.role === "user" ? (
              <div className="user-message" key={message.id ?? index}>{message.content}</div>
            ) : (
              <article className={`assistant-message ${message.responseType === "boundary_refusal" ? "boundary-card" : ""}`} key={message.id ?? index}>
                <LogoMark />
                <div>
                  <span className="category">{message.category ?? "生活建议"}</span>
                  {message.provider && <small className="reply-source">{message.provider === "deepseek" ? "DeepSeek 回复" : message.status === "unavailable" ? "DeepSeek 暂未连接 · 本地回复" : message.status === "consent_required" ? "尚未授权 DeepSeek · 本地回复" : "本地安全提示"}</small>}
                  <p>{message.content}</p>
                  {message.status === "consent_required" && <small>可在“数据与隐私”中授权，开启连续需求对话。</small>}
                  {message.status === "unavailable" && <small>本次未获得有效的 DeepSeek 回复，请稍后重试；持续失败时请联系管理员检查连接配置。</small>}
                  {message.id && <div className="feedback-row">
                    <span>这份建议怎么样？</span>
                    <button onClick={() => rate(message.id, "helpful")}>有帮助</button>
                    <button onClick={() => rate(message.id, "too_hard")}>太难执行</button>
                    <button onClick={() => rate(message.id, "not_fit")}>不符合习惯</button>
                    <button onClick={() => rate(message.id, "inappropriate")}>内容不合适</button>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
        {sending && <div className="user-message">{pendingText}</div>}
        {sending && <div className="thinking-card" role="status" aria-live="polite">
          <LogoMark />
          <span><b>阿宝正在整理生活建议</b><small>会先从一件容易开始的小事说起</small></span>
          <i className="thinking-dots" aria-hidden="true"><i /><i /><i /></i>
        </div>}
      </div>
      <div className="chat-dock">
        <div className="composer">
          <label htmlFor="advice-input">你想改善什么？</label>
          <textarea id="advice-input" value={text} disabled={sending} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); submit(); }
          }} placeholder="例如：我晚上总是很晚睡，想调整作息" maxLength={2000} />
          <div><small>{text.length}/2000</small><button className="send-button" onClick={() => submit()} disabled={sending || !text.trim()} aria-label="发送问题"><Icon name="send" />{sending ? "生成中" : "发送"}</button></div>
        </div>
        <p className="boundary-text">建议仅用于饮食、作息、运动和习惯管理等日常生活参考。</p>
      </div>
    </div>
  );
}

function parsePreferences(subject?: Subject) {
  try { return (JSON.parse(subject?.profileJson ?? "{}") as { lifestylePreferences?: Record<string, string> }).lifestylePreferences ?? {}; } catch { return {}; }
}

function PreferencePage({ subject, reload, setNotice }: { subject?: Subject; reload: () => Promise<void>; setNotice: SetNotice }) {
  const current = parsePreferences(subject);
  const [wakeTime, setWakeTime] = useState(current.wakeTime ?? "07:30");
  const [sleepTime, setSleepTime] = useState(current.sleepTime ?? "23:00");
  const [mealStyle, setMealStyle] = useState(current.mealStyle ?? "规律三餐");
  const [exerciseLevel, setExerciseLevel] = useState(current.exerciseLevel ?? "刚开始");
  const [availableMinutes, setAvailableMinutes] = useState(current.availableMinutes ?? "20");
  const [lifestyleGoal, setLifestyleGoal] = useState(current.lifestyleGoal ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!subject?.id || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await request({ action: "update_preferences", subjectId: subject.id, preferences: { wakeTime, sleepTime, mealStyle, exerciseLevel, availableMinutes, lifestyleGoal } });
      await reload();
      setSaved(true);
      setNotice("生活偏好已保存，后续建议会优先参考这些信息");
    } catch {
      setNotice("生活偏好暂时无法保存");
    } finally { setSaving(false); }
  };

  return <div className="page preferences-page">
    <PageHeader kicker="只保存你主动填写的内容" title="生活偏好" description="这些信息只用于让饮食、作息和运动建议更贴近日常安排。" />
    <section className="form-card">
      <div className="field-grid">
        <label><span>通常起床时间</span><input type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} /></label>
        <label><span>希望入睡时间</span><input type="time" value={sleepTime} onChange={(event) => setSleepTime(event.target.value)} /></label>
        <label><span>饮食习惯</span><select value={mealStyle} onChange={(event) => setMealStyle(event.target.value)}><option>规律三餐</option><option>经常不吃早餐</option><option>经常点外卖</option><option>晚餐较晚</option></select></label>
        <label><span>运动经验</span><select value={exerciseLevel} onChange={(event) => setExerciseLevel(event.target.value)}><option>刚开始</option><option>偶尔运动</option><option>保持规律运动</option></select></label>
        <label><span>每天可活动时间</span><select value={availableMinutes} onChange={(event) => setAvailableMinutes(event.target.value)}><option value="10">10 分钟</option><option value="20">20 分钟</option><option value="30">30 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option></select></label>
        <label className="full-field"><span>最想改善的生活目标</span><textarea value={lifestyleGoal} onChange={(event) => setLifestyleGoal(event.target.value)} maxLength={200} placeholder="例如：希望晚上 11 点前放下手机并准备休息" /><small>{lifestyleGoal.length}/200</small></label>
      </div>
      <div className="form-actions"><p>不会询问或使用疾病、检查和药品信息来生成计划。</p><button className={`primary-button ${saved ? "is-success" : ""}`} onClick={save} disabled={saving}>{saving ? "保存中" : saved ? "已保存" : "保存生活偏好"}</button></div>
    </section>
  </div>;
}

function HabitPage({ subjectId, goals, reload, setNotice }: { subjectId: string; goals: Goal[]; reload: () => Promise<void>; setNotice: SetNotice }) {
  const [type, setType] = useState("作息");
  const [title, setTitle] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const create = async () => {
    if (!subjectId || !title.trim()) return;
    try {
      await request({ action: "create_goal", subjectId, type, title: title.trim(), plan: { cycle: "weekly", dailyAction: title.trim(), checkin: "manual" }, reminder: { enabled: false } });
      setTitle("");
      await reload();
      setNotice("习惯计划已创建");
    } catch { setNotice("习惯计划暂时无法保存"); }
  };
  return <div className="page habit-page">
    <PageHeader kicker="一次只改变一件小事" title="习惯计划" description="选择一个方向，写下一项当天可以完成的行动，并用打卡记录坚持情况。" />
    <section className="goal-builder">
      <div className="segmented" aria-label="计划类型">{["作息", "饮食", "运动", "日常习惯"].map((item) => <button key={item} className={type === item ? "selected" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
      <label><span>我的行动</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="例如：晚饭后散步 10 分钟" /></label>
      <button className="primary-button" onClick={create} disabled={!title.trim()}>创建计划</button>
    </section>
    {goals.length ? <div className="goal-list">{goals.map((goal) => <article className="goal-card" key={goal.id}>
      <div><span>{goal.type}</span><h2>{goal.title}</h2><p>今天完成后点一下打卡，不需要补做或追求满分。</p></div>
      <button className={completed.has(goal.id) ? "is-complete" : ""} disabled={completed.has(goal.id)} onClick={async () => {
        await request({ action: "checkin", goalId: goal.id });
        setCompleted((current) => new Set(current).add(goal.id));
        setNotice("今天的行动已记录");
      }}><Icon name="check" />{completed.has(goal.id) ? "今天已完成" : "完成今日行动"}</button>
    </article>)}</div> : <section className="empty-card"><Icon name="target" /><h2>还没有习惯计划</h2><p>从一项十分钟内可以完成的小行动开始。</p></section>}
  </div>;
}

function PageHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <header className="page-header"><span>{kicker}</span><h1>{title}</h1><p>{description}</p></header>;
}

function PrivacyModal({ close, subjectId, reload, setNotice }: { close: () => void; subjectId: string; reload: () => Promise<void>; setNotice: SetNotice }) {
  const setPermission = async (status: string) => {
    try {
      if (status === "granted" && !window.confirm(AI_CONVERSATION_NOTICE)) return;
      await request({ action: "set_consent", subjectId, scope: AI_CONVERSATION_SCOPE, status });
      await reload();
      setNotice(status === "granted" ? "DeepSeek 连续对话授权已记录" : "授权已撤回，后续消息不会发送给 DeepSeek；已发出的请求不受影响");
    } catch { setNotice("授权状态暂时无法保存"); }
  };
  const deleteAccount = async () => {
    if (!window.confirm("确定删除账号及全部数据吗？此操作无法恢复。")) return;
    const response = await fetch("/api/product?resource=account", { method: "DELETE" });
    if (response.ok) window.location.href = "/signout-with-chatgpt?return_to=/";
    else setNotice("账号暂时无法删除");
  };
  return <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <button className="close-button" onClick={close} aria-label="关闭"><Icon name="close" /></button>
    <span className="modal-kicker">数据与隐私</span><h2 id="privacy-title">你的内容由你控制</h2>
    <p>授权后，本次输入原文、当前对话最近最多 12 条可用消息和你主动保存的生活偏好会发送给 DeepSeek API，用于理解需求和连续交流。不会附带账号身份、旧医疗档案或其他对话。请勿在输入中填写敏感个人信息。旧版排序授权不会自动启用此功能。生活偏好和对话记录保存在你的账号下。</p>
    <div className="permission"><span><b>DeepSeek 连续对话</b><small>撤回后不再发送新消息，已经发出的请求不受影响</small></span><div><button onClick={() => setPermission("granted")}>授权</button><button onClick={() => setPermission("revoked")}>撤回</button></div></div>
    <div className="modal-actions"><button className="danger-button" onClick={deleteAccount}>删除账号及全部数据</button><button className="primary-button" onClick={close}>完成</button></div>
  </section></div>;
}

type HistoryRow = { id: string; title: string; summary?: string | null; updatedAt: string };

function HistoryModal({ close, openConversation }: { close: () => void; openConversation: (id: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const search = async (value = query) => {
    const response = await fetch(`/api/product?resource=history&q=${encodeURIComponent(value)}`);
    if (response.ok) setRows(((await response.json()) as { conversations?: HistoryRow[] }).conversations ?? []);
  };
  useEffect(() => {
    void fetch("/api/product?resource=history&q=").then(async (response) => {
      if (response.ok) setRows(((await response.json()) as { conversations?: HistoryRow[] }).conversations ?? []);
    });
  }, []);
  return <div className="overlay"><section className="modal history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
    <button className="close-button" onClick={close} aria-label="关闭"><Icon name="close" /></button>
    <span className="modal-kicker">建议记录</span><h2 id="history-title">找回以前的生活建议</h2>
    <label className="search-field"><span>搜索关键词</span><input value={query} onChange={(event) => { setQuery(event.target.value); void search(event.target.value); }} placeholder="例如：睡眠、早餐、运动" /></label>
    {rows.length ? <div className="history-list">{rows.map((row) => <button key={row.id} onClick={() => openConversation(row.id)}><b>{row.title}</b><span>{row.summary || "暂无摘要"}</span><small>{new Date(row.updatedAt).toLocaleString()}</small></button>)}</div> : <div className="history-empty"><Icon name="history" /><b>暂无匹配记录</b><span>完成一次生活建议对话后，可以在这里按关键词查找。</span></div>}
  </section></div>;
}

function LogoMark() { return <span className="logo-mark" aria-hidden="true" />; }

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></>,
    sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M21 12h-3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    privacy: <><path d="M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
