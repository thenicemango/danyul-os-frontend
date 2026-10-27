/* Persistent research and commitments within Operations Mode; never executes outreach. */
(()=>{'use strict';
const cfg=window.DANYUL_CLOUD_CONFIG||{},base=String(cfg.supabaseUrl||'').replace(/\/$/,''),pub=String(cfg.publishableKey||'');
const SESSION='danyul-cloud-session-v2';
const today='2026-11-14';
let last='',busy=false;
const node=(tag,text)=>{let e=document.createElement(tag);e.textContent=text||'';return e};
const isReady=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)&&pub.length>15;
function auth(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}}
async function request(path,method='GET',data){let ses=auth();if(!ses?.access_token)throw Error('Sign in using the Cloud panel first');if(!isReady())throw Error('Cloud not configured');
 const res=await fetch(base+path,{method,headers:{apikey:pub,Authorization:'Bearer '+ses.access_token,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const txt=await res.text();let parsed;try{parsed=JSON.parse(txt)}catch{parsed=txt};if(!res.ok)throw Error(parsed?.message||parsed?.error||'HTTP '+res.status);return parsed;
}
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null}catch{return null}}
function itemRow(title,description){const p=node('div');p.className='entry';p.append(node('strong',title),node('p',description));return p}
async function paint(){const root=document.getElementById('connected-feed-content');if(!root||busy)return;busy=true;
 try{
  if(!isReady()){root.replaceChildren(node('p','Cloud not configured yet. November 14: Kulak’s Woodshed performance (confirmed by DANYUL). No automated research import is active until deployment.'));return}
  if(!auth()?.access_token){root.replaceChildren(node('p','Sign in through the Cloud panel. Once deployed, show commitments and worker research appear here automatically; no new HTML downloads.'));return}
  const [events,leads]=await Promise.all([
    request('/rest/v1/artist_commitments?select=id,title,venue,event_date,status,notes&order=event_date.asc&limit=30'),
    request('/rest/v1/research_opportunities?select=id,title,category,source_name,source_url,summary,status,verification,detected_at&order=detected_at.desc&limit=40')
  ]);
  const box=node('div');const known=events.some(x=>x.event_date===today&&/kulak/i.test(x.venue||''));
  if(!known){const warning=itemRow('Known commitment not yet in cloud','DANYUL confirmed a performance at Kulak’s Woodshed on November 14, 2026. Save this existing show to the shared database so research workers can suppress duplicate pitches.');const b=node('button','Save confirmed booking to cloud');b.type='button';b.onclick=async()=>{b.disabled=true;try{await request('/rest/v1/rpc/record_confirmed_kulaks','POST',{});await paintForce()}catch(e){alert(e.message);b.disabled=false}};warning.append(b);box.append(warning)}
  box.append(node('h3',`Confirmed commitments (${events.filter(x=>x.status==='confirmed').length})`));
  for(const x of events.filter(x=>x.status==='confirmed').slice(0,5))box.append(itemRow(x.event_date+' · '+x.title,x.venue+' · '+(x.notes||'Details pending verification')));
  const pending=leads.filter(x=>x.status==='pending_review');box.append(node('h3',`Research suggestions awaiting review (${pending.length})`));
  if(!pending.length)box.append(node('p','No pending leads currently recorded. The private weekly GitHub Actions worker writes here after it is configured and run.'));
  for(const x of pending.slice(0,12)){
    const r=itemRow(x.title,`${x.source_name} · ${x.category} · ${x.verification}. ${x.summary||''}`);
    const url=safeLink(x.source_url);if(url){let a=node('a','Check source');a.href=url;a.target='_blank';a.rel='noopener noreferrer';r.append(a)}
    for(const [status,label] of [['reviewed','Mark reviewed'],['dismissed','Dismiss']]){let b=node('button',label);b.type='button';b.onclick=async()=>{b.disabled=true;try{await request('/rest/v1/rpc/triage_research_opportunity','POST',{p_opportunity_id:x.id,p_status:status});await paintForce()}catch(e){alert(e.message);b.disabled=false}};r.append(b)}
    box.append(r)
  }
  box.append(node('p','Reviewing or dismissing a research suggestion does not contact anyone, submit applications, or approve spending. ChatGPT scheduled summaries are not automatically sent to this database.'));
  root.replaceChildren(box);
 }catch(e){root.replaceChildren(node('p','Research sync unavailable: '+e.message+'. No data was overwritten.'))}finally{busy=false}
}
async function paintForce(){busy=false;await paint()}
let refreshAt=0;
const observer=new MutationObserver(()=>{const root=document.getElementById('connected-feed-content');if(root&&Date.now()-refreshAt>12000){refreshAt=Date.now();paint()}});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint()});
setInterval(()=>{if(!document.hidden&&document.getElementById('connected-feed-content'))paint()},60000);
paint();
window.DANYUL_CONNECTED={refresh:paintForce};
})();
