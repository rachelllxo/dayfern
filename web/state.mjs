export const KINDS = ["Revision","Coding","Reading","Writing","Practice","Other"];
export const localDate = (d = new Date()) => [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
export const minuteOf = d => d.getHours()*60 + d.getMinutes();
export function initial(now=new Date()) {
  return {version:1, tasks:[], sessions:[], timer:null, settings:{date:localDate(now),start:minuteOf(now),available:90,block:30}};
}
export function rollDate(s, now=new Date()){
  if(s.settings.date!==localDate(now)){
    s.settings.date=localDate(now);
    // Preserve the preferred daily start across calendar days.
  }
}
export function stopTimer(s,now=Date.now()){
  if(!s.timer)return;
  if(now<s.timer.start)throw Error("The device clock moved backward. Check the clock and retry.");
  if(now>s.timer.start)s.sessions.push({id:s.timer.id,start:s.timer.start,end:now});
  s.timer=null;
}
export function startTimer(s,id,now=Date.now()){
  if(s.timer)throw Error("Pause the active timer first.");
  if(!s.tasks.some(t=>t.id===id&&t.state==="open"))throw Error("This task is no longer open.");
  s.timer={id,start:now};
}
export function payload(s,now=new Date()){
  const seconds=new Map();
  const add=(id,ms)=>seconds.set(id,(seconds.get(id)||0)+Math.max(0,ms)/1000);
  for(const it of s.sessions)add(it.id,it.end-it.start);
  if(s.timer)add(s.timer.id,now.valueOf()-s.timer.start);
  return {settings:{...s.settings,nowMinute:minuteOf(now)},tasks:s.tasks.map(t=>({...t,seconds:seconds.get(t.id)||0}))};
}
export function validateBackup(s,now=Date.now()){
  const fail=()=>{throw Error("Invalid planner backup. Existing data was preserved.")};
  if(s?.version!==1||!Array.isArray(s.tasks)||!Array.isArray(s.sessions)||s.sessions.length>50000||!s.settings)fail();
  const ids=new Map(s.tasks.map(t=>[t.id,t]));
  let end=0;
  for(const it of [...s.sessions].sort((a,b)=>a.start-b.start)){
    const task=ids.get(it.id);
    if(!task||!Number.isSafeInteger(it.start)||!Number.isSafeInteger(it.end)||it.start<task.created||it.start<end||it.end<=it.start||it.end>now||(task.state==="done"&&it.end>task.done))fail();
    end=it.end;
  }
  if(s.tasks.some(t=>t.created>now||(t.state==="done"&&t.done>now)))fail();
  if(s.timer!==null&&(!s.timer||ids.get(s.timer.id)?.state!=="open"||!Number.isSafeInteger(s.timer.start)||s.timer.start<Math.max(end,ids.get(s.timer.id).created)||s.timer.start>now))fail();
}
export function seed(){
  const s=initial();const base=new Date();base.setHours(0,0,0,0);
  function offset(n){const d=new Date(base);d.setDate(d.getDate()+n);return d}
  for(let i=0;i<23;i++){
    const d=offset(i-24);d.setHours(9);const created=d.valueOf(),est=[40,30,50][i%3];
    const id="sample-"+i, actual=Math.round(est*[1.45,.85,1.1][i%3])+(i%4);
    const start=created+3600000,end=start+actual*60000;
    s.tasks.push({id,title:["Practice binary search","Review image filtering","Draft literature notes"][i%3],subject:["Algorithms","Image processing","Research"][i%3],kind:["Coding","Revision","Writing"][i%3],estimate:est,priority:2,due:localDate(d),created,state:"done",done:end,pin:null});
    s.sessions.push({id,start,end});
  }
  ["Solve two sliding-window problems","Review Wiener filtering","Revise the survey introduction"].forEach((title,i)=>{
    s.tasks.push({id:"open-"+i,title,subject:["Algorithms","Image processing","Research"][i],kind:["Coding","Revision","Writing"][i],estimate:[45,30,45][i],priority:3-i,due:localDate(offset(i)),created:Date.now(),state:"open",pin:null});
  });
  return s;
}
