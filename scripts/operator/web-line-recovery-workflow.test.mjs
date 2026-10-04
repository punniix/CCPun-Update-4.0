import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const text=fs.readFileSync(new URL('../../.github/workflows/line-key-recovery-once.yml',import.meta.url),'utf8');
const block=text.split('// CONTRACT_START')[1]?.split('\n').slice(1).join('\n').split('// CONTRACT_END')[0];
assert.ok(block,'workflow contract missing');
const context={};vm.runInNewContext(block+'\nthis.guards={packetGuard,dispatchDeadline,projectGuard,deploymentGuard,aliasGuard,domainsGuard};',context);
const {packetGuard,dispatchDeadline,projectGuard,deploymentGuard,aliasGuard,domainsGuard}=context.guards;
const now=1000000,sha='a'.repeat(40),nonce='b'.repeat(64),origin='https://capsule-offline.vercel.app';
const project={id:'prj_dxwjITkd0av5QiJQv2snUlIASUWu',accountId:'team_GbcO71LS2dLHwiBV6Cs39Kax',link:null,rootDirectory:null,nodeVersion:'24.x'};
const deployment={id:'dpl_OFFLINE123456',projectId:project.id,target:'production',readyState:'READY',url:origin.slice(8),aliasAssigned:false,alias:[],meta:{ccpunRecoveryNonce:nonce}};
test('default dispatch cannot authorize execution; no automatic trigger',()=>{
 assert.match(text,/default: 'HOLD'/);assert.match(text,/workflow_dispatch:/);assert.doesNotMatch(text,/^  (push|pull_request|schedule):/m);
 assert.match(text,/cancel-in-progress: false/);assert.match(text,/timeout-minutes: 20/);
});
test('exact scoped public packet rejects expired or stale fence observations',()=>{
 const p={reviewedSha:sha,approvalExpiresAt:now+600000,cloudBaselineSha256:'c'.repeat(64),policy:{},fences:{observedAt:now,cronJobsEmpty:true,workflowJobsEmpty:true,gitDisconnected:true,wafDenyExceptRecovery:true}};
 assert.doesNotThrow(()=>packetGuard(p,sha,now));
 for(const bad of [{...p,approvalExpiresAt:now},{...p,reviewedSha:'d'.repeat(40)},{...p,fences:{...p.fences,wafDenyExceptRecovery:false}},{...p,fences:{...p.fences,observedAt:now-300001}}]) assert.throws(()=>packetGuard(bad,sha,now),/HOLD_PUBLIC_CONTRACT/);
});
test('missing metadata and connector wrappers cannot establish source ownership',()=>{
 assert.doesNotThrow(()=>projectGuard(project));
 for(const p of [{result:project},{...project,accountId:undefined},{...project,link:{}},{...project,rootDirectory:undefined}]) assert.throws(()=>projectGuard(p));
 assert.doesNotThrow(()=>deploymentGuard(deployment,origin,nonce));
 for(const d of [{deployment},{...deployment,projectId:undefined},{...deployment,alias:['ccpun.com']},{...deployment,target:'preview'},{...deployment,meta:{ccpunRecoveryNonce:'wrong'}}]) assert.throws(()=>deploymentGuard(d,origin,nonce));
 assert.throws(()=>aliasGuard({alias:'ccpun.com'},'ccpun.com'));
 const domains={domains:[{name:'ccpun-web-punniixs-projects.vercel.app'},{name:'ccpun-web-git-v4-production-punniixs-projects.vercel.app'}],pagination:{next:null}};
 assert.doesNotThrow(()=>domainsGuard(domains));
 assert.throws(()=>domainsGuard({...domains,pagination:{next:123}}));
 assert.throws(()=>domainsGuard({...domains,domains:[...domains.domains,{name:'ccpun.com'}]}));
});
test('one function/noalias/token environment and exact owned cleanup are retained',()=>{
 assert.match(text,/--prebuilt.*--prod.*--skip-domain/);assert.match(text,/VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
 assert.doesNotMatch(text,/['"]--(token|env|build-env|logs|debug|public)['"]/);
 assert.doesNotMatch(text,/child\(\[['"](promote|alias|curl|login|pull)['"]/);
 assert.match(text,/api\('\/v13\/deployments\/\'\+deploymentId,'DELETE'\)/);
 assert.match(text,/d\.meta\?\.ccpunRecoveryNonce!==nonce/);
 assert.match(text,/No unpause, WAF, cron, Git, protection or project-setting mutations/);
});
test('every inline Node block parses without running auth/API/runtime code',()=>{
 const blocks=[...text.matchAll(/          node --input-type=module <<'NODE'\n([\s\S]*?)          NODE/g)].map(m=>m[1].split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n'));
 assert.equal(blocks.length,4);
 for(const input of blocks){const r=spawnSync(process.execPath,['--input-type=module','--check'],{input,encoding:'utf8'});assert.equal(r.status,0,'inline source syntax');}
});
test('dispatch revalidates expired permission/fences and reserves both lifetimes',()=>{
 const p={reviewedSha:sha,approvalExpiresAt:now+600000,cloudBaselineSha256:'c'.repeat(64),policy:{},fences:{observedAt:now,cronJobsEmpty:true,workflowJobsEmpty:true,gitDisconnected:true,wafDenyExceptRecovery:true}};
 assert.equal(dispatchDeadline(p,{expiresAt:now+600000},sha,now),now+180000);
 assert.equal(dispatchDeadline({...p,approvalExpiresAt:now+150000},{expiresAt:now+600000},sha,now),now+145000);
 assert.equal(dispatchDeadline(p,{expiresAt:now+150000},sha,now),now+90000);
 assert.throws(()=>dispatchDeadline(p,{expiresAt:now+600000},sha,now+600000));
 assert.throws(()=>dispatchDeadline(p,{expiresAt:now+600000},sha,now+300001));
 assert.throws(()=>dispatchDeadline(p,{expiresAt:now+119999},sha,now));
 assert.match(text,/const deadline=dispatchDeadline\(p,config,sha,Date\.now\(\)\);\n\s*const result=await child\(/);
 assert.match(text,/const timer=setTimeout\(stop,remaining\)/);
});
test('cleanup creates three distinct HTTP deadlines after expiry wait',async()=>{
 const cleanup=text.split('- name: Expire session')[1];
 const expression=cleanup.match(/const request=\(method='GET'\)=>fetch\(base,\{method,headers,redirect:'error',signal:AbortSignal\.timeout\(20000\)\}\);/)?.[0];
 assert.ok(expression,'fresh request factory required');
 assert.ok(cleanup.indexOf(expression)>cleanup.indexOf('while(Date.now()<expiry)'));
 assert.doesNotMatch(cleanup,/const options=.*AbortSignal\.timeout/);
 let n=0;const calls=[];const c={base:'https://offline.invalid',headers:{},AbortSignal:{timeout(ms){assert.equal(ms,20000);return {id:++n};}},fetch:async(_url,o)=>{calls.push(o.signal.id);return {};}};
 vm.runInNewContext(expression+'this.request=request;',c);
 await c.request();await c.request('DELETE');await c.request();
 assert.deepEqual(calls,[1,2,3]);
});
