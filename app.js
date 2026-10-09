'use strict';
const $=id=>document.getElementById(id);
let snapshot;
const dateLabel=date=>date?new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'}):'Awaiting first edition';
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function sourceLink(source){try{const u=new URL(source.url);if(!['https:','http:'].includes(u.protocol))return null;const a=node('a',source.label||u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}}
function card(e){
const article=node('article',undefined,'idea');
const identity=node('div',undefined,'identity');
identity.append(node('h3',e.company),node('span',e.ticker,'ticker'));
article.append(identity,node('p',e.thesis,'thesis'));
const details=node('details',undefined,'details');details.append(node('summary','More details'));
const grid=node('div',undefined,'detail-grid');
for(const [title,value] of [['Catalyst',e.catalyst],['Risk / thesis breaker',e.risk],['Upside torque',e.torque]]){if(typeof value!=='string'||!value.trim())continue;const d=node('div');d.append(node('h4',title),node('p',value));grid.append(d);}if(grid.children.length)details.append(grid);
const metrics=node('div',undefined,'metrics');for(const [title,key] of [['Weighted','weighted_upside_pct'],['Base case','base_upside_pct'],['Bull case','bull_upside_pct'],['Downside','downside_pct']]){if(!Number.isFinite(e[key]))continue;const metric=node('span',undefined,'metric');metric.append(node('span',title),node('strong',`${e[key]>0?'+':''}${e[key].toLocaleString('en-US',{maximumFractionDigits:1})}%`));metrics.append(metric);}if(metrics.children.length)details.append(metrics);
const sources=node('div',undefined,'sources');for(const source of e.sources||[]){const a=sourceLink(source);if(a)sources.append(a);}if(sources.children.length)details.append(sources);
if(details.children.length>1)article.append(details);
return article;
}
function render(){
const q=$('search').value.trim().toLowerCase();
const all=snapshot?.equities||[];
const rows=all.filter(e=>[e.ticker,e.company,e.thesis].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>a.rank-b.rank);
$('ideas').replaceChildren(...rows.map(card));
if(!rows.length)$('ideas').append(node('p',q?'No names match your search.':'No names in this edition.','empty'));
$('shown').textContent=`${rows.length} of ${all.length} names`;
}
async function load(date){
try{
const response=await fetch(date?`data/days/${date}.json`:'data/current.json',{cache:'no-store'});
if(!response.ok)throw new Error('Edition unavailable');
snapshot=await response.json();
$('edition-date').textContent=dateLabel(snapshot.date);
$('edition-label').textContent=date?'DATED EDITION':'LATEST EDITION';
$('edition-count').textContent=`${snapshot.equities.length} names`;
const u=new URL(location.href);
if(snapshot.date)u.searchParams.set('date',snapshot.date);else u.search='';
$('share').href=`https://x.com/intent/tweet?${new URLSearchParams({text:`Daily Stock Delta${snapshot.date?` | ${dateLabel(snapshot.date)}`:''}: names and investment theses.`,url:u.href})}`;
render();
}catch{
$('ideas').replaceChildren(node('p','This edition could not be loaded. Please refresh or visit the archive.','empty'));
$('edition-date').textContent='Edition unavailable';
$('edition-count').textContent='';
}
}
(async()=>{
const requested=new URLSearchParams(location.search).get('date');
let date='';
if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)){
try{const response=await fetch('data/index.json',{cache:'no-store'});if(response.ok){const index=await response.json();if((index.days||[]).some(day=>day.date===requested))date=requested;}}catch{}
}
await load(date);
})();
$('search').addEventListener('input',render);
