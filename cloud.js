/* DANYUL OS Cloud Bridge v2 — dependency-free, opt-in Supabase Auth + REST + RPC. */
(()=>{'use strict';
const cfg=window.DANYUL_CLOUD_CONFIG||{};
const url=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const key=String(cfg.publishableKey||'');
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)&&key.length>15;
const SKEY='danyul-cloud-session-v2';
let session=null, revision=null, enabled=false, syncing=false, timer=null, dirty=false, cloudExists=false;
const el=(tag,props={},text='')=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='className')n.className=v;else n.setAttribute(k,v)}n.textContent=text;return n};
const panel=el('section',{id:'cloud-panel','aria-label':'Cloud sync controls'});
const style=el('style');style.textContent=`#cloud-panel{position:fixed;right:14px;bottom:14px;z-index:200;background:#171922;color:#f1f1f4;border:1px solid #4a4c59;border-radius:14px;box-shadow:0 10px 35px #0008;padding:12px;max-width:min(360px,calc(100vw - 28px));font:13px/1.5 system-ui,sans-serif}#cloud-panel button{background:#343648;color:#fff;border:1px solid #5c5d72;border-radius:8px;padding:7px 10px;margin:3px;cursor:pointer}#cloud-panel button:disabled{opacity:.4}#cloud-panel input{width:100%;background:#22242e;border:1px solid #5c5d72;color:white;padding:9px;border-radius:7px}#cloud-panel .cloud-row{display:flex;flex-wrap:wrap;gap:4px}#cloud-panel small{color:#b4b5c4;display:block;margin:4px 0}#cloud-panel .cloud-error{color:#ffb6a9}#cloud-panel strong{font-size:14px}#cloud-panel .cloud-collapse{float:right}`;document.head.append(style);document.body.append(panel);
function note(t,error=false){const n=panel.querySelector('#cloud-note');if(n){n.textContent=t;n.className=error?'cloud-error':''}}
function button(label,fn){let b=el('button',{},label);b.addEventListener('click',fn);return b}
function draw(){panel.replaceChildren();const head=el('div');head.append(el('strong',{},'☁ DANYUL Cloud'));head.append(button('− / +',()=>{let c=panel.querySelector('#cloud-body');c.hidden=!c.hidden}));panel.append(head);const body=el('div',{id:'cloud-body'});panel.append(body);
 if(!configured){body.append(el('small',{},'Local mode. Cloud is not configured. Your records remain in this browser.'));body.append(el('small',{},'Follow SETUP_CLOUD.md to enable private sync.'));return}

if (!session) {
  body.append(el('small', {}, 'Sign in with your DANYUL OS email and password.'));

  const emailInput = el('input', {
    type: 'email',
    placeholder: 'Email address',
    'aria-label': 'Email address'
  });
  const passwordInput = el('input', {
    type: 'password',
    placeholder: 'Password',
    'aria-label': 'Password'
  });

  body.append(emailInput, passwordInput);

  body.append(button('Sign in', async () => {
    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) throw Error('Enter your email and password');

      const result = await request(
        '/auth/v1/token?grant_type=password',
        { method: 'POST', body: { email, password } },
        false
      );

      session = {
        ...result,
        expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600)
      };

      passwordInput.value = '';
      saveSession();
      await initialize();
    } catch (error) {
      passwordInput.value = '';
      note(error.message, true);
    }
  }));
}
 else {body.append(el('small',{},'Signed in. Cloud storage is private to this account.'));body.append(el('small',{},enabled?'Sync enabled · revision '+revision:'Sync paused until you choose a starting copy.'));let row=el('div',{className:'cloud-row'});body.append(row);if(!enabled){if(cloudExists)row.append(button('Use cloud copy',useCloud));row.append(button('Upload this browser copy',uploadLocal));row.append(button('Download local backup',()=>window.DANYUL_OS.exportBackup()));}else{row.append(button('Sync now',()=>sync(true)));row.append(button('Pause sync',()=>{enabled=false;dirty=false;draw();note('Sync paused. Local changes stay in this browser.')}));}row.append(button('Sign out',signOut));}
 const n=el('small',{id:'cloud-note','role':'status'},'No cloud action pending.');body.append(n);
}
function headers(auth=true){const h={'apikey':key,'Content-Type':'application/json'};if(auth&&session)h.Authorization='Bearer '+session.access_token;else h.Authorization='Bearer '+key;return h}
async function request(path,opts={},auth=true){let res=await fetch(url+path,{method:opts.method||'GET',headers:{...headers(auth),...(opts.headers||{})},body:opts.body===undefined?undefined:JSON.stringify(opts.body)});let txt=await res.text(),data;try{data=txt?JSON.parse(txt):null}catch{data=txt}if(!res.ok)throw Error((data&&((data.message)||(data.error_description)||(data.error)))||('HTTP '+res.status));return data}
function saveSession(){if(session)sessionStorage.setItem(SKEY,JSON.stringify(session));else sessionStorage.removeItem(SKEY)}
async function refresh(){if(!session?.refresh_token)return false;try{const d=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}},false);session={...d,expires_at:Math.floor(Date.now()/1000)+Number(d.expires_in||3600)};saveSession();return true}catch{session=null;saveSession();return false}}
async function ensureAuth(){if(!session)throw Error('Sign in first');if(Date.now()/1000>(session.expires_at||0)-60){if(!await refresh())throw Error('Session expired. Sign in again.')}}
async function getRemote(){await ensureAuth();const user=await request('/auth/v1/user');if(!user?.id)throw Error('Unable to verify user');const rows=await request('/rest/v1/artist_states?select=state,revision&user_id=eq.'+encodeURIComponent(user.id),{headers:{Accept:'application/json'}});return Array.isArray(rows)&&rows.length?rows[0]:null}
async function initialize(){try{const r=await getRemote();cloudExists=!!r;revision=r?.revision??0;draw();note(r?'A cloud copy exists. Choose which copy to use.':'No cloud copy yet. Upload local data to start syncing.')}catch(e){draw();note('Cloud connection failed: '+e.message,true)}}
async function useCloud(){if(!confirm('Replace local browser data with your cloud copy? Download a local backup first if you need it.'))return;try{const r=await getRemote();if(!r)throw Error('No cloud copy found');window.DANYUL_OS.replaceState(r.state);revision=r.revision;cloudExists=true;enabled=true;dirty=false;draw();note('Cloud copy loaded. Automatic sync is enabled.')}catch(e){note(e.message,true)}}
async function uploadLocal(){if(!confirm('Upload this browser data as your cloud copy? Existing cloud data, if any, will be overwritten only after a revision check. Back up both copies first if needed.'))return;try{const r=await getRemote();revision=r?.revision??0;enabled=true;dirty=true;await sync(true);cloudExists=true;draw();note('Cloud copy saved. Automatic sync is enabled.')}catch(e){enabled=false;note('Upload failed: '+e.message,true)}}
async function sync(manual=false){if(!enabled||!session)return;if(syncing){dirty=true;return}syncing=true;dirty=false;try{await ensureAuth();const data=window.DANYUL_OS.getState();const response=await request('/rest/v1/rpc/save_artist_state',{method:'POST',body:{expected_revision:revision??0,new_state:data}});if(typeof response!=='number')throw Error('Unexpected sync response');revision=response;cloudExists=true;if(manual)note('Saved securely · revision '+revision)}catch(e){enabled=false;dirty=true;draw();note('Sync stopped to protect your data: '+e.message+'. Export a backup before resolving.',true)}finally{syncing=false;if(enabled&&dirty){dirty=false;queueSync()}}}
function queueSync(){if(!enabled)return;dirty=true;clearTimeout(timer);timer=setTimeout(()=>sync(false),1800)}
async function signOut(){enabled=false;clearTimeout(timer);try{if(session)await request('/auth/v1/logout',{method:'POST'})}catch{}session=null;revision=null;cloudExists=false;saveSession();draw();note('Signed out. Local records remain on this device.')}
async function boot(){draw();if(!configured)return;try{const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('access_token')&&hash.has('refresh_token')){session={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)};saveSession();history.replaceState(null,'',location.pathname+location.search)}else{try{session=JSON.parse(sessionStorage.getItem(SKEY)||'null')}catch{session=null}}if(session){await ensureAuth();await initialize()}}catch(e){session=null;saveSession();draw();note(e.message,true)}}
document.addEventListener('danyul:local-change',queueSync);boot();
})();
