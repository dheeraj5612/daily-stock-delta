'use strict';
const $=id=>document.getElementById(id);
let snapshot;
let editorial={};
const cardAnchors=new Map([...document.querySelectorAll('#ideas .idea[data-security-id]')].map(element=>[element.dataset.securityId,element.id]));
const dateLabel=date=>date?new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/New_York'}):'Awaiting first edition';
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function metricText(text){return text.replace(/(-?\d[\d,]*\.\d{2,})(\s*%)/g,(_,number,unit)=>`${Number(number.replaceAll(',','')).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})}${unit}`);}
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
if(typeof e.status==='string'&&e.status.trim())identity.append(node('span',e.status,'research-status'));
article.append(identity,node('p',metricText(e.thesis),'thesis'));
const details=node('details',undefined,'details');details.append(node('summary','More details'));
if(display.investmentThesis){const thesis=node('div',undefined,'investment-thesis');thesis.append(node('h4','Investment thesis'),node('p',metricText(display.investmentThesis)));details.append(thesis);}
const grid=node('div',undefined,'detail-grid');
for(const [title,value] of [['Catalyst',e.catalyst],['Risk / thesis breaker',e.risk],['Upside torque',e.torque]]){if(typeof value!=='string'||!value.trim())continue;const d=node('div');d.append(node('h4',title),node('p',metricText(value)));grid.append(d);}if(grid.children.length)details.append(grid);
const gaps=Array.isArray(e.gaps)?e.gaps.filter(value=>typeof value==='string'&&value.trim()):[];
if(gaps.length){const section=node('div',undefined,'research-gaps');section.append(node('h4','Open questions'));const list=node('ul');for(const gap of gaps)list.append(node('li',gap));section.append(list);details.append(section);}
const metrics=node('div',undefined,'metrics');for(const [title,key] of [['Weighted','weighted_upside_pct'],['Base case','base_upside_pct'],['Bull case','bull_upside_pct'],['Downside','downside_pct']]){if(!Number.isFinite(e[key]))continue;const metric=node('span',undefined,'metric');metric.append(node('span',title),node('strong',`${e[key]>0?'+':''}${e[key].toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})}%`));metrics.append(metric);}if(metrics.children.length)details.append(metrics);
const sources=node('div',undefined,'sources');for(const source of e.sources||[]){const a=sourceLink(source);if(a)sources.append(a);}if(sources.children.length)details.append(sources);
if(details.children.length>1)article.append(details);
return article;
}
function render(){
if(!snapshot)return;
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
function renderCoverage(data){
const gaps=Array.isArray(data?.coverage_gaps)?data.coverage_gaps.filter(value=>typeof value==='string'&&value.trim()):[];
const target=$('edition-gaps');
if(!target)return;
if(!gaps.length){target.replaceChildren();return;}
const details=node('details');details.append(node('summary','Research coverage'));
const list=node('ul');for(const gap of gaps)list.append(node('li',gap));
details.append(list);target.replaceChildren(details);
}
function unavailable(){
snapshot=undefined;
$('ideas').replaceChildren(node('p','This edition could not be loaded. Please refresh or visit the archive.','empty'));
$('edition-date').textContent='Edition unavailable';
$('edition-label').textContent='EDITION UNAVAILABLE';
$('edition-count').textContent='';
$('shown').textContent='';
$('edition-gaps')?.replaceChildren();
$('share').removeAttribute('href');
}
function validDate(value){
if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000-'))return false;
const parsed=new Date(`${value}T00:00:00Z`);
return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
async function load(date,editorialReady=Promise.resolve()){
let mismatched=false;
try{
const response=await fetch(date?`data/days/${date}.json`:'data/current.json',{cache:'no-store'});
if(!response.ok)throw new Error('Edition unavailable');
const data=await response.json();
if(date&&data?.date!==date){mismatched=true;throw new Error('Edition date mismatch');}
if(!data||!Array.isArray(data.equities))throw new Error('Invalid edition');
await editorialReady;
snapshot=data;
renderCoverage(snapshot);
$('edition-date').textContent=dateLabel(snapshot.date);
$('edition-label').textContent=date?'DATED EDITION':'LATEST EDITION';
$('edition-count').textContent=`${snapshot.equities.length} names`;
const u=snapshot.date?new URL(`editions/${snapshot.date}.html`,document.baseURI):new URL('./',document.baseURI);
$('share').href=`https://x.com/intent/tweet?${new URLSearchParams({text:`Daily Stock Delta${snapshot.date?` | ${dateLabel(snapshot.date)}`:''}: names and investment theses.`,url:u.href})}`;
render();
}catch{
const staticDate=document.documentElement.dataset.edition;
const explicit=new URLSearchParams(location.search).has('date');
if(!mismatched&&date&&staticDate===date)return;
if(!mismatched&&!date&&!explicit&&!staticDate&&$('ideas').querySelector('.idea'))return;
unavailable();
}
}
(async()=>{
const editorialRequest=fetch('data/editorial.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>{if(data?.schema_version===1&&data.editions)editorial=data;}).catch(()=>{});
const params=new URLSearchParams(location.search);
const explicit=params.has('date');
const requested=explicit?params.get('date'):document.documentElement.dataset.edition;
if((explicit&&params.getAll('date').length!==1)||(requested!==undefined&&requested!==null&&!validDate(requested))){unavailable();return;}
let index=null;
try{
const response=await fetch('data/index.json',{cache:'no-store'});
if(!response.ok)throw new Error('Index unavailable');
const data=await response.json();
if(!data||!Array.isArray(data.days))throw new Error('Invalid index');
index=data;
}catch{}
const date=requested||'';
if(index){
const dates=[...new Set(index.days.map(day=>day?.date).filter(validDate))].sort().reverse();
if(date&&!dates.includes(date)){unavailable();return;}
if(dates.length){
const wrapper=node('div',undefined,'edition-picker');
const label=node('label','Choose an edition');label.htmlFor='edition-picker';
const select=node('select');select.id='edition-picker';
for(const day of dates){const option=node('option',`${dateLabel(day)}${day===index.current_date?' (latest)':''}`);option.value=day;select.append(option);}
select.value=date||index.current_date;
select.addEventListener('change',()=>{const day=select.value;if(!dates.includes(day))return;location.assign(new URL(day===index.current_date?'./':`./?date=${day}`,document.baseURI).href);});
wrapper.append(label,select);$('share').before(wrapper);
}
}
await load(date,editorialRequest);
})();
$('search').addEventListener('input',render);
