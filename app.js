'use strict';
const $=id=>document.getElementById(id);
let snapshot;
let editorial={};
const cardAnchors=new Map([...document.querySelectorAll('#ideas .idea[data-security-id]')].map(element=>[element.dataset.securityId,element.id]));
const dateLabel=date=>date?new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'}):'Awaiting first edition';
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function sourceLink(source){try{const u=new URL(source.url);if(!['https:','http:'].includes(u.protocol))return null;const a=node('a',source.label||u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a;}catch{return null;}}
function presentation(e){
const override=editorial.editions?.[snapshot?.date]?.[e.security_id]||{};
const choose=(...values)=>values.find(value=>typeof value==='string'&&value.trim())||'';
const company=choose(e.english_company,override.english_company,e.company);
const native=choose(e.native_company,override.native_company,e.company);
return {company,native:native!==company?native:'',investmentThesis:choose(e.investment_thesis,override.investment_thesis,e.thesis)};
}
function card(e){
const article=node('article',undefined,'idea');
article.dataset.securityId=e.security_id;
if(cardAnchors.has(e.security_id))article.id=cardAnchors.get(e.security_id);
const identity=node('div',undefined,'identity');
const display=presentation(e);
identity.append(node('h3',display.company),node('span',e.ticker,'ticker'));
if(display.native)identity.append(node('span',display.native,'native-company'));
article.append(identity,node('p',e.thesis,'thesis'));
const details=node('details',undefined,'details');details.append(node('summary','More details'));
if(display.investmentThesis){const thesis=node('div',undefined,'investment-thesis');thesis.append(node('h4','Investment thesis'),node('p',display.investmentThesis));details.append(thesis);}
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
const rows=all.filter(e=>{const display=presentation(e);return [e.ticker,e.company,display.company,display.native,e.thesis,display.investmentThesis].some(v=>String(v||'').toLowerCase().includes(q));}).sort((a,b)=>a.rank-b.rank);
const expanded=new Set([...$('ideas').querySelectorAll('.idea')].filter(element=>element.querySelector('details[open]')).map(element=>element.dataset.securityId));
const cards=rows.map(card);
for(const element of cards){if(expanded.has(element.dataset.securityId)){const details=element.querySelector('details');if(details)details.open=true;}}
$('ideas').replaceChildren(...cards);
if(!rows.length)$('ideas').append(node('p',q?'No names match your search.':'No names in this edition.','empty'));
$('shown').textContent=`${rows.length} of ${all.length} names`;
}
async function load(date,editorialReady=Promise.resolve()){
try{
const response=await fetch(date?`data/days/${date}.json`:'data/current.json',{cache:'no-store'});
if(!response.ok)throw new Error('Edition unavailable');
const data=await response.json();
await editorialReady;
snapshot=data;
$('edition-date').textContent=dateLabel(snapshot.date);
$('edition-label').textContent=date?'DATED EDITION':'LATEST EDITION';
$('edition-count').textContent=`${snapshot.equities.length} names`;
const u=snapshot.date?new URL(`editions/${snapshot.date}.html`,document.baseURI):new URL('./',document.baseURI);
$('share').href=`https://x.com/intent/tweet?${new URLSearchParams({text:`Daily Stock Delta${snapshot.date?` | ${dateLabel(snapshot.date)}`:''}: names and investment theses.`,url:u.href})}`;
render();
}catch{
if($('ideas').querySelector('.idea')&&!new URLSearchParams(location.search).get('date'))return;
$('ideas').replaceChildren(node('p','This edition could not be loaded. Please refresh or visit the archive.','empty'));
$('edition-date').textContent='Edition unavailable';
$('edition-count').textContent='';
}
}
(async()=>{
const editorialRequest=fetch('data/editorial.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>{if(data?.schema_version===1&&data.editions)editorial=data;}).catch(()=>{});
const requested=new URLSearchParams(location.search).get('date')||document.documentElement.dataset.edition;
let date='';
if(requested&&/^\d{4}-\d{2}-\d{2}$/.test(requested)){
try{const response=await fetch('data/index.json',{cache:'no-store'});if(response.ok){const index=await response.json();if((index.days||[]).some(day=>day.date===requested))date=requested;}}catch{}
}
await load(date,editorialRequest);
})();
$('search').addEventListener('input',render);
