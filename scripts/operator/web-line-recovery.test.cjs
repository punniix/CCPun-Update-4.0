'use strict';
// Original 36 synthetic checks plus seven necessary recovery guard checks.
// Synthetic fixtures only. No live env, auth, HTTP, DB, files/claims or deployment.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node synthetic check for the CommonJS operator.
const assert=require('node:assert/strict');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node synthetic check for the CommonJS operator.
const crypto=require('node:crypto');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node synthetic check for the CommonJS operator.
const fs=require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node synthetic check for the CommonJS operator.
const {Readable}=require('node:stream');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node synthetic check for the CommonJS operator.
const api=require('./web-line-recovery.cjs');
const now=1900000000000;
const pair=crypto.generateKeyPairSync('rsa',{modulusLength:3072});
const c={schema:1,purpose:api.PURPOSE,sourceProject:api.PROJECT,sourceTeam:api.TEAM,sourceLane:'production',sourceRef:'v4-production',originalReleaseSha:'db4d30c7bcc91f1ac379c2256f69d83aad2d2da9',originalDeploymentId:'dpl_OfflineOriginalFixture',reviewedArtifactSha256:'a'.repeat(64),destinationOrigin:'https://ccpun.com',nonce:crypto.randomBytes(32).toString('hex'),issuedAt:now,expiresAt:now+600000,publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'})};
const origin='https://ccpun-web-offline-fixture.vercel.app';
const env={VERCEL_ENV:'production',VERCEL_PROJECT_ID:api.PROJECT,VERCEL_URL:origin.slice(8),CCPUN_DEPLOYMENT_PROVIDER:'vercel',CCPUN_DEPLOYMENT_ROLE:'web',CCPUN_APP_ENV:'production',NEXT_PUBLIC_CCPUN_APP_ENV:'production',CCPUN_GIT_REF:'v4-production',CCPUN_GIT_SHA:c.originalReleaseSha,NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production',CCPUN_UAT_MODE:'0',CCPUN_LINE_NEON_PROJECT_ID:'lively-bar-43618798',CCPUN_LINE_NEON_BRANCH_ID:'br-long-resonance-b3ys5xrv',CCPUN_LINE_NEON_DATABASE:'neondb',CCPUN_LINE_IDENTITY_HMAC_KEY_V1:crypto.randomBytes(32).toString('base64'),CCPUN_LINE_ENCRYPTION_KEY_V1:crypto.randomBytes(32).toString('base64'),CCPUN_LINE_ENCRYPTION_KEY_V2:crypto.randomBytes(32).toString('base64'),CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION:'2',LINE_CHANNEL_SECRET:'abcdef0123456789abcdef0123456789',CCPUN_LINE_INGEST_DATABASE_URL:'postgresql://ccpun_line_ingress:OFFLINE_ONLY_SECRET_CANARY@ep-broad-butterfly-b3ro7u8w-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'true',CCPUN_LINE_SYSTEM_DELIVERY_ENABLED:'true',CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL:'https://admin.ccpun.com/api/internal/line/system-delivery/dispatch/',NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED:'true'};
const request=api.signRequest(c,origin,pair.privateKey,now);
async function invoke(handler, body=request, overrides={}) {
 const raw=Buffer.from(JSON.stringify(body));
 const req=Readable.from([raw]); Object.assign(req,{method:'POST',url:'/recovery',headers:{host:origin.slice(8),'content-type':'application/json','content-length':String(raw.length)}},overrides);
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(b){this.body=b;}};
 await handler(req,res); return res;
}
function changedRequest(changes) {return {...request,...changes};}
function expectDenied(result) { assert.equal(result.statusCode,403); assert.equal(result.body,'{"status":"CAPSULE_DENIED"}'); }
(async()=>{
 let checks=0, reads=0;
 const h=api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>{reads++;return env;}});
 const good=await invoke(h); assert.equal(good.statusCode,200);checks++;
 assert.equal(good.headers['Cache-Control'],'no-store');assert.match(good.headers['X-Robots-Tag'],/noindex/);checks++;
 for(const key of api.PRIVATE_KEYS.filter(k=>k!=='CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION')) assert.ok(!good.body.includes(env[key]));
 assert.ok(!good.body.includes('OFFLINE_ONLY_SECRET_CANARY'));checks++;
 const envelope=JSON.parse(good.body), recovered=api.openCapsule(envelope,c,request,pair.privateKey,now);
 assert.equal(recovered.CCPUN_LINE_INGEST_DATABASE_URL,env.CCPUN_LINE_INGEST_DATABASE_URL);checks++;
 expectDenied(await invoke(h,changedRequest({signature:crypto.randomBytes(384).toString('base64')}))); assert.equal(reads,1);checks++;
 expectDenied(await invoke(h,changedRequest({deploymentOrigin:'https://ccpun-web-other.vercel.app'})));checks++;
 expectDenied(await invoke(h,request,{headers:{host:'ccpun.com','content-type':'application/json','content-length':String(Buffer.byteLength(JSON.stringify(request)))}}));checks++;
 expectDenied(await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now+60001,env:()=>env})));checks++;
 expectDenied(await invoke(h,request,{method:'GET'}));checks++;
 for(const [key,value] of [['VERCEL_ENV','preview'],['VERCEL_PROJECT_ID','prj_wrong'],['CCPUN_APP_ENV','web-uat'],['CCPUN_GIT_SHA','0'.repeat(40)],['NEXT_PUBLIC_SANITY_PROJECT_ID','ccb9lnw5'],['CCPUN_LINE_NEON_BRANCH_ID','br-crimson-mouse-az7ajkv8'],['CCPUN_LINE_INGEST_DATABASE_URL',env.CCPUN_LINE_INGEST_DATABASE_URL.replace('ccpun_line_ingress:','neondb_owner:')],['CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL','https://attacker.example'],['CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED','1'],['LINE_CHANNEL_SECRET','bad-format']]) {
   expectDenied(await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>({...env,[key]:value})})));checks++;
 }
 assert.throws(()=>api.openCapsule({...envelope,tag:crypto.randomBytes(16).toString('base64')},c,request,pair.privateKey,now));checks++;
 assert.throws(()=>api.validateConfig({...c,destinationOrigin:'https://test.ccpun.com'},now));checks++;
 const other=crypto.generateKeyPairSync('rsa',{modulusLength:3072});
 assert.throws(()=>api.openCapsule(envelope,c,request,other.privateKey,now));checks++;
 const legacy={...env,VERCEL_GIT_COMMIT_REF:'reviewed-recovery-artifact',VERCEL_GIT_COMMIT_SHA:'f'.repeat(40)};
 for(const key of ['CCPUN_DEPLOYMENT_PROVIDER','CCPUN_DEPLOYMENT_ROLE','CCPUN_GIT_REF','CCPUN_GIT_SHA','NEXT_PUBLIC_CCPUN_APP_ENV','CCPUN_UAT_MODE']) delete legacy[key];
 const legacyResponse=await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>legacy}));
 assert.equal(legacyResponse.statusCode,200); assert.equal(api.openCapsule(JSON.parse(legacyResponse.body),c,request,pair.privateKey,now).LINE_CHANNEL_SECRET,env.LINE_CHANNEL_SECRET);checks++;
 expectDenied(await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>({...legacy,CCPUN_DEPLOYMENT_PROVIDER:'hostinger'})})));checks++;
 expectDenied(await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>({...legacy,CCPUN_DEPLOYMENT_ROLE:'admin'})})));checks++;
 expectDenied(await invoke(api.createHandler(c,{recoveryMode:api.RECOVERY_MODE,now:()=>now,env:()=>({...legacy,CCPUN_UAT_MODE:'1'})})));checks++;
 const policy={...c}; for(const key of ['nonce','issuedAt','expiresAt']) delete policy[key];
 const activated=api.activatePolicy(policy,now+86400000);
 assert.equal(activated.issuedAt,now+86400000);assert.equal(activated.expiresAt,now+86400000+600000);checks++;
 const optional={...recovered,CCPUN_LINE_ENCRYPTION_KEY_V1:null,CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'false',CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL:null};
 assert.equal(api.validateValues(optional).CCPUN_LINE_ENCRYPTION_KEY_V1,null);checks++;
 assert.throws(()=>api.validateValues({...optional,CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'true'}));checks++;
 assert.throws(()=>api.validateValues({...recovered,NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED:'1'}));checks++;
 assert.throws(()=>api.validateValues({...recovered,CCPUN_LINE_ENCRYPTION_KEY_V2:null}));checks++;
 assert.throws(()=>api.validateValues({...recovered,CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION:'1',CCPUN_LINE_ENCRYPTION_KEY_V2:null,CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED:'false'}));checks++;
 assert.throws(()=>api.validateValues({...recovered,CCPUN_LINE_IDENTITY_HMAC_KEY_V1:null}));checks++;
 for(const uri of [env.CCPUN_LINE_INGEST_DATABASE_URL.replace('ccpun_line_ingress:','ccpun_admin_runtime:'),env.CCPUN_LINE_INGEST_DATABASE_URL.replace('sslmode=require','sslmode=disable')]) {assert.throws(()=>api.validateValues({...recovered,CCPUN_LINE_INGEST_DATABASE_URL:uri}));checks++;}
 let disabledReads=0;
 expectDenied(await invoke(api.createHandler(c,{now:()=>now,env:()=>{disabledReads++;return env;}})));assert.equal(disabledReads,0);checks++;
 assert.throws(()=>api.artifactFiles(c,now));checks++;
 // In-memory journal fixture only: never create a capsule claim/file anywhere.
 const intent='/private/tmp/ccpun-web-line-capsule-intent-'+c.nonce+'.json';let claimed=false,receipt='';
 const saved=Object.fromEntries(['openSync','writeFileSync','fsyncSync','closeSync'].map(k=>[k,fs[k]]));
 fs.openSync=(p,flags)=>{if(p==='/private/tmp'){assert.equal(flags,fs.constants.O_RDONLY);return 102;}assert.equal(p,intent);assert.ok(flags&fs.constants.O_EXCL);assert.ok(flags&fs.constants.O_NOFOLLOW);if(claimed)throw Error('EEXIST');claimed=true;return 101;};
 fs.writeFileSync=(fd,value)=>{assert.equal(fd,101);receipt=String(value);};
 fs.fsyncSync=fs.closeSync=fd=>assert.ok([101,102].includes(fd));
 try {
   const accepted=api.acceptOnce(envelope,c,request,pair.privateKey,intent,now);assert.equal(accepted.LINE_CHANNEL_SECRET,env.LINE_CHANNEL_SECRET);checks++;
   assert.ok(!receipt.includes('OFFLINE_ONLY_SECRET_CANARY'));assert.ok(!receipt.includes(env.LINE_CHANNEL_SECRET));checks++;
   assert.throws(()=>api.acceptOnce(envelope,c,request,pair.privateKey,intent,now));checks++;
 } finally {Object.assign(fs,saved);}
 const files=api.artifactFiles(c,now,api.RECOVERY_MODE);
 assert.equal(Object.keys(files).length,4);
 const cfg=JSON.parse(files['.vercel/output/functions/recovery.func/.vc-config.json']);assert.equal(cfg.runtime,'nodejs24.x');assert.equal(cfg.environment,undefined);assert.equal(cfg.shouldAddHelpers,false);checks++;
 // Compile and invoke generated handler with injected synthetic env/time only.
 const mod={exports:{}};
 new Function('require','module','process','Date',files['.vercel/output/functions/recovery.func/index.cjs'])(require,mod,{env},{now:()=>now});
 const generated=await invoke(mod.exports); assert.equal(generated.statusCode,200); assert.equal(api.openCapsule(JSON.parse(generated.body),c,request,pair.privateKey,now).LINE_CHANNEL_SECRET,env.LINE_CHANNEL_SECRET);checks++;
 for(const text of Object.values(files)) {
   assert.ok(!text.includes('OFFLINE_ONLY_SECRET_CANARY'));
   assert.ok(!text.includes(env.CCPUN_LINE_IDENTITY_HMAC_KEY_V1));
   assert.ok(!/fetch\(|https\.request|console\.|eval\(/.test(text));
 }
 checks++;
 process.stdout.write(JSON.stringify({offline:true,passed:true,checks,sourceReads:false,providerCalls:false,deployed:false})+'\n');
})().catch(()=>{process.stderr.write('OFFLINE_CHECK_FAILED\n');process.exitCode=1;});
