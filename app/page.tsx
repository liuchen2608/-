"use client";

import { useRef, useState } from "react";

const nav = [["⌂","健康首页"],["◌","问阿宝"],["▤","报告解读"],["▣","健康档案"],["♧","家庭管理"],["◎","健康目标"],["✚","医疗服务"]];
const members = ["我","妈妈","爸爸"];

export default function Home(){
  const [active,setActive]=useState("健康首页");
  const [member,setMember]=useState("我");
  const [message,setMessage]=useState("");
  const [reply,setReply]=useState("这种情况持续多久了？");
  const [checked,setChecked]=useState(false);
  const [notice,setNotice]=useState("");
  const [privacy,setPrivacy]=useState(false);
  const file=useRef<HTMLInputElement>(null);
  const go=(name:string)=>{setActive(name);setNotice("")};
  const send=()=>{if(!message.trim())return;setReply("我了解了。为了更安全地判断，还想确认：是否伴随明显胸痛、呼吸困难或意识不清？");setMessage("")};
  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={()=>go("健康首页")}><span>大象</span>阿宝</button>
      <nav aria-label="主要导航">{nav.map(([icon,label])=><button key={label} className={active===label?"active":""} onClick={()=>go(label)}><span className="nav-icon">{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={()=>setPrivacy(true)}><span className="nav-icon">♢</span>隐私与授权</button><button onClick={()=>{setPrivacy(true);setNotice("已打开设置中心")}}><span className="nav-icon">⚙</span>设置</button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><h1>{active}</h1><label className="search"><span>⌕</span><input aria-label="搜索" placeholder="搜索对话、报告或健康记录" /></label><button className="secure" onClick={()=>setPrivacy(true)}>▣ 健康数据已加密</button><button className="icon-btn" aria-label="通知" onClick={()=>setNotice("你有 2 条健康提醒")}>♧<i/></button><button className="avatar" aria-label="用户菜单">👩🏻</button><b>{member}⌄</b></header>
      {active==="健康首页"?<Dashboard go={go} member={member} setMember={setMember} reply={reply} setReply={setReply} message={message} setMessage={setMessage} send={send} checked={checked} setChecked={setChecked} file={file} setNotice={setNotice}/>:<FeaturePage active={active} member={member} setMember={setMember} message={message} setMessage={setMessage} reply={reply} send={send} checked={checked} setChecked={setChecked} file={file} setNotice={setNotice}/>} 
    </section>
    {notice&&<div className="toast" role="status">✓ {notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {privacy&&<div className="overlay" onClick={()=>setPrivacy(false)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setPrivacy(false)}>×</button><span className="modal-icon">🔐</span><h2>你的健康数据，由你掌控</h2><p>大象阿宝仅在你明确授权后使用健康档案。不同家庭成员的数据默认隔离，分享前会再次确认。</p><div className="permission"><span>健康档案个性化</span><b>已授权</b></div><div className="permission"><span>设备健康数据</span><b>已授权</b></div><div className="permission"><span>相册与相机</span><em>使用时询问</em></div><button className="primary" onClick={()=>{setPrivacy(false);setNotice("授权设置已保存")}}>管理授权与数据</button></section></div>}
  </main>
}

function Dashboard({go,member,setMember,reply,setReply,message,setMessage,send,checked,setChecked,file,setNotice}:any){return <>
  <div className="greeting"><span>☼</span>早上好，今天感觉怎么样？<div className="subject">当前健康主体：<b>{member}</b></div></div>
  <div className="dashboard-grid">
    <AskBox reply={reply} setReply={setReply} message={message} setMessage={setMessage} send={send} member={member} file={file} setNotice={setNotice}/>
    <section className="card health-card"><h2>今日健康</h2><div className="metrics"><div><i>◔</i><span>睡眠<b>7小时12分</b></span></div><div><i>♥</i><span>心率<b>72 <small>次/分</small></b></span></div><div><i>♨</i><span>步数<b>6,340 <small>步</small></b></span></div><div><i>♧</i><span>血压<b>120/78</b></span></div></div><Trend/></section>
  </div>
  <div className="quick-actions">{[["▣","拍报告","报告解读"],["▤","查药品","问阿宝"],["♙","找医生","医疗服务"],["▢","预约挂号","医疗服务"]].map(([i,t,p])=><button key={t} onClick={()=>go(p)}><i>{i}</i>{t}</button>)}</div>
  <div className="lower-grid">
    <section className="card mini-card"><div className="section-head"><h2>最近报告</h2><button onClick={()=>go("报告解读")}>全部报告 ›</button></div><div className="report-row"><span className="doc-icon">▤</span><div><b>血常规报告 · 8月12日</b><em>2 项需关注</em><small>先确认识别数据是否准确</small></div><button onClick={()=>go("报告解读")}>查看解读</button></div></section>
    <section className="card mini-card"><div className="section-head"><h2>家庭健康档案</h2><span className="private">▣ 仅你可见</span></div><div className="member-tabs">{members.map((m:string)=><button className={member===m?"selected":""} onClick={()=>setMember(m)} key={m}>{m==="我"?"👩🏻":m==="妈妈"?"👵🏻":"👴🏻"} {m}</button>)}</div><div className="family-summary"><span>💊 用药提醒<br/><b>2 项</b></span><span>📋 体检报告<br/><b>8月12日</b></span><span>♥ 血压趋势<br/><b className="stable">稳定</b></span></div><button className="text-link" onClick={()=>go("健康档案")}>查看全部档案 ›</button></section>
    <section className="card mini-card"><div className="section-head"><h2>健康小目标</h2><button onClick={()=>go("健康目标")}>管理目标 ›</button></div><div className="goal-row"><span>🚶</span><div><b>每日步行 8,000 步</b><div className="progress"><i style={{width:checked?"100%":"68%"}}/></div><em>{checked?"100%":"68%"}</em></div><button className={checked?"done":""} onClick={()=>{setChecked(!checked);setNotice(checked?"已取消今日打卡":"今日目标打卡成功")}}>{checked?"已打卡":"今日打卡"}</button></div><div className="streak">🌙 改善睡眠 · 连续 6 天　 <b>● ● ● ● ● ●</b> ○</div></section>
  </div>
  <section className="service-strip"><div><h2>需要更专业的帮助？</h2><p>连接真人医生与医疗服务，重要操作都由你最终确认</p></div>{[["▣","在线问诊"],["♙","云陪诊"],["⌖","附近医院"]].map(([i,t])=><button key={t} onClick={()=>go("医疗服务")}><i>{i}</i><b>{t}</b></button>)}</section>
  </>}

function AskBox({reply,setReply,message,setMessage,send,member,file,setNotice}:any){return <section className="card ask-card"><div className="ask-title"><div className="elephant">🐘</div><div><h2>问问阿宝</h2><p>用文字、语音或图片，说说你的健康问题</p></div></div><div className="chat"><div className="user-bubble">最近总是睡不好</div><div className="bot-row"><span>🐘</span><div className="bot-bubble">{reply}<div className="chips">{["少于1周","1–4周","超过1个月"].map(x=><button key={x} onClick={()=>setReply(`了解，已经持续${x}。入睡困难、夜间易醒和早醒，哪一种最明显？`)}>{x}</button>)}</div></div></div><div className="context-pill">▤ 已参考：{member}的健康档案</div></div><form className="composer" onSubmit={e=>{e.preventDefault();send()}}><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="描述症状，或上传报告、药盒图片" aria-label="向阿宝提问"/><div className="composer-actions"><span><button type="button" title="语音输入" onClick={()=>setNotice("语音输入已开启")}>♩</button><button type="button" title="上传图片" onClick={()=>file.current?.click()}>▧</button><input ref={file} type="file" accept="image/*,.pdf" hidden onChange={(e:any)=>e.target.files?.[0]&&setNotice(`已选择：${e.target.files[0].name}`)}/><button type="button" title="添加附件" onClick={()=>file.current?.click()}>♧</button></span><button className="send" type="submit">发送</button></div></form><p className="disclaimer">ⓘ 仅供参考，不能替代医生诊断和治疗建议</p></section>}

function Trend(){return <><div className="trend-head"><h3>健康趋势</h3><div><b>睡眠</b><span>心率</span><span>步数</span></div></div><div className="chart" aria-label="近七日睡眠趋势图"><div className="ylabels"><span>10小时</span><span>8小时</span><span>6小时</span><span>4小时</span><span>2小时</span></div><div className="chart-area"><div className="gridlines"/><div className="line"><span/><span/><span/><span/><span/><span/><span/></div><div className="dates"><span>5/7</span><span>5/8</span><span>5/9</span><span>5/10</span><span>5/11</span><span>5/12</span><b>5/13</b></div></div></div></>}

function FeaturePage({active,member,setMember,message,setMessage,reply,send,checked,setChecked,file,setNotice}:any){
  if(active==="问阿宝")return <div className="feature-wrap"><div className="subject-banner">正在为 <b>{member}</b> 咨询 · <button onClick={()=>setMember(member==="我"?"妈妈":"我")}>切换健康主体</button></div><AskBox {...{reply,setReply:()=>{},message,setMessage,send,member,file,setNotice}}/></div>;
  if(active==="报告解读")return <div className="feature-wrap"><div className="feature-hero"><span>▤</span><h2>让专业报告变得简单易懂</h2><p>支持检查报告、病例、处方和药盒图片。上传前请遮挡无关个人信息。</p></div><button className="upload-zone" onClick={()=>file.current?.click()}><i>＋</i><b>上传或拍摄健康资料</b><span>支持 JPG、PNG、PDF，先识别原始字段，再由你确认</span></button><input ref={file} hidden type="file" accept="image/*,.pdf" onChange={(e:any)=>e.target.files?.[0]&&setNotice(`已安全接收 ${e.target.files[0].name}，正在检查清晰度`)}/><div className="steps"><span><b>1</b> 图片质量检查</span><span><b>2</b> 关键字段确认</span><span><b>3</b> 通俗解释与建议</span></div></div>;
  if(active==="健康档案")return <div className="feature-wrap"><MemberSelector member={member} setMember={setMember}/><div className="archive-grid"><section className="card profile-card"><span>👩🏻</span><div><h2>{member}的健康档案</h2><p>资料按来源清晰标注，可随时更正与删除</p></div><button onClick={()=>setNotice("档案资料导出已准备")}>导出档案</button></section>{[["8月12日","血常规报告","医疗机构导入"],["8月10日","睡眠问题咨询","用户问答"],["8月08日","平均心率 72 次/分","设备同步"],["8月01日","阿莫西林用药记录","用户输入"]].map(x=><section className="timeline" key={x[1]}><time>{x[0]}</time><i/><div><b>{x[1]}</b><span>{x[2]}</span></div><button>查看 ›</button></section>)}</div></div>;
  if(active==="家庭管理")return <div className="feature-wrap"><div className="feature-hero"><span>♧</span><h2>照顾家人，也尊重每个人的隐私</h2><p>家庭成员之间默认数据隔离，新增成员与共享资料均需明确授权。</p></div><div className="family-cards">{members.map((m:string)=><section className="card" key={m}><span>{m==="我"?"👩🏻":m==="妈妈"?"👵🏻":"👴🏻"}</span><h3>{m}</h3><p>{m==="我"?"本人 · 完整管理权限":"家人 · 已授权健康管理"}</p><button onClick={()=>{setMember(m);setNotice(`已切换到${m}的健康档案`)}}>查看档案</button></section>)}<button className="add-member" onClick={()=>setNotice("已发起家庭成员授权邀请")}>＋<b>添加家庭成员</b><span>需对方同意或监护授权</span></button></div></div>;
  if(active==="健康目标")return <div className="feature-wrap"><div className="feature-hero"><span>◎</span><h2>小目标，也值得认真坚持</h2><p>你可以编辑计划、提醒时间和打卡方式，随时暂停。</p></div><section className="goal-detail card"><div className="goal-ring">{checked?"100":"68"}<small>%</small></div><div><h2>每日步行 8,000 步</h2><p>今天已完成 {checked?"8,000":"5,440"} 步 · 还差 {checked?"0":"2,560"} 步</p><div className="week-dots"><b>一</b><b>二</b><b>三</b><b>四</b><b>五</b><b>六</b><em>日</em></div></div><button className="primary" onClick={()=>{setChecked(!checked);setNotice(checked?"已取消今日打卡":"太棒了，今日目标已完成")}}>{checked?"取消打卡":"今日打卡"}</button></section><button className="new-goal" onClick={()=>setNotice("新目标模板已打开")}>＋ 创建新的健康目标</button></div>;
  return <div className="feature-wrap"><div className="feature-hero"><span>✚</span><h2>找到适合你的专业医疗服务</h2><p>展示提供方、费用和资料共享范围；预约、支付与共享资料前都由你最终确认。</p></div><div className="services">{[["🩺","在线问诊","最快 5 分钟接诊","图文咨询 ¥29 起"],["🤝","云陪诊","就医流程有人陪","服务前确认地区与费用"],["🏥","预约挂号","三甲医院号源查询","跳转前确认就诊人与资料"]].map(x=><section className="card" key={x[1]}><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p><small>{x[3]}</small><button className="primary" onClick={()=>setNotice(`已选择${x[1]}，下一步将确认服务与授权`)}>了解服务</button></section>)}</div><div className="safety-note">如出现胸痛、呼吸困难、意识障碍或严重出血等紧急情况，请立即联系当地急救电话或前往急诊。</div></div>
}

function MemberSelector({member,setMember}:any){return <div className="member-selector"><span>当前健康主体</span>{members.map(m=><button className={member===m?"selected":""} onClick={()=>setMember(m)} key={m}>{m}</button>)}<i>不同成员的数据不会混用</i></div>}
