'use strict';
// SOURCE PREPARATION ONLY. Importing reads no environment, credentials or files.
// An explicit mode is an application guard, NOT owner/provider/security approval.
// Original public capsule SHA256: 3b49c79ea955ba5ba20cd9412e3559091f0ab12ae4e472da2f8de24b1da0d9ca.
// No deployment, outbound HTTP, provider calls, package imports, or Cloud writes.
const crypto = require('node:crypto');
const fs = require('node:fs');
const PROJECT = 'prj_dxwjITkd0av5QiJQv2snUlIASUWu';
const TEAM = 'team_GbcO71LS2dLHwiBV6Cs39Kax';
const PURPOSE = 'ccpun-web-line-production-capsule-20261003';
const RECOVERY_MODE = 'owner-approved-temporary-production-recovery';
const PRIVATE_KEYS = Object.freeze(['CCPUN_LINE_IDENTITY_HMAC_KEY_V1', 'CCPUN_LINE_ENCRYPTION_KEY_V1', 'CCPUN_LINE_ENCRYPTION_KEY_V2', 'CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION', 'LINE_CHANNEL_SECRET', 'CCPUN_LINE_INGEST_DATABASE_URL']);
const CONTROLS = Object.freeze(['CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED', 'CCPUN_LINE_SYSTEM_DELIVERY_ENABLED', 'CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL', 'NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED']);
const CONFIG_KEYS = ['schema','purpose','sourceProject','sourceTeam','sourceLane','sourceRef','originalReleaseSha','originalDeploymentId','reviewedArtifactSha256','destinationOrigin','nonce','issuedAt','expiresAt','publicKeyPem'];
function deny() { throw new Error('CAPSULE_DENIED'); }
function validateMode(mode) { if (mode !== RECOVERY_MODE) deny(); }
function exact(o, keys) {
  if (!o || Object.getPrototypeOf(o) !== Object.prototype || Object.keys(o).sort().join('\0') !== [...keys].sort().join('\0')) deny();
}
function canonical(o) {
  if (Array.isArray(o)) return '[' + o.map(canonical).join(',') + ']';
  if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k)+':'+canonical(o[k])).join(',') + '}';
  return JSON.stringify(o);
}
function hash(o) { return crypto.createHash('sha256').update(canonical(o)).digest('hex'); }
function b64(s, min, max=min) {
  if (typeof s !== 'string' || s.length > 65536 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) deny();
  const b = Buffer.from(s,'base64');
  if (b.toString('base64') !== s || b.length < min || b.length > max) deny();
  return b;
}
function publicKey(pem) {
  if (typeof pem !== 'string' || pem.length > 2000 || !pem.startsWith('-----BEGIN PUBLIC KEY-----\n')) deny();
  const k = crypto.createPublicKey(pem);
  if (k.asymmetricKeyType !== 'rsa' || k.asymmetricKeyDetails?.modulusLength !== 3072 || k.asymmetricKeyDetails.publicExponent !== 65537n) deny();
  return k;
}
function validateConfig(c, now=Date.now()) {
  exact(c, CONFIG_KEYS);
  if (c.schema !== 1 || c.purpose !== PURPOSE || c.sourceProject !== PROJECT || c.sourceTeam !== TEAM || c.sourceLane !== 'production' || c.sourceRef !== 'v4-production' || c.destinationOrigin !== 'https://ccpun.com') deny();
  if (!/^[a-f0-9]{40}$/.test(c.originalReleaseSha) || !/^dpl_[A-Za-z0-9]{8,128}$/.test(c.originalDeploymentId) || !/^[a-f0-9]{64}$/.test(c.reviewedArtifactSha256) || !/^[a-f0-9]{64}$/.test(c.nonce)) deny();
  if (!Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) || c.expiresAt-c.issuedAt !== 600000 || now < c.issuedAt-5000 || now >= c.expiresAt) deny();
  publicKey(c.publicKeyPem);
  return c;
}
function activatePolicy(policy, now=Date.now()) {
  const keys=CONFIG_KEYS.filter(k=>!['nonce','issuedAt','expiresAt'].includes(k));
  exact(policy,keys);
  const c={...policy,nonce:crypto.randomBytes(32).toString('hex'),issuedAt:now,expiresAt:now+600000};
  return validateConfig(c,now); // Call only AFTER code/CI/owner review; not at initial preparation.
}

function deploymentOrigin(s) {
  if (typeof s !== 'string' || s.length > 256) deny();
  const u = new URL(s);
  if (u.protocol !== 'https:' || !/^[a-z0-9][a-z0-9-]{0,180}\.vercel\.app$/.test(u.hostname) || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash) deny();
  return u.origin;
}
function validateRequest(r,c,now) {
  exact(r,['configHash','deploymentOrigin','nonce','issuedAt','expiresAt','signature']);
  if (r.configHash !== hash(c) || r.nonce !== c.nonce || !Number.isSafeInteger(r.issuedAt) || !Number.isSafeInteger(r.expiresAt) || r.expiresAt-r.issuedAt !== 60000 || r.expiresAt > c.expiresAt || r.issuedAt < c.issuedAt || now < r.issuedAt-5000 || now >= r.expiresAt) deny();
  deploymentOrigin(r.deploymentOrigin);
  const unsigned={...r}; delete unsigned.signature;
  const signature=b64(r.signature,384);
  if (!crypto.verify('sha256',Buffer.from(canonical(unsigned)),{key:publicKey(c.publicKeyPem),padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32},signature)) deny();
  return unsigned;
}
function validateValues(v) {
  exact(v, [...PRIVATE_KEYS,...CONTROLS]);
  b64(v.CCPUN_LINE_IDENTITY_HMAC_KEY_V1,32,128);
  // Existing Production V2 records require the original V2 key, even if active=1.
  b64(v.CCPUN_LINE_ENCRYPTION_KEY_V2,32);
  for (const key of PRIVATE_KEYS.slice(1,3)) if (v[key] !== null) b64(v[key],32);
  if (!['1','2'].includes(v.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION) || v['CCPUN_LINE_ENCRYPTION_KEY_V'+v.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION] === null) deny();
  if (typeof v.LINE_CHANNEL_SECRET !== 'string' || !/^[a-f0-9]{32}$/i.test(v.LINE_CHANNEL_SECRET)) deny();
  if (typeof v.CCPUN_LINE_INGEST_DATABASE_URL !== 'string' || v.CCPUN_LINE_INGEST_DATABASE_URL.length > 4096 || /[\x00-\x20\x7f]/.test(v.CCPUN_LINE_INGEST_DATABASE_URL)) deny();
  const u=new URL(v.CCPUN_LINE_INGEST_DATABASE_URL);
  const hosts=['ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech','ep-broad-butterfly-b3ro7u8w-pooler.c-4.ap-southeast-1.aws.neon.tech'];
  if (u.protocol !== 'postgresql:' || !hosts.includes(u.hostname) || u.port || u.hash || decodeURIComponent(u.username) !== 'ccpun_line_ingress' || !u.password || decodeURIComponent(u.pathname.slice(1)) !== 'neondb') deny();
  if ([...u.searchParams.keys()].some(k => !['sslmode','channel_binding'].includes(k)) || u.searchParams.getAll('sslmode').length !== 1 || u.searchParams.get('sslmode') !== 'require' || u.searchParams.getAll('channel_binding').length > 1 || (u.searchParams.has('channel_binding') && u.searchParams.get('channel_binding') !== 'require')) deny();
  for (const key of ['CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED','CCPUN_LINE_SYSTEM_DELIVERY_ENABLED','NEXT_PUBLIC_SEMANTIC_EVENT_LAYER_ENABLED']) if (v[key] !== null && !['true','false'].includes(v[key])) deny();
  if (v.CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL !== null && v.CCPUN_LINE_SYSTEM_DELIVERY_ADMIN_URL !== 'https://admin.ccpun.com/api/internal/line/system-delivery/dispatch/') deny();
  if (v.CCPUN_LINE_LAZY_KEY_ROTATION_ENABLED === 'true' && (v.CCPUN_LINE_ACTIVE_ENCRYPTION_KEY_VERSION !== '2' || v.CCPUN_LINE_ENCRYPTION_KEY_V1 === null || v.CCPUN_LINE_ENCRYPTION_KEY_V2 === null)) deny();
  // Original Production code uses this same fixed dispatch URL when unset; preserve absence.
  return v;
}
function collectValues(env,c,origin,host) {
  // Legacy adapter: automatic project => Vercel/web; Production => Production lane.
  // Do NOT assert missing neutral identities or that artifact Git SHA is old release SHA.
  const required={VERCEL_ENV:'production',VERCEL_PROJECT_ID:PROJECT,NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production'};
  for (const [key,value] of Object.entries(required)) if (env[key] !== value) deny();
  const optional={CCPUN_DEPLOYMENT_PROVIDER:'vercel',CCPUN_DEPLOYMENT_ROLE:'web',CCPUN_APP_ENV:'production',NEXT_PUBLIC_CCPUN_APP_ENV:'production',CCPUN_UAT_MODE:'0',CCPUN_GIT_REF:'v4-production',CCPUN_GIT_SHA:c.originalReleaseSha,CCPUN_LINE_NEON_PROJECT_ID:'lively-bar-43618798',CCPUN_LINE_NEON_BRANCH_ID:'br-long-resonance-b3ys5xrv',CCPUN_LINE_NEON_DATABASE:'neondb'};
  for (const [key,value] of Object.entries(optional)) {
    const actual=env[key]?.trim();
    if(actual && actual !== value) deny();
  }
  // Original adapter only uses automatic Git fallback for release provenance;
  // a newly staged artifact has DIFFERENT Git metadata. That is not original-release proof.
  for(const key of ['VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA']) {
    if(env[key] !== undefined && (typeof env[key] !== 'string' || env[key].length>256 || /[\x00-\x1f\x7f]/.test(env[key]))) deny();
  }
  if (typeof env.VERCEL_URL !== 'string' || deploymentOrigin('https://'+env.VERCEL_URL) !== origin || host !== env.VERCEL_URL) deny();
  const v={};
  for (const key of [...PRIVATE_KEYS,...CONTROLS]) v[key] = env[key] === undefined || env[key] === '' ? null : env[key];
  return validateValues(v);
}
function aad(c,r) { return Buffer.from(canonical({purpose:PURPOSE,configHash:hash(c),request:r})); }
function seal(c,r,v) {
  const key=crypto.randomBytes(32), iv=crypto.randomBytes(12);
  let plain;
  try {
    plain=Buffer.from(canonical({schema:1,values:validateValues(v)}));
    const cipher=crypto.createCipheriv('aes-256-gcm',key,iv); cipher.setAAD(aad(c,r));
    const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
    const wrapped=crypto.publicEncrypt({key:publicKey(c.publicKeyPem),oaepHash:'sha256',oaepLabel:Buffer.from(PURPOSE),padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},key);
    return {schema:1,configHash:hash(c),request:r,wrappedKey:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  } finally { key.fill(0); if(plain) plain.fill(0); }
}
function createHandler(c, deps) {
  // No default environment access here: production template injects only at invocation.
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive'); res.setHeader('Content-Type','application/json');
    try {
      validateMode(deps.recoveryMode);
      const now=deps.now(); validateConfig(c,now);
      if(req.method !== 'POST' || req.url !== '/recovery' || req.headers['content-type'] !== 'application/json' || !/^\d{1,5}$/.test(String(req.headers['content-length']||'')) || Number(req.headers['content-length'])>4096) deny();
      // Build Output launcher helpers are disabled; consume bounded raw request.
      const chunks=[]; let size=0;
      for await (const chunk of req) { size+=chunk.length; if(size>4096) deny(); chunks.push(chunk); }
      if(size !== Number(req.headers['content-length'])) deny();
      const r=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const unsigned=validateRequest(r,c,now);
      const v=collectValues(deps.env(),c,unsigned.deploymentOrigin,req.headers.host);
      res.statusCode=200; res.end(JSON.stringify(seal(c,unsigned,v)));
    } catch { res.statusCode=403; res.end('{"status":"CAPSULE_DENIED"}'); }
  };
}
function signRequest(c,origin,privateKey,now=Date.now()) {
  validateConfig(c,now);
  const unsigned={configHash:hash(c),deploymentOrigin:deploymentOrigin(origin),nonce:c.nonce,issuedAt:now,expiresAt:now+60000};
  if(unsigned.expiresAt>c.expiresAt) deny();
  return {...unsigned,signature:crypto.sign('sha256',Buffer.from(canonical(unsigned)),{key:privateKey,padding:crypto.constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64')};
}
function openCapsule(e,c,signedRequest,privateKey,now=Date.now()) {
  validateConfig(c,now); const r=validateRequest(signedRequest,c,now);
  exact(e,['schema','configHash','request','wrappedKey','iv','tag','ciphertext']);
  if(e.schema !== 1 || e.configHash !== hash(c) || canonical(e.request)!==canonical(r)) deny();
  const wrapped=b64(e.wrappedKey,384),iv=b64(e.iv,12),tag=b64(e.tag,16),ciphertext=b64(e.ciphertext,1,16384);
  let key,plain;
  try {
    key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256',oaepLabel:Buffer.from(PURPOSE),padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},wrapped);
    if(key.length!==32) deny();
    const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv); decipher.setAAD(aad(c,r)); decipher.setAuthTag(tag);
    plain=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
    const p=JSON.parse(plain.toString('utf8')); exact(p,['schema','values']); if(p.schema!==1) deny();
    return validateValues(p.values); // RAM only. Caller MUST NOT print, serialize to disk or tool output.
  } finally { if(key) key.fill(0); if(plain) plain.fill(0); }
}
function acceptOnce(e,c,request,privateKey,intentPath,now=Date.now()) {
  if(typeof intentPath!=='string' || !new RegExp('^/private/tmp/ccpun-web-line-capsule-intent-'+c.nonce+'\\.json$').test(intentPath)) deny();
  const values=openCapsule(e,c,request,privateKey,now);
  // Exclusive durable public intent BEFORE releasing values to a sink. Never retry a used nonce.
  const fd=fs.openSync(intentPath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try { fs.writeFileSync(fd,JSON.stringify({schema:1,purpose:PURPOSE,nonce:c.nonce,configHash:hash(c),state:'CAPSULE_ACCEPTED_SINK_NOT_EXECUTED'})); fs.fsyncSync(fd); } finally {fs.closeSync(fd);}
  const dir=fs.openSync('/private/tmp',fs.constants.O_RDONLY); try {fs.fsyncSync(dir);} finally{fs.closeSync(dir);}
  return values; // Does not execute destination writes. Separate reviewed preserve-all sink required.
}
function artifactFiles(c,now=Date.now(),mode) {
  validateMode(mode); validateConfig(c,now);
  // Public artifact only; no reading credentials/env/source app or creating files.
  const functionCore=[deny,validateMode,exact,canonical,hash,b64,publicKey,validateConfig,deploymentOrigin,validateRequest,validateValues,collectValues,aad,seal,createHandler].map(f=>f.toString()).join('\n');
  const handler="'use strict';\nconst crypto=require('node:crypto');\nconst PROJECT="+JSON.stringify(PROJECT)+",TEAM="+JSON.stringify(TEAM)+",PURPOSE="+JSON.stringify(PURPOSE)+",RECOVERY_MODE="+JSON.stringify(RECOVERY_MODE)+",PRIVATE_KEYS="+JSON.stringify(PRIVATE_KEYS)+",CONTROLS="+JSON.stringify(CONTROLS)+",CONFIG_KEYS="+JSON.stringify(CONFIG_KEYS)+";\n"+functionCore+'\nconst CONFIG='+JSON.stringify(c)+';\nmodule.exports=createHandler(CONFIG,{now:()=>Date.now(),env:()=>process.env,recoveryMode:RECOVERY_MODE});\n';
  return {
    '.vercel/project.json': JSON.stringify({projectId:PROJECT,orgId:TEAM}),
    '.vercel/output/config.json': JSON.stringify({version:3}),
    '.vercel/output/functions/recovery.func/.vc-config.json':JSON.stringify({runtime:'nodejs24.x',handler:'index.cjs',maxDuration:5,launcherType:'Nodejs',shouldAddHelpers:false,shouldAddSourcemapSupport:false}),
    '.vercel/output/functions/recovery.func/index.cjs':handler
  };
}
module.exports={PROJECT,TEAM,PURPOSE,RECOVERY_MODE,PRIVATE_KEYS,CONTROLS,validateConfig,activatePolicy,validateValues,collectValues,createHandler,signRequest,openCapsule,acceptOnce,artifactFiles,hash};

// Direct CLI execution cannot activate, collect, generate or send anything.
if(require.main===module){process.stderr.write('WEB_LINE_RECOVERY_SOURCE_ONLY_NO_RUNTIME_ACTIVATION\n');process.exitCode=1;}
