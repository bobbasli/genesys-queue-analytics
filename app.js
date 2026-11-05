const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const allowedRegions = ['mypurecloud.de','mypurecloud.ie','mypurecloud.com','usw2.pure.cloud','cac1.pure.cloud','aps1.pure.cloud'];
const DEPLOY = window.GQA_CONFIG || {};
function readJson(storage,key,fallback=null){try{const value=storage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}}
const savedConfig=readJson(localStorage,'gqa_config',{});
const pendingAuth=readJson(sessionStorage,'gqa_pkce');
const urlRegion=params.get('region') || (params.has('code')?pendingAuth?.region:null);

const urlClient=params.get('clientId') || (params.has('code')?pendingAuth?.client:null);
const validClient=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{20,}$/.test(value);
const region=allowedRegions.includes(urlRegion)?urlRegion:(allowedRegions.includes(DEPLOY.region)?DEPLOY.region:(allowedRegions.includes(savedConfig.region)?savedConfig.region:'mypurecloud.de'));
const client=validClient(urlClient)?urlClient:(validClient(DEPLOY.clientId)?DEPLOY.clientId:(savedConfig.client||''));


$('region').value=region;$('client').value=client;
if(validClient(client)){$('connection-settings').hidden=true;}
function dateLocal(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
$('day').value=dateLocal(new Date());
const appUrl=new URL(location.origin+location.pathname);
if(validClient(urlClient))appUrl.searchParams.set('clientId',urlClient);
if(allowedRegions.includes(urlRegion))appUrl.searchParams.set('region',urlRegion);

const redirectUri=location.origin+location.pathname,launchUri=appUrl.href;
let accessToken=null,expiresAt=0,myQueues=[],myId=null,orgId=null,loading=false,lastReport=null;
let agentMembers=[],agentBusy=false,agentTimer=null,agentView=false,agentStatus=new Map(),agentGroupLoaded=null,activeQueueIds=new Set(),queueMemberships=[];
let liveBusy=false,performanceBusy=false,refreshTimer=null,reportGeneration=0,backoffUntil=0;
const LIVE_INTERVAL=3000,PERFORMANCE_INTERVAL=30000;
const MEDIA={all:'Alle media',voice:'Voice',email:'E-mail',chat:'Chat',message:'Messaging',callback:'Callback'};
const DEFINITIONS=[
 {id:'offered',name:'Offered',description:'Aangeboden interacties (nOffered)',metric:'nOffered'},
 {id:'answerpct',name:'Answer %',description:'Beantwoord / aangeboden',metric:'tAnswered'},
 {id:'flowout',name:'Flow Out',description:'Interacties die de queue verlaten zonder beantwoording (nFlowOut)',metric:'nFlowOut'},
 {id:'avgwait',name:'Avg Wait',description:'Gemiddelde wachttijd (tWait)',metric:'tWait'},
 {id:'avgabandon',name:'Avg Abandon',description:'Gemiddelde wachttijd tot abandon (tAbandon)',metric:'tAbandon'},
 {id:'answered',name:'Answered',description:'Beantwoorde interacties (tAnswered count)',metric:'tAnswered'},
 {id:'handle',name:'Handle',description:'Afgehandelde interacties (tHandle count)',metric:'tHandle'},
 {id:'abandoned',name:'Abandoned',description:'Afgebroken interacties (tAbandon count)',metric:'tAbandon'},
 {id:'abandonpct',name:'Abandon %',description:'Afgebroken / aangeboden',metric:'tAbandon'},
 {id:'asa',name:'ASA',description:'Gemiddelde antwoordtijd (tAnswered)',metric:'tAnswered'},
 {id:'aht',name:'AHT',description:'Gemiddelde afhandeltijd (tHandle)',metric:'tHandle'},
 {id:'talk',name:'Avg Talk',description:'Gemiddelde gesprekstijd (tTalk)',metric:'tTalk'},
 {id:'hold',name:'Avg Hold',description:'Gemiddelde wachttijd in hold (tHeld)',metric:'tHeld'},
 {id:'acw',name:'Avg ACW',description:'Gemiddelde nawerktijd (tAcw)',metric:'tAcw'},
 {id:'blindtransfer',name:'Blind Transfer',description:'Blind doorgeschakelde interacties',metric:'nBlindTransferred'},
 {id:'consulttransfer',name:'Consult Transfer',description:'Consult-doorschakelingen',metric:'nConsultTransferred'},
 {id:'transfer',name:'Transfer',description:'Blind + consult transfers (nBlindTransferred + nConsultTransferred)',metric:'nBlindTransferred'},
 {id:'sl',name:'SL %',description:'Service Level volgens Genesys Cloud (oServiceLevel)',metric:'oServiceLevel'},
 {id:'waiting',name:'Waiting',description:'Actueel wachtende interacties; leeg bij historie',metric:null},
 {id:'waittime',name:'Wait Time',description:'Langste actuele wachttijd; leeg bij historie',metric:null}
];
const DEFAULT=['offered','answered','abandoned','aht','asa','waiting'];
const MAX_METRICS=6;
// Normale voortgangsmeldingen niet tonen; alleen fouten blijven zichtbaar.
const status=msg=>{const el=$('status');const message=String(msg||'');const isError=/^(Fout:|Genesys API|Live statistieken niet beschikbaar|Performance refresh mislukt|Queuecijfers geladen; persoonlijke statistieken niet beschikbaar|Popup geblokkeerd)/i.test(message);el.textContent=isError?message:'';el.hidden=!isError;};
function base(){const r=$('region').value;if(!allowedRegions.includes(r))throw Error('Ongeldige regio');return 'https://api.'+r;}
function authBase(){return 'https://login.'+$('region').value;}
function save(){const c=$('client').value.trim();if(!validClient(c))throw Error('Vul een geldige OAuth Client ID in');localStorage.setItem('gqa_config',JSON.stringify({client:c,region:$('region').value}));}
function randomUrlSafe(size=32){const b=crypto.getRandomValues(new Uint8Array(size));return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function sha256base64url(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function login(){save();const verifier=randomUrlSafe(48),state=randomUrlSafe(24);sessionStorage.setItem('gqa_pkce',JSON.stringify({verifier,state,region:$('region').value,client:$('client').value.trim(),time:Date.now()}));const url=new URL(authBase()+'/oauth/authorize');url.search=new URLSearchParams({response_type:'code',client_id:$('client').value.trim(),redirect_uri:redirectUri,code_challenge:await sha256base64url(verifier),code_challenge_method:'S256',state});location.assign(url.href);}
async function callback(){if(!params.has('code')&&!params.has('error'))return false;const p=readJson(sessionStorage,'gqa_pkce');if(!p||Date.now()-p.time>600000||p.state!==params.get('state')||p.region!==$('region').value)throw Error('OAuth state ongeldig of verlopen');if(params.has('error'))throw Error(params.get('error_description')||params.get('error'));const response=await fetch(authBase()+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:params.get('code'),redirect_uri:redirectUri,client_id:p.client,code_verifier:p.verifier})});const data=await response.json();if(!response.ok||!data.access_token)throw Error('Token ophalen mislukt: '+JSON.stringify(data));accessToken=data.access_token;expiresAt=Date.now()+(data.expires_in||3600)*1000;sessionStorage.removeItem('gqa_pkce');history.replaceState(null,'',launchUri);await discover();if(selectedQueues().length)await load();return true;}
// v0.3.20: 'all' is a UI choice, never a Genesys mediaType.
// Sanitize analytics request bodies centrally as a defensive measure.
function cleanAnalyticsMediaFilter(node){
 if(Array.isArray(node))return node.map(cleanAnalyticsMediaFilter).filter(x=>x!==null);
 if(!node||typeof node!=='object')return node;
 if(node.dimension==='mediaType'&&String(node.value||'').toLowerCase()==='all')return null;
 const out={};
 for(const [key,value] of Object.entries(node)){
  if((key==='clauses'||key==='predicates')&&Array.isArray(value)){
   const items=value.map(cleanAnalyticsMediaFilter).filter(Boolean);
   if(items.length)out[key]=items;
  }else out[key]=cleanAnalyticsMediaFilter(value);
 }
 if((Object.hasOwn(out,'clauses')&&!out.clauses)||(Object.hasOwn(out,'predicates')&&!out.predicates))return null;
 return out;
}
function normalizeMedia(media){return Object.hasOwn(MEDIA,media)?media:'all';}
async function api(path,options={}){
 if(options.body&&path.includes('/analytics/')&&path.endsWith('/query')){
  const payload=JSON.parse(options.body);
  options={...options,body:JSON.stringify(cleanAnalyticsMediaFilter(payload))};
 }if(!accessToken||Date.now()>expiresAt-60000)throw Error('Sessie verlopen. Meld opnieuw aan.');const r=await fetch(base()+path,{...options,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',...options.headers}});if(!r.ok){if(r.status===429){const retry=Number(r.headers.get('Retry-After'));backoffUntil=Date.now()+(Number.isFinite(retry)&&retry>0?retry*1000:60000);}throw Error('Genesys API '+r.status+': '+(await r.text()).slice(0,350));}return r.json();}
async function pages(path,key){let page=1,results=[];while(page<=100){const sep=path.includes('?')?'&':'?';const j=await api(`${path}${sep}pageSize=100&pageNumber=${page}`);const batch=Array.isArray(j)?j:(j[key]||j.queues||j.results||[]);if(!Array.isArray(batch))throw Error('Onverwacht formaat van queue-lidmaatschappen');results.push(...batch);if(!batch.length||results.length>=(j.total||j.totalCount||Infinity)||batch.length<100)break;page++;}return results;}
function selectionKey(suffix){return `gqa_030_${suffix}_${$('region').value}_${orgId||'org'}_${myId||'user'}`;}
function selectedQueues(){return [...$('queues').querySelectorAll('input:checked')].map(x=>x.value);}
function visibleQueues(){const ids=selectedQueues();return $('show-all-queues').checked?ids:ids.filter(id=>activeQueueIds.has(id));}
function queueVisibilityChanged(){renderReport();}
function storeQueues(){if(myId)localStorage.setItem(selectionKey('queues'),JSON.stringify(selectedQueues()));stopRefresh();lastReport=null;$('rows').replaceChildren();status('Queueselectie gewijzigd.');if(accessToken&&selectedQueues().length)requestAutoLoad();}
async function discover(){status('Queue-lidmaatschappen ophalen...');const me=await api('/api/v2/users/me?expand=division');myId=me.id;orgId=me.organization?.id||null;$('identity').textContent=me.name||me.username||'Aangemeld';$('account-action').hidden=false;$('account-button').title='Afmelden bij Genesys Cloud';const memberships=await pages('/api/v2/users/'+encodeURIComponent(me.id)+'/queues','entities');queueMemberships=memberships;activeQueueIds=new Set();const seen=new Set();myQueues=memberships.map(item=>{const q=item?.queue||item;const joined=item?.joined??item?.isJoined??q?.joined??q?.isJoined; if(q?.id&&joined!==false)activeQueueIds.add(q.id);return q;}).filter(q=>q&&q.id&&!seen.has(q.id)&&seen.add(q.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','nl'));agentGroupLoaded=null;const old=readJson(localStorage,selectionKey('queues'));$('queues').replaceChildren();for(const q of myQueues){const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.value=q.id;cb.checked=!Array.isArray(old)||old.includes(q.id);cb.addEventListener('change',storeQueues);label.append(cb,document.createTextNode(q.name||q.id));$('queues').append(label);}$('select-all').disabled=!myQueues.length;$('select-none').disabled=!myQueues.length;const savedMedia=localStorage.getItem(selectionKey('media'));if(savedMedia&&MEDIA[savedMedia])$('media').value=savedMedia;renderMetricChoices();$('report-title').textContent='Dagcijfers - '+MEDIA[$('media').value];status(`${myQueues.length} queue(s) gevonden.`);if(agentView)loadAgents();}
function settingsTab(tab){const queues=tab==='queues';$('panel-queues').hidden=!queues;$('panel-metrics').hidden=queues;for(const [id,active] of [['tab-queues',queues],['tab-metrics',!queues]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',String(active));}}
function openSettings(tab='queues'){settingsTab(tab);$('settings-dialog').showModal();}
$('settings-button').onclick=()=>openSettings();$('close-settings').onclick=()=>$('settings-dialog').close();$('close-settings-bottom').onclick=()=>$('settings-dialog').close();$('tab-queues').onclick=()=>settingsTab('queues');$('tab-metrics').onclick=()=>settingsTab('metrics');
$('select-all').onclick=()=>{$('queues').querySelectorAll('input').forEach(x=>x.checked=true);storeQueues();};$('select-none').onclick=()=>{$('queues').querySelectorAll('input').forEach(x=>x.checked=false);storeQueues();};
function metricKey(){return selectionKey('metrics')+'_'+$('media').value;}
// Queue Activity-statistieken staan altijd vooraan, ongeacht de volgorde
// waarin de gebruiker de maximaal zes statistieken heeft aangevinkt.
function metricSelection(){
 const stored=readJson(localStorage,metricKey());
 const valid=DEFINITIONS.map(m=>m.id);
 const selected=(Array.isArray(stored)?stored:DEFAULT)
   .filter((x,i,items)=>valid.includes(x)&&items.indexOf(x)===i)
   .slice(0,MAX_METRICS);
 const priority=['waiting','waittime'];
 return [...priority.filter(id=>selected.includes(id)),...selected.filter(id=>!priority.includes(id))];
}
function renderMetricChoices(){const selected=metricSelection();$('metrics').replaceChildren();for(const m of DEFINITIONS){const label=document.createElement('label'),cb=document.createElement('input'),description=document.createElement('span');cb.type='checkbox';cb.value=m.id;cb.checked=selected.includes(m.id);cb.disabled=!cb.checked&&selected.length>=MAX_METRICS;cb.addEventListener('change',()=>{const next=[...$('metrics').querySelectorAll('input:checked')].map(x=>x.value);if(next.length===0){cb.checked=true;return;}localStorage.setItem(metricKey(),JSON.stringify(next));renderMetricChoices();if(accessToken&&selectedQueues().length)requestAutoLoad();});description.innerHTML='';const strong=document.createElement('strong');strong.textContent=m.name;const note=document.createElement('small');note.textContent=m.description;description.append(strong,note);label.append(cb,description);$('metrics').append(label);}$('metric-count').textContent=selected.length+' van maximaal 6 geselecteerd';renderTableHead();}
$('reset-metrics').onclick=()=>{localStorage.setItem(metricKey(),JSON.stringify(DEFAULT));renderMetricChoices();if(accessToken&&selectedQueues().length)requestAutoLoad();};
$('media').onchange=()=>{stopRefresh();if(myId)localStorage.setItem(selectionKey('media'),$('media').value);renderMetricChoices();$('report-title').textContent='Dagcijfers - '+MEDIA[$('media').value];lastReport=null;$('rows').replaceChildren();$('personal-cards').textContent='Gegevens worden geladen...';status('Mediatype gewijzigd.');if(accessToken&&selectedQueues().length)requestAutoLoad();};
function renderTableHead(){const tr=$('table-head');tr.replaceChildren();for(const label of ['Queue',...metricSelection().map(id=>DEFINITIONS.find(m=>m.id===id).name)]){const th=document.createElement('th');th.textContent=label;tr.append(th);}}
const raw=(data,name)=>data.flatMap(x=>x.metrics||[]).filter(m=>m.metric===name).map(m=>m.stats||{});
function sumStats(data,name){const items=raw(data,name);return {count:items.reduce((n,x)=>n+(Number(x.count)||0),0),sum:items.reduce((n,x)=>n+(Number(x.sum)||0),0)};}
function formatTime(ms){if(!Number.isFinite(ms))return '—';const seconds=Math.max(0,Math.floor(ms/1000));return [Math.floor(seconds/3600),Math.floor((seconds%3600)/60),seconds%60].map(x=>String(x).padStart(2,'0')).join(':');}
function pct(num,den){return den?((num/den)*100).toFixed(1)+'%':'—';}
function serviceLevel(data){const stats=raw(data,'oServiceLevel');const numerator=stats.reduce((n,x)=>n+(Number(x.numerator)||0),0);const denominator=stats.reduce((n,x)=>n+(Number(x.denominator)||0),0);return pct(numerator,denominator);}
function values(data){const get=k=>sumStats(data,k),offered=get('nOffered'),answered=get('tAnswered'),abandoned=get('tAbandon'),handle=get('tHandle'),talk=get('tTalk'),hold=get('tHeld'),acw=get('tAcw'),transfer={count:get('nBlindTransferred').count+get('nConsultTransferred').count};const avg=x=>x.count?formatTime(x.sum/x.count):'—';return {sl:serviceLevel(data),offered:offered.count,answered:answered.count,answerpct:pct(answered.count,offered.count),flowout:get('nFlowOut').count,avgwait:avg(get('tWait')),avgabandon:avg(abandoned),handle:handle.count,abandoned:abandoned.count,abandonpct:pct(abandoned.count,offered.count),asa:avg(answered),aht:avg(handle),talk:avg(talk),hold:avg(hold),acw:avg(acw),blindtransfer:get('nBlindTransferred').count,consulttransfer:get('nConsultTransferred').count,transfer:transfer.count};}
function row(label,data,bold=false,waiting=null,waittime=null){const tr=document.createElement('tr');if(bold)tr.className='total-row';const v=values(data);v.waiting=waiting;v.waittime=waiting===0?'–':(waittime===null?'—':formatTime(waittime));for(const value of [label,...metricSelection().map(id=>(id==='waiting'?(v.waiting===null?'':v.waiting):(id==='waittime'?v.waittime:(v[id]??'—'))))]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}$('rows').append(tr);}
function localInterval(day){const [y,m,d]=day.split('-').map(Number);const start=new Date(y,m-1,d),end=new Date(y,m-1,d+1);if(!Number.isFinite(start.getTime()))throw Error('Ongeldige datum');return start.toISOString()+'/'+end.toISOString();}

function queueMetrics(){
 const needed=new Set();
 const dependency={answerpct:['nOffered','tAnswered'],abandonpct:['nOffered','tAbandon'],transfer:['nBlindTransferred','nConsultTransferred']};
 for(const id of metricSelection()){
  const def=DEFINITIONS.find(x=>x.id===id);
  for(const metric of dependency[id]||(def?.metric?[def.metric]:[]))needed.add(metric);
 }
 return [...needed].length?[...needed]:['nOffered'];
}
function queryBody(interval,ids,media,personal=false){const clauses=[{type:'or',predicates:ids.map(value=>({type:'dimension',dimension:'queueId',operator:'matches',value}))}];if(normalizeMedia(media)!=='all')clauses.push({type:'or',predicates:[{type:'dimension',dimension:'mediaType',operator:'matches',value:media}]});clauses.push({type:'or',predicates:[{type:'dimension',dimension:'direction',operator:'matches',value:'inbound'}]});return {interval,granularity:'P1D',groupBy:personal?['userId','queueId']:['queueId'],filter:{type:'and',clauses},metrics:personal?['tHandle','nBlindTransferred','nConsultTransferred','tTalk','tAcw','tAnswered']:queueMetrics()};}
function isToday(day){return day===dateLocal(new Date());}
async function liveActivity(ids,media){
 // Longest Waiting: the oldest oWaiting observationDate, not stats.max.
 // The API sample returned by the user has observations on the metric itself.
 const clauses=[{type:'or',predicates:ids.map(value=>({type:'dimension',dimension:'queueId',operator:'matches',value}))}];if(normalizeMedia(media)!=='all')clauses.push({type:'or',predicates:[{type:'dimension',dimension:'mediaType',operator:'matches',value:media}]});const body={filter:{type:'and',clauses},metrics:['oWaiting'],detailMetrics:['oWaiting'],groupBy:['queueId','mediaType']};
 const response=await api('/api/v2/analytics/queues/observations/query',{method:'POST',body:JSON.stringify(body)});
 const counts=new Map(ids.map(id=>[id,0])),waitStarts=new Map(ids.map(id=>[id,null]));
 const now=Date.now();
 for(const item of response.results||[]){
  const id=item.group?.queueId;if(!counts.has(id)||(normalizeMedia(media)!=='all'&&item.group?.mediaType!==media))continue;
  for(const datum of item.data||[]){
   const metrics=Array.isArray(datum.metrics)?datum.metrics:(datum.metric?[datum]:[]);
   for(const metric of metrics){
    if(metric.metric!=='oWaiting')continue;
    const count=Number(metric.stats?.count)||0;
    counts.set(id,counts.get(id)+count);
    if(count<=0)continue;
    for(const observation of metric.observations||[]){
     const t=Date.parse(observation?.observationDate||'');
     if(Number.isFinite(t)&&t>0&&t<=now){
      const previous=waitStarts.get(id);
      if(previous===null||t<previous)waitStarts.set(id,t);
     }
    }
   }
  }
 }
 return {counts,waitStarts,updatedAt:now};
}
function waitDuration(activity,id){
 if(!activity||!(activity.counts.get(id)>0))return null;
 const start=activity.waitStarts.get(id);
 return Number.isFinite(start)?Math.max(0,Date.now()-start):null;
}

function groupedData(results,queueId,userId){return (results||[]).filter(x=>x.group?.queueId===queueId&&(!userId||x.group?.userId===userId)).flatMap(x=>x.data||[]);}
function renderReport(){if(!lastReport)return;const {response,activity,day}=lastReport;const ids=visibleQueues();$('rows').replaceChildren();const all=ids.flatMap(id=>groupedData(response.results,id));const live=isToday(day)&&activity;const waitTotal=live?ids.reduce((n,id)=>n+(activity.counts.get(id)||0),0):null;const times=live?ids.map(id=>waitDuration(activity,id)).filter(v=>v!==null&&v!==undefined):[];const maxWait=times.length?Math.max(...times):null;row('Totaal zichtbare queues',all,true,waitTotal,maxWait);for(const id of ids){const q=myQueues.find(x=>x.id===id);row(q?.name||id,groupedData(response.results,id),false,live?activity.counts.get(id):null,live?waitDuration(activity,id):null);}if(!ids.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=metricSelection().length+1;td.textContent='Geen actieve queues binnen de selectie. Vink “Alle geselecteerde queues tonen” aan om ook niet-actieve queues te zien.';tr.append(td);$('rows').append(tr);}}
function stopRefresh(){reportGeneration++;if(refreshTimer!==null){clearTimeout(refreshTimer);refreshTimer=null;}lastReport=null;}
function liveSelected(){return metricSelection().some(x=>x==='waiting'||x==='waittime');}
async function refreshLive(){const report=lastReport;if(!report||!isToday(report.day)||!liveSelected()||document.hidden||liveBusy||Date.now()<backoffUntil)return;liveBusy=true;try{const activity=await liveActivity(report.ids,report.media);if(lastReport===report){report.activity=activity;renderReport();$('live-updated').textContent='Live bijgewerkt: '+new Date().toLocaleTimeString('nl-NL');}}catch(e){console.warn('[GQA] Live Queue Activity',e);if(lastReport===report)status('Live statistieken niet beschikbaar: '+e.message);}finally{liveBusy=false;}}
async function refreshPerformance(){const report=lastReport;if(!report||!isToday(report.day)||document.hidden||performanceBusy||loading||Date.now()<backoffUntil)return;performanceBusy=true;try{const response=await api('/api/v2/analytics/conversations/aggregates/query',{method:'POST',body:JSON.stringify(queryBody(localInterval(report.day),report.ids,report.media))});if(lastReport!==report)return;report.response=response;renderReport();await refreshPersonal(report);$('performance-updated').textContent='Performance bijgewerkt: '+new Date().toLocaleTimeString('nl-NL');}catch(e){console.warn('[GQA] Performance refresh',e);if(lastReport===report)status('Performance refresh mislukt: '+e.message);}finally{performanceBusy=false;}}
async function refreshPersonal(report){const personalQuery=queryBody(localInterval(report.day),report.ids,report.media,true);personalQuery.filter.clauses.push({type:'or',predicates:[{type:'dimension',dimension:'userId',operator:'matches',value:myId}]});const personal=await api('/api/v2/analytics/conversations/aggregates/query',{method:'POST',body:JSON.stringify(personalQuery)});if(lastReport!==report)return;const mine=(personal.results||[]).filter(x=>x.group?.userId===myId&&report.ids.includes(x.group?.queueId)).flatMap(x=>x.data||[]);personalCards(mine);}
function scheduleRefresh(){if(refreshTimer!==null)clearTimeout(refreshTimer);if(!lastReport||!isToday(lastReport.day)||document.hidden)return;const gen=reportGeneration;let lastPerformance=Date.now();const tick=async()=>{if(gen!==reportGeneration)return;if(!document.hidden){await refreshLive();if(Date.now()-lastPerformance>=PERFORMANCE_INTERVAL){lastPerformance=Date.now();await refreshPerformance();}}if(gen===reportGeneration)refreshTimer=setTimeout(tick,LIVE_INTERVAL);};refreshTimer=setTimeout(tick,LIVE_INTERVAL);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(refreshTimer!==null)clearTimeout(refreshTimer);refreshTimer=null;}else if(lastReport&&isToday(lastReport.day)){refreshLive();refreshPerformance();scheduleRefresh();}});
function personalCards(data){const container=$('personal-cards');container.replaceChildren();const handle=sumStats(data,'tHandle'),transfer={count:sumStats(data,'nBlindTransferred').count+sumStats(data,'nConsultTransferred').count},talk=sumStats(data,'tTalk'),acw=sumStats(data,'tAcw'),answered=sumStats(data,'tAnswered');const avg=m=>m.count?formatTime(m.sum/m.count):'—';for(const [label,value] of [['Handle',handle.count],['Transfer',transfer.count],['Avg Handle',avg(handle)],['Avg Talk',avg(talk)],['Avg ACW',avg(acw)],['ASA',avg(answered)]]){const card=document.createElement('div');card.className='compact-card';const text=document.createElement('span');text.textContent=label;const strong=document.createElement('strong');strong.textContent=String(value);card.append(text,strong);container.append(card);}}
async function load(){const ids=selectedQueues();if(!ids.length){if(myQueues.length)openSettings('queues');throw Error('Selecteer minimaal één queue');}const day=$('day').value;if(!day)throw Error('Kies een datum');if(loading){pendingAutoLoad=true;return;}stopRefresh();loading=true;updateRefreshButton();try{
 status('Analytics ophalen...');const interval=localInterval(day),media=normalizeMedia($('media').value);
 const response=await api('/api/v2/analytics/conversations/aggregates/query',{method:'POST',body:JSON.stringify(queryBody(interval,ids,media))});
 const report={response,ids,media,day,activity:null};lastReport=report;renderReport();
 if(isToday(day)&&liveSelected())await refreshLive();
 status('Queuecijfers geladen. Persoonlijke prestaties ophalen...');
 try{await refreshPersonal(report);status('Gereed.');}catch(e){console.warn('[GQA] Persoonlijke cijfers niet beschikbaar',e);$('personal-cards').textContent='Persoonlijke statistieken niet beschikbaar: '+e.message;status('Queuecijfers geladen; persoonlijke statistieken niet beschikbaar.');}
 if(isToday(day)){$('performance-updated').textContent='Performance bijgewerkt: '+new Date().toLocaleTimeString('nl-NL');scheduleRefresh();}
}finally{loading=false;updateRefreshButton();}}
async function manualRefresh(){if(agentView){await loadAgents();return;}if(!lastReport||!isToday(lastReport.day))return;await refreshLive();await refreshQueueOnly();}
async function refreshQueueOnly(){const report=lastReport;if(!report||!isToday(report.day)||performanceBusy||loading||document.hidden||Date.now()<backoffUntil)return;performanceBusy=true;try{const response=await api('/api/v2/analytics/conversations/aggregates/query',{method:'POST',body:JSON.stringify(queryBody(localInterval(report.day),report.ids,report.media))});if(lastReport===report){report.response=response;renderReport();$('performance-updated').textContent='Performance bijgewerkt: '+new Date().toLocaleTimeString('nl-NL');status('Actuele queuestatistieken ververst.');}}finally{performanceBusy=false;}}

// Agenten: queueleden van alle queues waarvan de ingelogde gebruiker lid is.
const AGENT_INTERVAL=15000;
function groupId(){return $('group-id').value.trim();}
function agentMessage(message){$('agents-note').textContent=message;}
function secondsInStatus(start){if(!start)return '—';const t=Date.parse(start);return Number.isFinite(t)?formatTime(Math.max(0,Date.now()-t)):'—';}
function presenceStart(p){return p?.modifiedDate||p?.startTime||p?.presenceDefinition?.modifiedDate||null;}
// Toon de exacte presence-naam (inclusief organisatie-eigen statussen).
// Routingstatus INTERACTING is een aanvullende indicator, geen vervanging van presence.
function presenceCode(p){
 const v=p?.presenceDefinition?.systemPresence??p?.systemPresence??p?.presence?.systemPresence??p?.presence??p?.status??'';
 return typeof v==='string'?v.trim().toUpperCase():'';
}
function displayPresence(p){
 const name=p?.presenceDefinition?.name||p?.presence?.name||p?.name;
 if(name)return String(name);
 const code=presenceCode(p);
 const names={AVAILABLE:'Beschikbaar',AWAY:'Afwezig',BREAK:'Pauze',BUSY:'Bezet',MEAL:'Maaltijd',MEETING:'Vergadering',OFFLINE:'Offline',UNAVAILABLE:'Niet beschikbaar',OUT_OF_OFFICE:'Out of Office',OUTOFOFFICE:'Out of Office',ON_QUEUE:'On Queue',IDLE:'Beschikbaar',TRAINING:'Training'};
 return names[code]||code||'Onbekend';
}
// Ontbrekende presence is geen bewijs van Offline: verberg standaard en toon
// bij ingeschakelde checkbox eerlijk als Onbekend.
function unavailableAgent(info){
 const p=info.presence||{};
 const code=presenceCode(p);
 const name=String(p?.presenceDefinition?.name||p?.name||'').trim().toUpperCase();
 const normalized=name.replace(/[\s-]+/g,'_');
 const excluded=new Set(['OFFLINE','UNAVAILABLE','OUT_OF_OFFICE','OUTOFOFFICE','NIET_BESCHIKBAAR','AFWEZIG_VAN_KANTOOR']);
 return !code&&!name||excluded.has(code)||excluded.has(normalized);
}
function agentRender(){
 const body=$('agent-rows');body.replaceChildren();let visible=0,hidden=0;
 // Langste bekende tijd in status eerst; ontbrekende tijdstempels onderaan.
 const ordered=[...agentMembers].sort((a,b)=>{
  const start=m=>{const p=agentStatus.get(m.id)?.presence||{};const v=presenceStart(p);const t=v?Date.parse(v):NaN;return Number.isFinite(t)?t:Infinity;};
  const diff=start(a)-start(b);
  return diff||String(a.name||a.username||'').localeCompare(String(b.name||b.username||''),'nl');
 });
 for(const member of ordered){
  const info=agentStatus.get(member.id)||{},presence=info.presence||{},routing=info.routing||{};
  if(!$('show-unavailable').checked&&unavailableAgent(info)){hidden++;continue;}
  visible++;
  const routingState=String(routing.status||'').toUpperCase(),interacting=routingState==='INTERACTING';
  const statusName=displayPresence(presence);
  const since=presenceStart(presence);
  const tr=document.createElement('tr');
  for(const value of [member.name||member.username||member.id,statusName,secondsInStatus(since)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}
  const phone=document.createElement('td');
  if(interacting){phone.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="In interactie" role="img"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8L7.1 10a16 16 0 0 0 6.9 6.9l1.7-1.9a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2z"/></svg>';phone.title='In interactie';}
  tr.append(phone);body.append(tr);
 }
 if(!agentMembers.length)agentMessage('Geen queueleden gevonden.');
 else agentMessage(`${visible} van ${agentMembers.length} agent(en) zichtbaar${hidden?' ('+hidden+' niet beschikbaar verborgen)':''}. Automatisch elke 15 seconden.`);
}
// Agenten worden verzameld uit ALLE queues waarvan de ingelogde gebruiker lid is,
// niet alleen de voor het rapport geselecteerde queues. Deduplicatie gebeurt op user ID.
async function loadAgentMembers(){
 const ids=myQueues.map(q=>q.id),unique=new Map(),errors=[];
 agentMessage('Queueleden ophalen...');
 // Beperkte paralleliteit voorkomt een grote burst bij veel queues.
 for(let i=0;i<ids.length;i+=4){
  const batch=await Promise.allSettled(ids.slice(i,i+4).map(async id=>pages('/api/v2/routing/queues/'+encodeURIComponent(id)+'/members','entities')));
  for(const r of batch){if(r.status==='rejected'){errors.push(r.reason?.message||'API-fout');continue;}
   for(const item of r.value){const user=item?.user||item?.member||item;const id=user?.id||item?.userId;if(!id)continue;
    if(!unique.has(id))unique.set(id,{id,name:user?.name||item?.name||'',username:user?.username||item?.username||''});
   }
  }
 }
 if(errors.length&&!unique.size)throw Error('Queueleden niet leesbaar: '+errors[0]);
 agentMembers=[...unique.values()].sort((a,b)=>(a.name||a.username||'').localeCompare(b.name||b.username||'','nl'));
 agentGroupLoaded=ids.slice().sort().join(',');agentStatus.clear();
 if(errors.length)agentMessage(`${errors.length} queue(s) konden niet worden gelezen; de overige leden worden getoond.`);
}
async function loadAgents(){
 if(!agentView||!accessToken||agentBusy||Date.now()<backoffUntil)return;
 agentBusy=true;updateRefreshButton();try{
  const key=myQueues.map(q=>q.id).sort().join(',');
  if(agentGroupLoaded!==key)await loadAgentMembers();
  // In batches, om piekbelasting en rate-limits te beperken.
  let failures=0;
  for(let i=0;i<agentMembers.length;i+=10){
   const batch=await Promise.all(agentMembers.slice(i,i+10).map(async m=>{
    const [presence,routing]=await Promise.allSettled([
     api('/api/v2/users/'+encodeURIComponent(m.id)+'/presences/purecloud'),
     api('/api/v2/users/'+encodeURIComponent(m.id)+'/routingstatus')]);
    if(presence.status==='rejected'||routing.status==='rejected')failures++;
    return {id:m.id,presence:presence.status==='fulfilled'?presence.value:null,routing:routing.status==='fulfilled'?routing.value:null};
   }));
   for(const item of batch)agentStatus.set(item.id,item);
   if(!agentView)break;
  }
  if(agentView){agentRender();if(failures)agentMessage(`${failures} statusaanvragen mislukt; controleer presence/routing-rechten en de Network-responses.`);}
 }catch(e){console.warn('[GQA] Agenten',e);agentMessage('Agenten niet beschikbaar: '+e.message);}finally{agentBusy=false;updateRefreshButton();}
}
function setReportTab(which){agentView=which==='agents';$('report-panel-queues').hidden=agentView;$('report-panel-agents').hidden=!agentView;for(const [id,active] of [['report-tab-queues',!agentView],['report-tab-agents',agentView]]){$(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',String(active));}if(agentTimer){clearInterval(agentTimer);agentTimer=null;}if(agentView){loadAgents();agentTimer=setInterval(()=>{if(!document.hidden)loadAgents();},AGENT_INTERVAL);}else if(!lastReport&&accessToken&&selectedQueues().length)requestAutoLoad();updateRefreshButton();}
$('show-all-queues').checked=false;$('show-all-queues').onchange=queueVisibilityChanged;
$('show-unavailable').checked=false;$('show-unavailable').onchange=agentRender;$('report-tab-queues').onclick=()=>setReportTab('queues');$('report-tab-agents').onclick=()=>setReportTab('agents');
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&agentView)loadAgents();});

function act(fn){return async()=>{try{await fn();}catch(e){console.error(e);status('Fout: '+e.message);}};}
$('save').onclick=act(async()=>{save();agentGroupLoaded=null;if(agentView)loadAgents();status('Instellingen opgeslagen.');});$('account-button').onclick=act(async()=>{if(accessToken){stopRefresh();accessToken=null;expiresAt=0;location.assign(launchUri);}else{await login();}});$('refresh').onclick=act(manualRefresh);$('popup').onclick=()=>{const w=window.open(launchUri,'genesysAnalytics','popup=yes,width=1050,height=760,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no');if(!w)status('Popup geblokkeerd. Sta popups toe in Genesys Cloud.');};
// Auto-load requests are serialized so changing date/media/selection cannot overlap loads.
let pendingAutoLoad=false,autoLoadRunning=false;
async function requestAutoLoad(){
 if(!accessToken||!selectedQueues().length)return;
 pendingAutoLoad=true;
 if(autoLoadRunning)return;
 autoLoadRunning=true;
 try{while(pendingAutoLoad){pendingAutoLoad=false;try{await load();}catch(e){console.error(e);status('Fout: '+e.message);}}}
 finally{autoLoadRunning=false;updateRefreshButton();}
}
function updateRefreshButton(){
 const button=$('refresh');if(!button)return;
 const busy=agentView?agentBusy:(loading||liveBusy||performanceBusy);
 button.disabled=!accessToken||busy||Date.now()<backoffUntil||(!agentView&&(!lastReport||!isToday(lastReport.day)));
 button.classList.toggle('is-refreshing',Boolean(busy));
 button.title=agentView?'Agentstatussen handmatig verversen':'Actuele queuestatistieken verversen';
 button.setAttribute('aria-label',agentView?'Agenten verversen':'Queues verversen');
}
renderMetricChoices();$('day').addEventListener('change',()=>{stopRefresh();status('Datum gewijzigd.');requestAutoLoad();updateRefreshButton();});
// Keep both duration columns ticking locally every second without API requests.
// Skip hidden tabs to avoid needless DOM work.
setInterval(()=>{
 if(document.hidden)return;
 if(agentView){if(!agentBusy&&agentMembers.length)agentRender();}
 else if(lastReport&&isToday(lastReport.day)&&lastReport.activity&&metricSelection().includes('waittime'))renderReport();
},1000);
setInterval(updateRefreshButton,500);
act(callback)();
