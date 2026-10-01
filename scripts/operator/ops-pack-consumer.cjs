'use strict';
// Preparation only. No process.env mutation, requests, timers, logs, or business operations.
// Integration must call loadInsideContainer after a reviewed read-only bind is installed.
const fs = require('node:fs'); // eslint-disable-line @typescript-eslint/no-require-imports -- Native standalone operator, no package loader.
const FIXED = Object.freeze({provider:'hostinger', role:'admin', environment:'production-admin', gitRef:'v4-production', sanityProjectId:'kyfxgjnq', sanityDataset:'production', neonProjectId:'lively-bar-43618798', neonBranchId:'br-long-resonance-b3ys5xrv', neonEndpointId:'ep-broad-butterfly-b3ro7u8w', neonDatabase:'neondb'});
const OFF = Object.freeze({CCPUN_LOCAL_AI_ENABLED:'false',CCPUN_LOCAL_AI_N8N_ENABLED:'false',CCPUN_SEO_INTELLIGENCE_ENABLED:'0',CCPUN_AGENT_OS_N8N_ENABLED:'false', CCPUN_EXPORT_N8N_ENABLED:'false', CCPUN_EXPORT_GOOGLE_SHEET_ENABLED:'false', CCPUN_SOCIAL_OPERATIONS_ENABLED:'0', CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED:'0', CCPUN_SOCIAL_PROVIDER_READS_ENABLED:'0', CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED:'0', CCPUN_LINE_SYSTEM_DELIVERY_ENABLED:'false', CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED:'false', CCPUN_LINE_OUTBOUND_ENABLED:'false', CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'false', CCPUN_LINE_MEDIA_FETCH_ENABLED:'false', CCPUN_LINE_CAMPAIGN_SEND_ENABLED:'false', CCPUN_LINE_TRANSCRIPT_ENABLED:'false', CCPUN_ARTICLE_SCHEDULING_ENABLED:'0', CCPUN_NATIVE_WORKFLOW_ENABLED:'0',CCPUN_MEDIA_LIBRARY_ENABLED:'0'});
const FIELDS = Object.freeze({
 localAiCrypto:['CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1','CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION'],
 localAiCallbacks:['CCPUN_LOCAL_AI_N8N_TOKEN'],
 driveInteractive:['NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID','NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_PICKER_API_KEY','NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID','CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID','CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID'],
 agentCallbacks:['CCPUN_AGENT_OS_N8N_TOKEN'],
 exportCallbacks:['CCPUN_EXPORT_N8N_TOKEN'],
 googleSheetTrigger:['CCPUN_N8N_EXPORT_WEBHOOK_URL','CCPUN_N8N_EXPORT_WEBHOOK_TOKEN'],
 googleData:['reuseLoginOAuthClient','CCPUN_GOOGLE_DATA_REFRESH_TOKEN','CCPUN_GSC_SITE_URL','CCPUN_GA4_PROPERTY_ID'],
 socialWorker:['CCPUN_SOCIAL_DATABASE_URL','CCPUN_META_ACCESS_TOKEN','CCPUN_META_GRAPH_VERSION','CCPUN_META_GRANTED_SCOPES','CCPUN_META_PAGE_ID'],
 cronAuth:['CRON_SECRET'],
 lineCrypto:['CCPUN_LINE_IDENTITY_HMAC_KEY_V1','CCPUN_LINE_ENCRYPTION_KEY_V1','CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION'],
 lineIngress:['LINE_CHANNEL_SECRET'],
 lineRichMenu:['CCPUN_LINE_CHANNEL_ACCESS_TOKEN'],
});
for(const names of Object.values(FIELDS))Object.freeze(names);
const LINE = new Set(['lineCrypto','lineIngress','lineRichMenu']);

const FLAG_GROUPS=Object.freeze({
 CCPUN_LOCAL_AI_ENABLED:'localAiCrypto',CCPUN_LOCAL_AI_N8N_ENABLED:'localAiCallbacks',
 CCPUN_SOCIAL_OPERATIONS_ENABLED:'socialWorker',CCPUN_SOCIAL_PROVIDER_READS_ENABLED:'socialWorker',CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED:'socialWorker',CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED:'socialWorker',
 CCPUN_AGENT_OS_N8N_ENABLED:'agentCallbacks',CCPUN_EXPORT_N8N_ENABLED:'exportCallbacks',CCPUN_EXPORT_GOOGLE_SHEET_ENABLED:'googleSheetTrigger',
 CCPUN_LINE_MEDIA_FETCH_ENABLED:'lineRichMenu',CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'lineCrypto',CCPUN_LINE_SYSTEM_DELIVERY_ENABLED:'lineRichMenu',CCPUN_LINE_RICH_MENU_PROVIDER_ENABLED:'lineRichMenu',CCPUN_LINE_OUTBOUND_ENABLED:'lineRichMenu',CCPUN_LINE_CAMPAIGN_SEND_ENABLED:'lineRichMenu',CCPUN_LINE_TRANSCRIPT_ENABLED:'lineCrypto',CCPUN_MEDIA_LIBRARY_ENABLED:'driveInteractive'});
function activation(v){keys(v,Object.keys(FLAG_GROUPS));for(const value of Object.values(v))if(typeof value!=='boolean')deny('OPS_ACTIVATION_DENIED');}

function parseJson(serialized){
 const result=JSON.parse(serialized),stack=[];
 const tokens=serialized.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)||[];
 for(const token of tokens){
  if(token==='{'||token==='[')stack.push({object:token==='{',key:token==='{',names:new Set()});
  else if(token==='}'||token===']')stack.pop();
  else if(token===','){const top=stack.at(-1);if(top?.object)top.key=true;}
  else if(token[0]==='"'){const top=stack.at(-1);if(top?.object&&top.key){const name=JSON.parse(token);if(top.names.has(name))deny('OPS_JSON_DUPLICATE_DENIED');top.names.add(name);top.key=false;}}
 }
 return result;
}

function deny(code){const e=new Error(code); e.code=code; throw e;}
function object(v){if(!v || Array.isArray(v) || typeof v!=='object' || ![Object.prototype,null].includes(Object.getPrototypeOf(v)))deny('OPS_SHAPE_DENIED');}
function keys(v,names){object(v); if(Object.keys(v).sort().join('\0')!==[...names].sort().join('\0'))deny('OPS_KEYS_DENIED');}
function text(v,min=1,max=16384){if(typeof v!=='string'||v!==v.trim()||v.length<min||v.length>max||/[\x00-\x1f\x7f]/.test(v))deny('OPS_VALUE_DENIED');return v;}
function equals(v,expected){object(v); for(const [k,x] of Object.entries(expected))if(v[k]!==x)deny('OPS_IDENTITY_DENIED');}
function expectedIdentity(e){
 keys(e,['gitSha','lockSha256','releaseId','exportWebhookUrl']);
 text(e.gitSha,40,40);text(e.lockSha256,64,64);text(e.releaseId,1,120);
 if(!/^[0-9a-f]{40}$/.test(e.gitSha)||! /^[0-9a-f]{64}$/.test(e.lockSha256)||!new RegExp('^ccpun-native-admin-production-build-'+e.gitSha.slice(0,8)+'-[0-9]{8}$').test(e.releaseId))deny('OPS_EXPECTED_IDENTITY_DENIED');
 if(e.exportWebhookUrl!==null)webhook(e.exportWebhookUrl);
 return e;
}
function webhook(value){
 text(value,1,4096); let u;try{u=new URL(value);}catch{deny('OPS_WEBHOOK_DENIED');}
 if(u.protocol!=='https:'||u.hostname!=='n8n.srv908107.hstgr.cloud'||u.port||u.username||u.password||u.hash||u.search||!/^\/webhook\/[A-Za-z0-9_./-]+$/.test(u.pathname)||u.pathname.includes('..')||u.toString()!==value)deny('OPS_WEBHOOK_DENIED');
 return value;
}
function socialUrl(value){
 text(value); let u,user,password;try{u=new URL(value);user=decodeURIComponent(u.username);password=decodeURIComponent(u.password);}catch{deny('OPS_SOCIAL_DATABASE_DENIED');}
 const hosts=['ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech','ep-broad-butterfly-b3ro7u8w-pooler.c-4.ap-southeast-1.aws.neon.tech'];
 const q=[...u.searchParams];
 if(u.protocol!=='postgresql:'||!hosts.includes(u.hostname)||u.port||u.hash||u.pathname!=='/neondb'||user!=='ccpun_social_runtime'||!password||/[\x00-\x20\x7f]/.test(value)||/%(?![0-9a-f]{2})/i.test(value)||/[\x00-\x1f\x7f]/.test(password)||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'||q.length<1||q.length>2||q.some(([k,v])=>!((k==='sslmode'||k==='channel_binding')&&v==='require'))||new Set(q.map(([k])=>k)).size!==q.length)deny('OPS_SOCIAL_DATABASE_DENIED');
}
function base64(value,min,exact){text(value);if(value.length%4!==0||! /^[A-Za-z0-9+/]+={0,2}$/.test(value))deny('OPS_LINE_CRYPTO_DENIED');const b=Buffer.from(value,'base64');if(b.length<min||(exact&&b.length!==exact)||b.toString('base64')!==value)deny('OPS_LINE_CRYPTO_DENIED');}
function validateSection(name,v,e){
 if(!Object.hasOwn(FIELDS,name))deny('OPS_CAPABILITY_DENIED');const fields=FIELDS[name];
 object(v);
 const extra=name==='googleData'?(v.reuseLoginOAuthClient===true?['refreshTokenClientId']:v.reuseLoginOAuthClient===false?['CCPUN_GOOGLE_DATA_CLIENT_ID','CCPUN_GOOGLE_DATA_CLIENT_SECRET']:[]):name==='lineCrypto'&&Object.hasOwn(v,'CCPUN_LINE_ENCRYPTION_KEY_V2')?['CCPUN_LINE_ENCRYPTION_KEY_V2']:name==='localAiCrypto'&&Object.hasOwn(v,'CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2')?['CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2']:[];
 keys(v,[...fields,...extra]);for(const [key,x] of Object.entries(v))if(key!=='reuseLoginOAuthClient')text(x);
 if(name==='driveInteractive'){if(!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(v.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_OAUTH_CLIENT_ID)||!/^[1-9]\d{1,29}$/.test(v.NEXT_PUBLIC_CCPUN_GOOGLE_DRIVE_APP_ID)||!['CCPUN_GOOGLE_DRIVE_ADMIN_ROOT_FOLDER_ID','CCPUN_GOOGLE_DRIVE_MEDIA_ROOT_FOLDER_ID'].every(k=>/^[A-Za-z0-9_-]{10,200}$/.test(v[k])))deny('OPS_DRIVE_CONFIG_DENIED');}
 if(name==='agentCallbacks'||name==='exportCallbacks'||name==='localAiCallbacks')text(Object.values(v)[0],43);
 if(name==='googleSheetTrigger'){webhook(v.CCPUN_N8N_EXPORT_WEBHOOK_URL);if(e.exportWebhookUrl!==null&&v.CCPUN_N8N_EXPORT_WEBHOOK_URL!==e.exportWebhookUrl)deny('OPS_WEBHOOK_PIN_DENIED');text(v.CCPUN_N8N_EXPORT_WEBHOOK_TOKEN,43);}
 if(name==='googleData'){
  if(typeof v.reuseLoginOAuthClient!=='boolean'||!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(v.reuseLoginOAuthClient?v.refreshTokenClientId:v.CCPUN_GOOGLE_DATA_CLIENT_ID)||!/^\d{1,20}$/.test(v.CCPUN_GA4_PROPERTY_ID))deny('OPS_GOOGLE_DATA_DENIED');
  const site=v.CCPUN_GSC_SITE_URL; if(site!=='sc-domain:ccpun.com'&&site!=='https://ccpun.com/'&&site!=='https://www.ccpun.com/')deny('OPS_GOOGLE_RESOURCE_DENIED');
 }
 if(name==='socialWorker'){
  socialUrl(v.CCPUN_SOCIAL_DATABASE_URL);
  if(!/^v\d{1,2}\.\d{1,2}$/.test(v.CCPUN_META_GRAPH_VERSION)||!/^\d{1,120}$/.test(v.CCPUN_META_PAGE_ID))deny('OPS_META_CONFIG_DENIED');
  const scopes=v.CCPUN_META_GRANTED_SCOPES.split(',');if(scopes.some(x=>! /^[a-z_]+$/.test(x))||new Set(scopes).size!==scopes.length||!['pages_show_list','pages_read_engagement','pages_manage_posts'].every(x=>scopes.includes(x)))deny('OPS_META_SCOPES_DENIED');
 }
 if(name==='localAiCrypto'){base64(v.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V1,32,32);if(extra.length)base64(v.CCPUN_LOCAL_AI_ENCRYPTION_KEY_V2,32,32);if(!['1','2'].includes(v.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION)||(v.CCPUN_LOCAL_AI_ACTIVE_KEY_VERSION==='2'&&!extra.length))deny('OPS_LOCAL_AI_ACTIVE_KEY_DENIED');}
 if(name==='lineCrypto'){
  base64(v.CCPUN_LINE_IDENTITY_HMAC_KEY_V1,32);base64(v.CCPUN_LINE_ENCRYPTION_KEY_V1,32,32);if(extra.length)base64(v.CCPUN_LINE_ENCRYPTION_KEY_V2,32,32);
  if(!['1','2'].includes(v.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION)||(v.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION==='2'&&!extra.length))deny('OPS_LINE_ACTIVE_KEY_DENIED');
 }
}
function validate(pack,manifest,expected){
 const e=expectedIdentity(expected);
 equals(manifest,{schemaVersion:1,provider:FIXED.provider,role:FIXED.role,environment:FIXED.environment,gitRef:FIXED.gitRef,gitSha:e.gitSha,lockSha256:e.lockSha256,releaseId:e.releaseId,capabilityProfile:'full',schedulerBackend:'disabled',sanityProjectId:FIXED.sanityProjectId,sanityDataset:FIXED.sanityDataset,neonProjectId:FIXED.neonProjectId,neonBranchId:FIXED.neonBranchId,neonDatabase:FIXED.neonDatabase,productionReady:false,platform:'linux',architecture:'x64'});
 keys(pack,['schemaVersion',...Object.keys(FIXED),'gitSha','lockSha256','sections','activation']);
 equals(pack,{schemaVersion:1,...FIXED,gitSha:e.gitSha,lockSha256:e.lockSha256});object(pack.sections);activation(pack.activation);
 for(const [flag,group] of Object.entries(FLAG_GROUPS))if(pack.activation[flag]&&!pack.sections[group])deny('OPS_ACTIVATION_DEPENDENCY_DENIED');
 if(!Object.keys(pack.sections).length)deny('OPS_EMPTY_PACK_DENIED');
 for(const [name,values] of Object.entries(pack.sections))validateSection(name,values,e);
 if((pack.sections.lineIngress||pack.sections.lineRichMenu)&&!pack.sections.lineCrypto)deny('OPS_LINE_DEPENDENCY_DENIED');
 return true;
}
function prepare(pack,manifest,expected,selected=[],loginOAuth){
 validate(pack,manifest,expected);
 if(!Array.isArray(selected)||new Set(selected).size!==selected.length)deny('OPS_SELECTION_DENIED');
 const env={...OFF};
 for(const name of selected){
  if(typeof name!=='string'||!Object.hasOwn(FIELDS,name)||!Object.hasOwn(pack.sections,name))deny('OPS_SELECTION_DENIED');
  if(LINE.has(name)&&!selected.includes('lineCrypto'))deny('OPS_LINE_SELECTION_DEPENDENCY_DENIED');
  if(name==='googleSheetTrigger'&&(expected.exportWebhookUrl===null||pack.sections[name].CCPUN_N8N_EXPORT_WEBHOOK_URL!==expected.exportWebhookUrl))deny('OPS_WEBHOOK_PIN_DENIED');
  if(name==='googleData'){
   const g=pack.sections.googleData;let id=g.CCPUN_GOOGLE_DATA_CLIENT_ID,secret=g.CCPUN_GOOGLE_DATA_CLIENT_SECRET;
   if(g.reuseLoginOAuthClient){keys(loginOAuth,['AUTH_GOOGLE_ID','AUTH_GOOGLE_SECRET']);text(loginOAuth.AUTH_GOOGLE_ID);text(loginOAuth.AUTH_GOOGLE_SECRET);
    if(g.refreshTokenClientId!==loginOAuth.AUTH_GOOGLE_ID)deny('OPS_REFRESH_CLIENT_BINDING_DENIED');id=loginOAuth.AUTH_GOOGLE_ID;secret=loginOAuth.AUTH_GOOGLE_SECRET;}
   Object.assign(env,{CCPUN_SEO_INTELLIGENCE_ENABLED:'1',CCPUN_GOOGLE_DATA_CLIENT_ID:id,CCPUN_GOOGLE_DATA_CLIENT_SECRET:secret,CCPUN_GOOGLE_DATA_REFRESH_TOKEN:g.CCPUN_GOOGLE_DATA_REFRESH_TOKEN,CCPUN_GSC_SITE_URL:g.CCPUN_GSC_SITE_URL,CCPUN_GA4_PROPERTY_ID:g.CCPUN_GA4_PROPERTY_ID});
  }else Object.assign(env,pack.sections[name]);
  if(name==='socialWorker')env.CCPUN_NEON_ENDPOINT_ID=FIXED.neonEndpointId;
 }
 for(const [flag,group] of Object.entries(FLAG_GROUPS))if(selected.includes(group))env[flag]=pack.activation[flag]?(OFF[flag]==='0'?'1':'true'):OFF[flag];
 return Object.freeze(env);
}
function metadata(s){if(!s.isFile()||s.uid!==0||s.gid!==0||(s.mode&0o7777)!==0o600||s.nlink!==1||s.size<2||s.size>131072)deny('OPS_FILE_METADATA_DENIED');}
function readPrivate(fsApi=fs){
 let fd;
 try{fd=fsApi.openSync('/private/ops.json',fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const before=fsApi.fstatSync(fd);metadata(before);const data=Buffer.alloc(before.size+1);let bytes=0;
  while(bytes<data.length){const n=fsApi.readSync(fd,data,bytes,data.length-bytes,null);if(n===0)break;bytes+=n;}
  const after=fsApi.fstatSync(fd);metadata(after);
  if(bytes!==before.size||before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)deny('OPS_FILE_CHANGED_DENIED');
  try{return parseJson(data.subarray(0,bytes).toString('utf8'));}catch{deny('OPS_JSON_DENIED');}
 }catch(e){if(typeof e.code==='string'&&e.code.startsWith('OPS_'))throw e;deny('OPS_PRIVATE_FILE_UNAVAILABLE');}
 finally{if(fd!==undefined)fsApi.closeSync(fd);}
}
function loadInsideContainer(manifest,expected,selected=[],loginOAuth){
 if(process.platform!=='linux'||process.arch!=='x64'||process.getuid()!==0||!process.version.startsWith('v24.'))deny('OPS_PLATFORM_DENIED');
 return prepare(readPrivate(),manifest,expected,selected,loginOAuth);
}
module.exports=Object.freeze({FIXED,OFF,FIELDS,FLAG_GROUPS,activation,validateSection,validate,prepare,loadInsideContainer,readPrivate,metadata,parseJson});
if(require.main===module)process.exitCode=1; // No standalone credential reader or receiver.
