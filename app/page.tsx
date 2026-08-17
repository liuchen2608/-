"use client";

import { useRef, useState } from "react";

const nav = [["⌂","健康首页"],["◌","健康问答"],["▤","图片解读"],["▣","健康档案"],["◎","目标与提醒"],["⌁","设备数据"],["✚","医疗服务"]];
const members = ["我","妈妈","爸爸"];

export default function Home(){
  const [page,setPage]=useState("健康首页");
  const [member,setMember]=useState("我");
  const [notice,setNotice]=useState("");
  const [privacy,setPrivacy]=useState(false);
  const [history,setHistory]=useState(false);
  const go=(next:string)=>{setPage(next);setNotice("");window.scrollTo({top:0,behavior:"smooth"})};
  return <main className="shell">
    <aside className="side">
      <button className="brand" onClick={()=>go("健康首页")}><span>大象</span>阿宝<small>AI 健康朋友</small></button>
      <nav aria-label="产品功能">{nav.map(([icon,label])=><button key={label} className={page===label?"active":""} onClick={()=>go(label)}><i>{icon}</i><span>{label}</span></button>)}</nav>
      <div className="side-foot"><button onClick={()=>setHistory(true)}><i>⌕</i><span>历史与检索</span></button><button onClick={()=>setPrivacy(true)}><i>◇</i><span>隐私与授权</span></button></div>
    </aside>
    <section className="main">
      <header className="top"><div><span>当前健康主体</span><button onClick={()=>setMember(member==="我"?"妈妈":"我")}>{member}⌄</button></div><button className="global-search" onClick={()=>setHistory(true)}>⌕　搜索对话、报告与健康记录</button><button className="privacy-badge" onClick={()=>setPrivacy(true)}>▣　健康数据保护</button><button className="user" aria-label="账号菜单">我</button></header>
      <div className="content"><Panel page={page} go={go} member={member} setMember={setMember} setNotice={setNotice}/></div>
    </section>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {privacy&&<PrivacyModal close={()=>setPrivacy(false)} setNotice={setNotice}/>} 
    {history&&<HistoryModal close={()=>setHistory(false)} go={go}/>} 
  </main>
}

function Panel(props:any){switch(props.page){
  case "健康问答": return <AskPage {...props}/>;
  case "图片解读": return <ReportPage {...props}/>;
  case "健康档案": return <ArchivePage {...props}/>;
  case "目标与提醒": return <GoalPage {...props}/>;
  case "设备数据": return <DevicePage {...props}/>;
  case "医疗服务": return <ServicePage {...props}/>;
  default:return <HomePage {...props}/>;
}}

function HomePage({go,member,setMember,setNotice}:any){return <>
  <section className="hero"><div className="hero-copy"><span className="eyebrow">AI 健康朋友</span><h1>从一个健康问题开始，<br/>持续照顾你和家人</h1><p>用文字、语音或图片描述问题。阿宝会补充询问必要信息，并在需要时连接专业医疗服务。</p><div className="hero-actions"><button className="primary" onClick={()=>go("健康问答")}>开始健康问答</button><button onClick={()=>go("图片解读")}>上传健康资料</button></div><small>AI 输出仅供参考，不能替代专业医生的诊断和治疗建议。</small></div><div className="hero-art" aria-hidden="true"><span className="tag t1">主动追问</span><span className="tag t2">风险分流</span><div>🐘</div><span className="tag t3">档案参考</span></div></section>
  <SubjectBar member={member} setMember={setMember}/>
  <section className="section"><div className="section-title"><div><span>核心能力</span><h2>围绕健康管理的完整闭环</h2></div><p>问题理解、行动建议、持续记录与专业服务连接</p></div><div className="feature-grid">{[["◌","健康问答","文字、语音、图片提问与主动追问","健康问答"],["▤","图片与文件解读","质量检查、字段确认、通俗解释","图片解读"],["▣","个人与家庭档案","按人、时间和资料类型管理记录","健康档案"],["◎","目标、计划与提醒","可编辑计划、打卡与提醒控制","目标与提醒"],["⌁","设备数据接入","同步状态、数据来源与质量说明","设备数据"],["✚","医疗服务连接","在线问诊、预约挂号与云陪诊","医疗服务"]].map(([icon,title,desc,target])=><button key={title} onClick={()=>go(target)}><i>{icon}</i><span><b>{title}</b><em>{desc}</em></span><strong>›</strong></button>)}</div></section>
  <section className="safety"><i>!</i><div><b>医疗安全是所有功能的前提</b><span>疑似急症时停止普通问答，明确建议联系急救或立即线下就医；信息不足时不会输出确定性结论。</span></div><button onClick={()=>setNotice("安全边界：急症优先、说明不确定性、高风险操作需用户确认")}>查看安全边界</button></section>
</>}

function SubjectBar({member,setMember}:any){return <div className="subject-bar"><span>为谁管理健康</span>{members.map(m=><button key={m} className={member===m?"selected":""} onClick={()=>setMember(m)}>{m}</button>)}<p>不同家庭成员的数据默认隔离，不会混入同一上下文。</p></div>}

function PageIntro({kicker,title,desc,icon}:any){return <div className="page-intro"><span>{kicker}</span><h1>{title}</h1><p>{desc}</p><i>{icon}</i></div>}

function AskPage({member,setMember,setNotice}:any){
  const [text,setText]=useState(""); const [stage,setStage]=useState<"start"|"follow"|"risk">("start");
  const submit=()=>{if(!text.trim())return;setStage(/胸痛|呼吸困难|昏迷|意识不清|严重出血/.test(text)?"risk":"follow")};
  return <div className="page"><PageIntro kicker="多模态健康问答" title="把健康问题说给阿宝听" desc="支持文字、语音与图片。必要时会主动追问影响风险判断的关键信息。" icon="◌"/><SubjectBar member={member} setMember={setMember}/><section className="ask-workspace"><div className="chat-area">
    {stage==="start"&&<div className="empty-chat"><div>🐘</div><h2>现在感觉怎么样？</h2><p>你可以描述症状、生活方式问题，或上传报告与药品图片。</p><div>{["最近睡不好","看懂体检报告","了解药品信息"].map(x=><button onClick={()=>setText(x)} key={x}>{x}</button>)}</div></div>}
    {stage==="follow"&&<div className="conversation"><div className="mine">{text}</div><div className="abo"><span>🐘</span><div><b>为了更准确地理解，我还想确认：</b><p>这种情况持续多久了？严重程度有没有变化？</p><div className="choice-row"><button>少于 1 周</button><button>1–4 周</button><button>超过 1 个月</button></div><small>已使用：{member}的当前咨询内容。写入长期健康记忆前会再次征得同意。</small></div></div></div>}
    {stage==="risk"&&<div className="risk-card"><i>!</i><h2>这可能是需要立即处理的高风险情况</h2><p>请立即联系当地急救电话或前往最近的急诊。不要等待 AI 继续分析。</p><button onClick={()=>setNotice("请立即联系当地急救服务或前往急诊")}>查看紧急行动建议</button></div>}
    <div className="composer"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="描述健康问题或症状…" aria-label="健康问题"/><div><button onClick={()=>setNotice("语音输入会在使用时请求麦克风授权")}>♩ 语音</button><button onClick={()=>setNotice("图片上传会在使用时请求相册或相机授权")}>▧ 图片</button><button className="primary" onClick={submit}>发送</button></div></div><p className="boundary">仅供参考，不能替代专业医生的诊断和治疗建议</p>
  </div><aside className="ask-aside"><h3>回答会包含</h3>{[["01","结论摘要"],["02","依据与来源类型"],["03","风险提示"],["04","建议动作"]].map(x=><div key={x[0]}><b>{x[0]}</b><span>{x[1]}</span></div>)}<hr/><p>你可以对回答标记有帮助、无帮助、风险问题或事实错误。</p></aside></section></div>
}

function ReportPage({setNotice}:any){const input=useRef<HTMLInputElement>(null);const [file,setFile]=useState("");return <div className="page"><PageIntro kicker="图片与文件解读" title="先确认原始信息，再理解健康资料" desc="适用于检查报告、病例、处方和药盒。识别字段经你确认后才会生成解释。" icon="▤"/><section className="upload-card"><button className="upload" onClick={()=>input.current?.click()}><i>{file?"✓":"＋"}</i><b>{file||"拍摄或上传健康资料"}</b><span>{file?"文件已选择，下一步进行质量检查":"上传前请遮挡与解读无关的个人信息"}</span></button><input ref={input} hidden type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f.name);setNotice("已选择文件，尚未上传或写入档案")}}}/><div className="flow">{[["1","质量检查","检测模糊、反光、裁切、倒置与缺页"],["2","字段确认","核对原始数值、文字与资料类型"],["3","结构化解读","原文、通俗解释、可能影响、建议动作"]].map(x=><div key={x[0]}><i>{x[0]}</i><b>{x[1]}</b><span>{x[2]}</span></div>)}</div></section><section className="plain-note"><b>识别失败时</b><span>系统会提供重拍规范，并支持重新上传、改用文字或转人工服务。</span></section></div>}

function ArchivePage({member,setMember,setNotice}:any){return <div className="page"><PageIntro kicker="个人与家庭健康档案" title="按人、按时间，留下可追溯的健康脉络" desc="记录问答、报告、用药、设备数据、健康目标与服务记录，并清晰标注数据来源。" icon="▣"/><SubjectBar member={member} setMember={setMember}/><section className="archive-toolbar"><button>⌕ 搜索档案</button><div><button className="selected">全部资料</button><button>问答</button><button>报告</button><button>用药</button><button>设备数据</button></div><button onClick={()=>setNotice("导出前将再次确认档案范围与身份")}>导出档案</button></section><section className="empty-state"><i>▣</i><h2>{member}的健康档案</h2><p>暂无健康资料。通过问答、报告上传、手动记录或设备授权添加第一条记录。</p><div><button className="primary" onClick={()=>setNotice("请选择问答、上传或手动记录入口")}>添加健康记录</button><button onClick={()=>setNotice("家庭成员共享需单独授权")}>管理家庭授权</button></div><small>AI 提取的信息会保留原始材料引用，你可以随时更正或删除。</small></section><DataSources/></div>}

function DataSources(){return <section className="source-grid">{[["用户输入","由你主动记录或确认"],["设备同步","包含设备、时间、单位与质量状态"],["医疗机构导入","保留机构与原始材料来源"],["AI 推断","明确标注，不与原始事实混淆"]].map(x=><div key={x[0]}><i/><b>{x[0]}</b><span>{x[1]}</span></div>)}</section>}

function GoalPage({setNotice}:any){const [created,setCreated]=useState(false);return <div className="page"><PageIntro kicker="健康陪伴" title="把健康目标变成可调整的日常计划" desc="目标说明、周期、行动、打卡和提醒都由你控制，可随时编辑、暂停或关闭。" icon="◎"/>{!created?<section className="empty-state goal-empty"><i>◎</i><h2>建立第一个健康目标</h2><p>可从运动、饮食或睡眠开始。计划会结合已授权信息生成，并允许你逐项修改。</p><div className="goal-types">{["运动","饮食","睡眠"].map(x=><button key={x} onClick={()=>setCreated(true)}>{x}</button>)}</div></section>:<section className="plan-card"><div className="plan-head"><div><span>进行中</span><h2>我的健康目标</h2><p>这是可编辑的阶段计划示例，不涉及疾病治疗或药物调整。</p></div><button onClick={()=>setCreated(false)}>暂停计划</button></div>{[["目标说明","建立更规律的日常健康习惯"],["执行周期","每周检查一次进度"],["每日动作","由你设置具体行动"],["提醒设置","时间、频率和通知渠道可调整"]].map(x=><div className="plan-row" key={x[0]}><b>{x[0]}</b><span>{x[1]}</span><button onClick={()=>setNotice(`${x[0]}可编辑`)}>编辑</button></div>)}<button className="primary checkin" onClick={()=>setNotice("今日打卡已记录，可随时撤销")}>完成今日打卡</button></section>}<section className="plain-note"><b>安全约束</b><span>涉及疾病治疗、药物调整或极端饮食运动的目标，会触发专业审核或就医提示。</span></section></div>}

function DevicePage({setNotice}:any){const [connected,setConnected]=useState(false);return <div className="page"><PageIntro kicker="智能设备数据接入" title="经你授权，汇总连续健康指标" desc="查看授权范围、同步状态与最近同步时间；解绑或重新授权始终由你控制。" icon="⌁"/><section className="device-card"><div className="device-icon">⌁</div><div><h2>{connected?"设备数据已授权":"尚未连接健康设备"}</h2><p>{connected?"等待设备同步数据。每条记录都会包含来源、采集时间、单位和质量状态。":"连接时会逐项说明数据用途和授权范围。支持品牌与指标以真实合作接口为准。"}</p></div><button className={connected?"":"primary"} onClick={()=>{setConnected(!connected);setNotice(connected?"设备已解绑，不再同步新数据":"设备授权范围已确认，可随时撤回")}}>{connected?"解除授权":"连接设备"}</button></section><div className="device-features">{[["同步状态","显示最近同步时间与失败原因"],["数据标准化","处理单位、时区、重复记录与异常值"],["质量说明","标记缺失、延迟、异常和来源设备"],["谨慎解读","不把单次消费级设备读数当作诊断结论"]].map(x=><div key={x[0]}><i>✓</i><b>{x[0]}</b><span>{x[1]}</span></div>)}</div></div>}

function ServicePage({setNotice}:any){return <div className="page"><PageIntro kicker="医疗健康服务连接" title="在 AI 能力之外，连接适当的专业服务" desc="具体服务按地区、机构和账户权限展示；提供方、费用、流程与资料共享范围会在跳转前说明。" icon="✚"/><div className="service-grid">{[["◌","在线问诊","与真人医生进行专业咨询"],["▢","预约挂号","查询并进入可用的挂号路径"],["♙","云陪诊","获取就医流程陪伴服务"]].map(x=><section key={x[1]}><i>{x[0]}</i><h2>{x[1]}</h2><p>{x[2]}</p><ul><li>确认服务提供方</li><li>确认费用与预计流程</li><li>确认资料共享范围</li></ul><button onClick={()=>setNotice(`${x[1]}：可用性需按地区、机构和账户权限确认`)}>查看可用服务</button></section>)}</div><section className="confirm-band"><i>✓</i><div><b>高风险与交易动作必须由你最终确认</b><span>向第三方共享资料、创建预约、购药或支付，AI 都不会静默完成。</span></div></section><section className="emergency"><b>出现疑似急症？</b><span>请立即联系当地急救电话或前往急诊，不要等待在线服务。</span></section></div>}

function PrivacyModal({close,setNotice}:any){return <div className="overlay" onClick={close}><section className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}>×</button><span className="modal-kicker">设置与隐私</span><h2>健康数据由你控制</h2><p>首次使用健康数据、相册、相机、麦克风、通知、设备数据或定位时，会分别说明用途并请求授权。</p>{[["健康档案","未授权"],["相册与相机","使用时询问"],["麦克风","使用时询问"],["设备数据","未授权"]].map(x=><div className="permission" key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}<div className="privacy-actions"><button onClick={()=>setNotice("可导出或更正已保存的健康数据")}>导出与更正</button><button onClick={()=>setNotice("删除前会提示对摘要、趋势与上下文的影响")}>删除数据</button><button onClick={()=>setNotice("撤回授权后将停止对应数据使用")}>撤回授权</button></div><button className="primary wide" onClick={close}>完成</button></section></div>}

function HistoryModal({close,go}:any){return <div className="overlay" onClick={close}><section className="modal history" onClick={e=>e.stopPropagation()}><button className="close" onClick={close}>×</button><span className="modal-kicker">对话记忆与检索</span><h2>查找历史健康信息</h2><label><i>⌕</i><input autoFocus placeholder="按关键词搜索"/></label><div className="filters"><button>日期</button><button>健康主体</button><button>资料类型</button></div><div className="history-empty"><i>⌕</i><b>暂无历史记录</b><span>完成问答或添加资料后，可按关键词、日期、健康主体和资料类型检索。</span></div><button className="primary wide" onClick={()=>{close();go("健康问答")}}>开始第一次健康问答</button></section></div>}
