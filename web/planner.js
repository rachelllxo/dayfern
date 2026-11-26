import {KINDS,localDate,minuteOf,initial,rollDate,stopTimer,startTimer,payload,validateBackup,seed} from "./state.mjs";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const dur=n=>n<60?n+"m":Math.floor(n/60)+"h "+n%60+"m";
const names={estimate:"Your estimate",personal:"Personal correction",ridge:"Ridge regression"};
const key="dayfern.planner.v1";
let sample=false,demo=null,view="today",current,results,editing=null,seq=0,filter="open";
const notice=s=>$("#status").textContent=s;
function load(){
  if(sample)return structuredClone(demo);
  const raw=localStorage.getItem(key);
  return raw?JSON.parse(raw):initial();
}
async function write(fn){
  const operation=()=>{
    const next=load();rollDate(next);fn(next);
    if(sample)demo=next;else localStorage.setItem(key,JSON.stringify(next));
  };
  if(!sample&&navigator.locks)await navigator.locks.request(key,operation);else operation();
}
async function analyze(s){
  const res=await fetch("/api/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload(s))});
  const data=await res.json();if(!res.ok)throw Error(data.error||"Planner request failed.");return data;
}
function task(id){return current.tasks.find(t=>t.id===id)}
function btn(action,id,label){return '<button data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>'}
function forecast(t){
  const f=results.forecasts[t.id];
  if(!f)return "";
  return dur(f.minutes)+" forecast · "+names[f.method]+(f.method==="personal"?" from "+f.similar+" same-type tasks":"")+
    (f.method==="ridge"?" fitted on "+Math.min(results.history,96)+" completed tasks":"")+" · "+f.remaining+" min left"+(t.revision?" (revised)":"");
}
function tick(){
  if(!current)return;
  const timer=current.timer,t=timer&&task(timer.id);
  $("#active").textContent=t?t.title:"Ready to study";$("#pause").hidden=$("#finish").hidden=!timer;
  const sec=timer?Math.max(0,Math.floor((Date.now()-timer.start)/1000)):0;
  $("#clock").textContent=[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(x=>String(x).padStart(2,"0")).join(":");
}
function today(){
  const o=current.settings, title=id=>esc(task(id).title);
  const timeline=results.slots.map(s=>'<div class="item timeline"><span class="time">'+hm(s.start)+' – '+hm(s.end)+'</span><div><h3>'+title(s.id)+'</h3><p class="muted">'+(s.fixed?"Reserved session":"Deadline order")+' · '+(s.end-s.start)+' min</p>'+(!current.timer?btn("start",s.id,"Start focus"):"")+'</div></div>').join("");
  const deferred=Object.entries(results.deferred).map(([id,n])=>'<div class="item"><strong>'+title(id)+'</strong><p>'+n+' min unscheduled'+(results.conflicts.includes(id)?' · reservation conflicts with availability or another reservation':'')+'</p>'+btn("edit",id,"Adjust task")+'</div>').join("");
  return '<div class="grid"><div><section class="panel"><h2>Study schedule</h2><p>'+localDate()+' · '+results.slots.reduce((n,s)=>n+s.end-s.start,0)+' minutes scheduled</p>'+(timeline||'<p>Add a task and set your remaining availability to build a plan.</p>')+'</section>'+(deferred?'<section class="panel"><h2>Still to schedule</h2>'+deferred+'</section>':'')+'</div><section class="panel"><h2>Today’s availability</h2><p>Plan from the later of now or your start time. The window ends at your start time plus the available minutes, or midnight.</p><form id="prefs"><label>Start time<input name="start" type="time" value="'+hm(o.start)+'" required></label><label>Available minutes<input name="available" type="number" min="1" max="1440" value="'+o.available+'" required></label><label>Preferred session length (min)<input name="block" type="number" min="1" max="180" value="'+o.block+'" required></label><button>Update plan</button></form></section></div>';
}
function tasks(){
  const rows=current.tasks.filter(t=>t.state===filter).sort((a,b)=>a.due.localeCompare(b.due)||b.priority-a.priority);
  const controls=t=>{
    if(t.state!=="open")return "";
    return '<div class="actions">'+(!current.timer?btn("start",t.id,"Start / resume"):"")+btn("edit",t.id,"Edit")+btn("done",t.id,"Finish")+btn("abandon",t.id,"Abandon")+'</div>';
  };
  return '<section class="panel"><div class="split"><h2>Task list</h2><label>Status<select id="filter">'+["open","done","abandoned"].map(x=>'<option '+(filter===x?"selected":"")+'>'+x+'</option>').join("")+'</select></label></div>'+ (rows.map(t=>'<div class="item"><h3>'+esc(t.title)+'</h3><p>'+esc(t.subject)+' · '+esc(t.kind)+' · Due '+esc(t.due)+' · '+["","Low","Normal","High"][t.priority]+' priority</p><p class="muted">'+(t.state==="open"?forecast(t):"Original estimate "+dur(t.estimate))+(t.pin?" · Reserved "+esc(t.pin.date)+" at "+hm(t.pin.minute):"")+'</p>'+controls(t)+'</div>').join("")||'<p>No '+filter+' tasks.</p>')+'</section>';
}
function review(){
  const now=new Date(), days=[];
  for(let i=6;i>=0;i--){
    const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-i);
    const end=new Date(start);end.setDate(end.getDate()+1);
    const entries=current.timer?[...current.sessions,{...current.timer,end:now.valueOf()}]:current.sessions;
    const ms=entries.reduce((sum,e)=>sum+Math.max(0,Math.min(end,e.end)-Math.max(start,e.start)),0);
    days.push({start:start.valueOf(),label:start.toLocaleDateString(undefined,{weekday:"short"}),ms});
  }
  const complete=payload(current).tasks.filter(t=>t.state==="done"&&t.done>=days[0].start);
  const measured=complete.filter(t=>t.seconds>0);
  const max=Math.max(1,...days.map(d=>d.ms));
  const ev=results.evaluation,scores=Object.entries(ev.mae).map(([k,v])=>'<tr><td>'+names[k]+'</td><td>'+v+' min</td></tr>').join("");
  const kinds=KINDS.map(k=>{
    const group=measured.filter(t=>t.kind===k);if(!group.length)return "";
    const avg=group.reduce((s,t)=>s+t.seconds/60-t.estimate,0)/group.length;
    return '<tr><td>'+k+'</td><td>'+group.length+'</td><td>'+Math.abs(avg).toFixed(1)+' min '+(avg>=0?'over':'under')+' estimate</td></tr>';
  }).join("");
  return '<div class="grid"><section class="panel"><h2>Last seven days</h2><p><b class="num">'+dur(Math.round(days.reduce((s,d)=>s+d.ms,0)/60000))+'</b> active focus · '+complete.length+' tasks finished</p><div class="bars">'+days.map(d=>'<div style="height:'+Math.max(2,Math.round(d.ms/max*90))+'px" title="'+d.label+' · '+Math.round(d.ms/60000)+' min"></div>').join("")+'</div><div class="days">'+days.map(d=>'<span>'+d.label+'</span>').join("")+'</div><p>For '+measured.length+' measured tasks finished this week: '+dur(measured.reduce((s,t)=>s+t.estimate,0))+' estimated, '+dur(Math.round(measured.reduce((s,t)=>s+t.seconds,0)/60))+' tracked across their sessions.</p>'+(kinds?'<table><tr><th>Type</th><th>Tasks</th><th>Average difference</th></tr>'+kinds+'</table>':'')+'</section><section class="panel"><h2>Prediction accuracy</h2><p>'+results.history+' completed tasks with tracked time. Evaluated on '+ev.count+' later tasks.</p>'+(scores?'<table><tr><th>Method</th><th>Mean absolute error</th></tr>'+scores+'</table>':'<p>Each evaluation task needs 12 measured tasks completed before its creation.</p>')+'<p>'+(ev.winner?'Selected method: '+names[ev.winner]+'.':'After five eligible comparisons, the method with lowest observed error is selected.')+'</p></section></div><section class="panel"><h2>Planner backup</h2><p>Export tasks, session history and availability. Export pauses the timer in the backup copy. Import replaces the current planner after validation. Wellbeing has its own export.</p><div class="actions"><button id="export">Export planner</button><button id="import">Restore planner</button></div></section>';
}
async function render(){
  const id=++seq;
  try{
    current=load();rollDate(current);tick();$("#mode").textContent=sample?"SAMPLE WORKSPACE":"PERSONAL WORKSPACE";
    $("#title").textContent={today:"Today’s plan",tasks:"Study tasks",review:"Weekly review"}[view];
    $("#demo").textContent=sample?"Back to my planner":"Explore sample";
    document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-current",b.dataset.view===view?"page":"false"));
    const response=await analyze(current);if(id!==seq)return;
    results=response;$("#content").innerHTML=({today,tasks,review}[view])();
  }catch(err){if(id===seq){notice(err.message);$("#content").innerHTML='<section class="panel"><h2>Planner unavailable</h2><button id="retry">Retry</button></section>'}}
}
const form=$("#taskform");
form.elements.kind.innerHTML=KINDS.map(k=>'<option>'+k+'</option>').join("");
function edit(t){
  form.reset();editing=t?.id||null;$("#formerror").textContent="";$("#dialogtitle").textContent=t?"Edit task":"Add task";
  const fields=form.elements;
  $("#remainingLabel").hidden=!t;fields.timeLeft.value=t?.revision?Math.max(1,Math.ceil(t.revision.minutes-(payload(current).tasks.find(r=>r.id===t.id).seconds-t.revision.atSeconds)/60)):"";
  for(const k of ["title","subject","kind","estimate","due","priority"]){if(t)fields[k].value=t[k]}
  if(!t)fields.due.value=localDate();
  for(const k of ["estimate","kind","subject"])fields[k].disabled=Boolean(t);
  fields.pinDate.value=t?.pin?.date||"";fields.pinTime.value=t?.pin?hm(t.pin.minute):"";
  $("#editor").showModal();
}
const minute=s=>{const [h,m]=s.split(":").map(Number);return h*60+m};
function mutate(fn){
  return write(fn).then(render).catch(err=>notice(err.message));
}
form.onsubmit=async e=>{
  e.preventDefault();const f=form.elements;
  try{
    if(!f.title.value.trim()||!f.subject.value.trim())throw Error("Enter a task name and subject.");
    if(Boolean(f.pinDate.value)!==Boolean(f.pinTime.value))throw Error("Set both reservation fields or clear both.");
    const patch={title:f.title.value.trim(),due:f.due.value,priority:+f.priority.value,pin:f.pinDate.value?{date:f.pinDate.value,minute:minute(f.pinTime.value)}:null};
    await write(s=>{
      if(editing){const t=s.tasks.find(t=>t.id===editing&&t.state==="open");if(!t)throw Error("Task no longer open.");const seconds=payload(s).tasks.find(r=>r.id===t.id).seconds;t.revision=f.timeLeft.value?{minutes:+f.timeLeft.value,atSeconds:seconds}:null;Object.assign(t,patch)}
      else{
        if(s.tasks.length>=1000)throw Error("Planner limit is 1,000 tasks.");
        s.tasks.push({...patch,id:crypto.randomUUID(),subject:f.subject.value.trim(),kind:f.kind.value,estimate:+f.estimate.value,created:Date.now(),state:"open"});
      }
    });$("#editor").close();await render();
  }catch(err){$("#formerror").textContent=err.message}
};
function complete(id,state){
  if(!confirm(state==="done"?"Mark this task complete?":"Abandon this task and keep its session history?"))return;
  return mutate(s=>{
    const t=s.tasks.find(t=>t.id===id&&t.state==="open");if(!t)throw Error("Task already closed.");
    const now=Date.now();if(s.timer?.id===id)stopTimer(s,now);t.state=state;t.done=now;
  });
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.view){view=b.dataset.view;notice("");return render()}
  if(b.id==="cancel")return $("#editor").close();
  if(b.id==="new")return edit();
  if(b.id==="retry")return render();
  if(b.id==="demo"){sample=!sample;if(sample&&!demo)demo=seed();notice("");return render()}
  if(b.id==="pause")return mutate(s=>stopTimer(s));
  if(b.id==="finish"&&current.timer)return complete(current.timer.id,"done");
  const id=b.dataset.id;
  if(b.dataset.action==="edit")return edit(task(id));
  if(b.dataset.action==="start")return mutate(s=>startTimer(s,id));
  if(b.dataset.action==="done")return complete(id,"done");
  if(b.dataset.action==="abandon")return complete(id,"abandoned");
  if(b.id==="export"){
    try{
      const copy=load();stopTimer(copy);const url=URL.createObjectURL(new Blob([JSON.stringify(copy)],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download=sample?"dayfern-sample-planner.json":"dayfern-planner.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
    }catch(err){notice(err.message)}
  }
  if(b.id==="import")$("#upload").click();
});
document.addEventListener("submit",e=>{
  if(e.target.id!=="prefs")return;
  e.preventDefault();const f=e.target.elements;
  mutate(s=>{s.settings={date:localDate(),start:minute(f.start.value),available:+f.available.value,block:+f.block.value}});
});
document.addEventListener("change",async e=>{
  if(e.target.id==="filter"){filter=e.target.value;return render()}
  if(e.target.id!=="upload"||!e.target.files.length)return;
  try{
    const file=e.target.files[0];if(file.size>6000000)throw Error("Choose a backup smaller than 6 MB.");
    const incoming=JSON.parse(await file.text());validateBackup(incoming);await analyze(incoming);
    if(confirm("Replace this planner with the selected backup?")){
      await write(s=>Object.assign(s,incoming));await render();notice("Planner restored.");
    }
  }catch(err){notice(err.message)}finally{e.target.value=""}
});
window.addEventListener("storage",e=>{if(e.key===key&&!sample)render()});
setInterval(tick,1000);
setInterval(()=>{if(view==="today"&&!$("#editor").open&&!document.activeElement?.closest("#prefs")&&!document.hidden)render()},60000);
render();
