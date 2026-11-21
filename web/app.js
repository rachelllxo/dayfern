"use strict";
const $ = selector => document.querySelector(selector);
const paths = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book:'<path d="M4 4h13a2 2 0 0 1 2 2v15H6a2 2 0 0 1-2-2zm0 14a2 2 0 0 1 2-2h13M8 8h7"/>',
  spark:'<path d="m10 3 1.9 5.8L18 11l-6.1 2.2L10 19l-2-5.8L2 11l6-2.2zM19 2l.9 2.1L22 5l-2.1.9L19 8l-.9-2.1L16 5l2.1-.9z"/>',
  screen:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  focus:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  pickups:'<path d="M8 20h8M7 17h10l-1-6a4 4 0 0 0-8 0zM4 6l2 2m14-2-2 2"/>',
  mood:'<circle cx="12" cy="12" r="9"/><path d="M8 14q4 5 8 0M8 9h1m6 0h1"/>',
  leaf:'<path d="M4 20c0-12 9-9 15-16 2 12-4 16-12 14m-3 3 11-11"/>'
};
function icon(key){return '<i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+paths[key]+'</svg></i>'}
document.querySelectorAll('[data-icon]').forEach(n=>n.outerHTML=icon(n.dataset.icon));
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dayAgo(n){const d=new Date();d.setDate(d.getDate()-n);return iso(d)}
const displayDate=(s,options)=>new Date(s+'T12:00:00').toLocaleDateString('en-US',options);
const minutes=value=>{const n=Math.round(value);return n>=60?Math.floor(n/60)+'h '+(n%60)+'m':n+'m'};
const demo=Array.from({length:30},(_,i)=>{
  const s=[228,197,170,241,156,187,146,213,195,166][i%10]+(i%3)*3;
  return {date:dayAgo(29-i),screen:s,focus:Math.round(146-s*.36)+(i%4)*4,pickups:Math.round(s*.24)+i%6,mood:[4,3,4,3,5,4,5][i%7]};
});
const key='dayfern.journal.v1';
let personal=[], sample=true, storageIssue='', page='Overview', period=7, version=0, editing=null;
try{
  const saved=localStorage.getItem(key);
  if(saved){personal=JSON.parse(saved);if(!Array.isArray(personal))throw Error();sample=false}
}catch{storageIssue='Your saved journal could not be opened. Check browser storage before saving.'}
function notice(s){$('#message').textContent=s}
function selected(){return (sample?demo:personal).filter(r=>r.date>=dayAgo(period-1)&&r.date<=dayAgo(0)).sort((a,b)=>a.date.localeCompare(b.date))}
async function analyze(rows){
  const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rows)});
  if(!res.ok)throw Error('Analysis failed. Check the entries and try again.');
  return res.json();
}
const range=()=>'<select class="select" id="period" aria-label="Analysis period">'+[7,14,30].map(n=>'<option value="'+n+'" '+(n===period?'selected':'')+'>Last '+n+' days</option>').join('')+'</select>';
function chart(rows){
  if(!rows.length)return '<p class="empty">Your activity chart will appear after your first check-in.</p>';
  const w=600,h=176,L=41,R=17,T=15,B=34;
  const max=Math.max(120,Math.ceil(Math.max(...rows.map(r=>Math.max(r.screen,r.focus)))/120)*120);
  const xs=i=>L+i*(w-L-R)/(period-1),ys=v=>h-B-v/max*(h-T-B);
  const byDate=new Map(rows.map(r=>[r.date,r]));
  const days=Array.from({length:period},(_,i)=>dayAgo(period-1-i));
  let markup='';
  for(let j=0;j<=4;j++){
    let v=max*j/4,y=ys(v);markup+='<path d="M'+L+' '+y+'H'+(w-R)+'" stroke="#e1e7dd" stroke-dasharray="4 4"/><text x="2" y="'+(y+4)+'">'+v/60+'h</text>';
  }
  days.forEach((day,i)=>{if(i===0||i===period-1||i%Math.ceil(period/7)===0&&i<period-2)markup+='<text x="'+xs(i)+'" y="'+(h-6)+'" text-anchor="middle">'+displayDate(day,period===7?{weekday:'short'}:{day:'numeric',month:'short'})+'</text>'});
  for(const [k,color] of [['screen','#57835e'],['focus','#c89a4b']]){
    let line='',dots='',previous=false;
    days.forEach((day,i)=>{
      const r=byDate.get(day);if(!r){previous=false;return}
      const x=xs(i),y=ys(r[k]);line+=(previous?' L':' M')+x+' '+y;previous=true;
      dots+='<circle cx="'+x+'" cy="'+y+'" r="3.4" fill="'+color+'"><title>'+day+' · '+k+' '+minutes(r[k])+'</title></circle>';
    });
    markup+='<path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linejoin="round"/>'+dots;
  }
  return '<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily screen time and focus time in hours. Exact values are in the check-in journal.">'+markup+'</svg>';
}
function insight(data){
  if(!data.pattern)return ['Finding your rhythm',data.count<6?'Log at least six days in this period to look for recurring routines.':'These check-ins do not yet form two recurring groups. Keep logging to see what emerges.'];
  const [low,high]=data.pattern,delta=low.focus-high.focus;
  if(Math.abs(delta)>=5)return [delta>0?'More focus on lighter days':'More focus on busier days','The '+(delta>0?'lower':'higher')+'-screen group averaged '+Math.abs(delta)+' more minutes of focus than the other group.'];
  return ['Two screen-time routines','Your two groups averaged '+minutes(low.screen)+' and '+minutes(high.screen)+' of screen time per day.'];
}
function overview(rows,data){
  const vals=data.averages;
  const cards=[['screen','Screen time','',minutes],['focus','Focus time','sun',minutes],['pickups','Phone pickups','lilac',v=>String(Math.round(v))],['mood','Mood','blue',v=>v.toFixed(1)+' / 5']];
  const [headline,detail]=insight(data);
  return '<section class="hero"><div><div class="tag">'+icon('leaf')+' FIELD NOTES</div><h2>Your digital rhythm</h2><p>'+ (data.count?'A snapshot of your screen habits, focus, and mood across '+data.count+' logged '+(data.count===1?'day.':'days.'):'Your daily check-ins grow into a picture of how you spend your time.')+'</p></div></section>'+
    '<div class="sectionhead"><h2 class="sectitle">At a glance</h2>'+range()+'</div><div class="metrics">'+cards.map(([k,label,c,format])=>'<article class="card"><div class="row"><span class="tile '+c+'">'+icon(k)+'</span>'+label+'</div><strong>'+(data.count?format(vals[k]):'—')+'</strong><small>Daily average</small></article>').join('')+'</div>'+
    '<div class="lower"><section class="panel"><h2>Activity trends</h2><p class="sub">Screen and focus time by day</p><div class="legend"><span>Screen time</span><span>Focus time</span></div>'+chart(rows)+'</section><section class="panel insight"><div class="tag">'+icon('spark')+' PATTERN INSIGHT</div><h2>'+headline+'</h2><p>'+detail+'</p><button class="textbtn" data-go="Patterns">Explore patterns</button></section></div>';
}
function patterns(data){
  const [title,detail]=insight(data);
  const profiles=(data.pattern||[]).map((g,i)=>'<section class="panel"><div class="tag">'+icon('leaf')+' '+g.days+' LOGGED DAYS</div><h2 class="space">'+(i?'Higher':'Lower')+' screen-time days</h2><p class="space">'+minutes(g.screen)+' screen time · '+minutes(g.focus)+' focus · '+g.pickups+' pickups on average</p></section>').join('');
  return '<div class="sectionhead"><h2 class="sectitle">Routine discovery</h2>'+range()+'</div><section class="panel insight"><div class="tag">'+icon('spark')+' PATTERN INSIGHT</div><h2>'+title+'</h2><p>'+detail+'</p></section><div class="lower">'+profiles+'</div><section class="panel space"><h2>How patterns are found</h2><p class="space">Dayfern uses k-means to group days with similar screen time, focus time, and phone pickups. Each measure is standardized first. A pattern appears when at least six days are logged and each group contains two or more days. Group averages describe your entries and cannot establish cause and effect.</p></section>';
}
function journal(){
  const rows=[...(sample?demo:personal)].sort((a,b)=>b.date.localeCompare(a.date));
  return '<div class="sectionhead"><h2 class="sectitle">Daily entries <small class="small">('+rows.length+')</small></h2><div class="actions"><button class="textbtn" id="export">Export JSON</button><button class="textbtn" id="import">Import journal</button><input hidden type="file" id="file" accept=".json,application/json"></div></div><section class="panel tablewrap">'+(rows.length?'<table><thead><tr><th>Date</th><th>Screen</th><th>Focus</th><th>Pickups</th><th>Mood</th>'+(!sample?'<th>Actions</th>':'')+'</tr></thead><tbody>'+rows.map(r=>'<tr><td>'+displayDate(r.date,{month:'short',day:'numeric',year:'numeric'})+'</td><td>'+minutes(r.screen)+'</td><td>'+minutes(r.focus)+'</td><td>'+r.pickups+'</td><td>'+r.mood+' / 5</td>'+(!sample?'<td><button data-edit="'+r.date+'">Edit</button><button data-delete="'+r.date+'">Delete</button></td>':'')+'</tr>').join('')+'</tbody></table>':'<h2>Your journal is ready</h2><p class="empty">Add your first check-in to begin tracking daily habits.</p>')+'</section>';
}
async function render(){
  const id=++version;
  $('#crumb').textContent=page;
  $('#title').textContent={Overview:'Wellbeing overview',Patterns:'Your patterns',Journal:'Check-in journal'}[page];
  $('#stamp').textContent=displayDate(dayAgo(0),{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
  $('#switch').textContent=sample?'Sample journal · Switch to mine':'My journal · View sample';
  document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false')});
  if(page==='Journal'){$('#view').innerHTML=journal();return}
  try{
    const rows=selected(),data=await analyze(rows);
    if(id===version)$('#view').innerHTML=page==='Overview'?overview(rows,data):patterns(data);
  }catch{if(id===version)$('#view').innerHTML='<div class="panel"><h2>Analysis unavailable</h2><p>Check your connection and try again.</p><button class="textbtn" id="retry">Retry</button></div>'}
}
function persist(next){
  if(storageIssue)throw Error(storageIssue);
  localStorage.setItem(key,JSON.stringify(next));personal=next;sample=false;
}
function openForm(date){
  const form=$('#form');form.reset();editing=date||null;
  const r=date?personal.find(r=>r.date===date):{date:dayAgo(0)};
  Object.entries(r).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});
  form.elements.date.max=dayAgo(0);form.elements.date.readOnly=Boolean(date);
  $('#formtitle').textContent=date?'Edit check-in':'Add a personal check-in';$('#formerror').textContent='';$('#entry').showModal();
}
$('#form').onsubmit=async event=>{
  event.preventDefault();const f=new FormData(event.target);
  const row=Object.fromEntries([...f].map(([k,v])=>[k,k==='date'?v:Number(v)]));
  if(!editing&&personal.some(r=>r.date===row.date)){$('#formerror').textContent='A check-in already exists for this date. Edit it in your journal.';return}
  try{
    const next=personal.filter(r=>r.date!==editing).concat(row);
    await analyze(next);persist(next);$('#entry').close();notice('Check-in saved to your journal.');render();
  }catch(e){$('#formerror').textContent=e.message}
};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.page||b.dataset.go){page=b.dataset.page||b.dataset.go;notice('');render()}
  if(b.id==='switch'){sample=!sample;notice('');render()}
  if(b.id==='retry')render();
  if(b.id==='add'||b.dataset.edit)openForm(b.dataset.edit);
  if(b.classList.contains('close'))$('#entry').close();
  if(b.dataset.delete&&confirm('Delete the check-in for '+b.dataset.delete+'?')){
    try{persist(personal.filter(r=>r.date!==b.dataset.delete));render()}catch(err){notice(err.message)}
  }
  if(b.id==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(sample?demo:personal,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=sample?'dayfern-sample.json':'dayfern-journal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(b.id==='import')$('#file').click();
});
document.addEventListener('change',async e=>{
  if(e.target.id==='period'){period=Number(e.target.value);render()}
  if(e.target.id==='file'&&e.target.files.length){
    try{
      const file=e.target.files[0];if(file.size>600000)throw Error('Choose a journal smaller than 600 KB.');
      const incoming=JSON.parse(await file.text());await analyze(incoming);
      const merged=new Map(personal.map(r=>[r.date,r]));
      for(const r of incoming){
        if(r.date>dayAgo(0))throw Error('Future check-ins cannot be imported.');
        if(merged.has(r.date))throw Error('Import stopped. Your journal already contains '+r.date+'.');
        merged.set(r.date,Object.fromEntries(['date','screen','focus','pickups','mood'].map(k=>[k,r[k]])));
      }
      const next=[...merged.values()];await analyze(next);persist(next);notice(incoming.length+' check-ins imported.');render();
    }catch(err){notice(err.message)}finally{e.target.value=''}
  }
});
window.addEventListener('storage',e=>{if(e.key===key)location.reload()});
notice(storageIssue);render();
