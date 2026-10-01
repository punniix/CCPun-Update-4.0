#!/usr/bin/env node
'use strict';
// Operator-only, no network service. Inputs after preparation are public ciphertext and
// independently captured canonical owner-authenticated TLS/deployment proof, never secrets.
const crypto = require('node:crypto'); // eslint-disable-line @typescript-eslint/no-require-imports -- Native standalone CommonJS operator, no package loader.
const { Script } = require('node:vm'); // eslint-disable-line @typescript-eslint/no-require-imports -- Compile only exact hash-checked public bytes.
const fs = require('node:fs'); // eslint-disable-line @typescript-eslint/no-require-imports -- Native standalone CommonJS operator, no package loader.
const TARGET_SHA = 'bc76ef4f771311abe068a0c2df1e6ac1451826f2';
const LOCK = '96a9011823170ed2953e12b300d6ec039df81de9b548f0848af370a5bb8783cf';
const PROJECT = 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN';
const CONSUMER_SHA = '58552593e60783f3dc9d45a29828ed6fdef5bde2e93ae360b32bef9f90c0a2ca';
let consumer;
const CAPABILITIES = Object.freeze(['cronAuth','socialWorker','agentCallbacks','exportCallbacks','googleSheetTrigger','lineCrypto','lineIngress','lineRichMenu','driveInteractive','localAiCrypto','localAiCallbacks']);
const PRIVATE_DIR = '/private-ops-transfer';
const STAGE_DIR = '/stage-ops-transfer';
const KEY = PRIVATE_DIR + '/recipient.pem';
const PROFILE = PRIVATE_DIR + '/recipient.json';
const CLAIM = PRIVATE_DIR + '/accepted.json';
const TARGET = STAGE_DIR + '/production-admin-ops-bc76ef4f.json';
const BUILD_CONFIG = STAGE_DIR + '/drive-public-build-config.json';
const MANIFEST = '/operator/ccpun-native-admin-manifest.json';
function demand(value) { if (!value) throw new Error('MIGRATION_RECIPIENT_DENIED'); }
function exact(value, keys) {
  demand(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|'));
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function decode(value, size) {
  demand(typeof value === 'string' && value.length <= 131072 && /^[A-Za-z0-9+/]*={0,2}$/.test(value));
  const bytes = Buffer.from(value, 'base64');
  demand(bytes.toString('base64') === value && (size === undefined || bytes.length === size));
  return bytes;
}
function validateProfile(profile) {
  exact(profile, ['schemaVersion','transferId','recipientFingerprint','recipientPublicKeyPem','preparedAt','profileExpiresAt','targetSha','lockSha256']);
  demand(profile.schemaVersion === 1 && /^[a-f0-9]{32}$/.test(profile.transferId)
    && /^[a-f0-9]{64}$/.test(profile.recipientFingerprint) && profile.targetSha===TARGET_SHA && profile.lockSha256===LOCK
    && Number.isSafeInteger(profile.preparedAt) && Number.isSafeInteger(profile.profileExpiresAt)
    && profile.profileExpiresAt>profile.preparedAt && profile.profileExpiresAt-profile.preparedAt<=86400);
  const key = crypto.createPublicKey(profile.recipientPublicKeyPem);
  demand(key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails.modulusLength === 3072
    && hash(key.export({type:'spki',format:'der'})) === profile.recipientFingerprint);
}
function validateEnvelope(serialized, proof, profile, now) {
  validateProfile(profile);
  exact(proof, ['cipherSha256','exporterSha','deploymentHost','sourceProjectId','sourceRef','canonicalOrigin','ownerAuthenticated','tlsVerified','recipientFingerprint']);
  demand(typeof serialized === 'string' && Buffer.byteLength(serialized) <= 98304
    && /^[a-f0-9]{64}$/.test(proof.cipherSha256) && hash(serialized) === proof.cipherSha256
    && /^[a-f0-9]{40}$/.test(proof.exporterSha) && /^[a-z0-9-]+\.vercel\.app$/.test(proof.deploymentHost)
    && proof.sourceProjectId === PROJECT && proof.sourceRef === 'v4-production'
    && proof.canonicalOrigin === 'https://admin.ccpun.com'
    && proof.ownerAuthenticated === true && proof.tlsVerified === true
    && proof.recipientFingerprint === profile.recipientFingerprint);
  const envelope = consumer.parseJson(serialized);
  exact(envelope, ['metadata','wrappedKey','iv','tag','ciphertext']);
  const m = envelope.metadata;
  // Reconstruct canonical AAD order; never trust arbitrary envelope metadata/order.
  exact(m, ['schemaVersion','kind','transferId','recipientFingerprint','sourceProjectId','sourceRef','exporterSha','deploymentHost','targetSha','lockSha256','issuedAt','expiresAt']);
  demand(m.schemaVersion === 1 && m.kind === 'ccpun-ops-migration'
    && m.transferId === profile.transferId && m.recipientFingerprint === profile.recipientFingerprint
    && m.sourceProjectId === PROJECT && m.sourceRef === 'v4-production'
    && m.exporterSha === proof.exporterSha && m.deploymentHost === proof.deploymentHost
    && m.targetSha === TARGET_SHA && m.lockSha256 === LOCK
    && Number.isSafeInteger(m.issuedAt) && Number.isSafeInteger(m.expiresAt)
    && m.issuedAt <= now && now < m.expiresAt && m.expiresAt > m.issuedAt
    && m.expiresAt - m.issuedAt <= 900 && profile.preparedAt<=m.issuedAt && m.expiresAt<=profile.profileExpiresAt);
  const metadata = {schemaVersion:1,kind:m.kind,transferId:m.transferId,recipientFingerprint:m.recipientFingerprint,
    sourceProjectId:PROJECT,sourceRef:'v4-production',exporterSha:m.exporterSha,deploymentHost:m.deploymentHost,
    targetSha:TARGET_SHA,lockSha256:LOCK,issuedAt:m.issuedAt,expiresAt:m.expiresAt};
  return { metadata, wrappedKey:decode(envelope.wrappedKey,384), iv:decode(envelope.iv,12),
    tag:decode(envelope.tag,16), ciphertext:decode(envelope.ciphertext) };
}
function pack(values) {
  exact(values,['sections','activation']);
  demand(values.sections && typeof values.sections==='object' && !Array.isArray(values.sections));
  demand(Object.keys(values.sections).length>0 && Object.keys(values.sections).every(name=>CAPABILITIES.includes(name)));
  const expected={gitSha:TARGET_SHA,lockSha256:LOCK,releaseId:'ccpun-native-admin-production-build-bc76ef4f-20261001',exportWebhookUrl:null};
  for(const [name,value] of Object.entries(values.sections))consumer.validateSection(name,value,expected);
  consumer.activation(values.activation);
  for(const [flag,group] of Object.entries(consumer.FLAG_GROUPS))if(values.activation[flag])demand(values.sections[group]);
  if(values.sections.lineIngress||values.sections.lineRichMenu)demand(values.sections.lineCrypto);
  return {schemaVersion:1,...consumer.FIXED,gitSha:TARGET_SHA,lockSha256:LOCK,sections:values.sections,activation:values.activation};
}

function decrypt(serialized, proof, profile, privateKey, now) {
  const envelope = validateEnvelope(serialized, proof, profile, now);
  const keyObject = crypto.createPrivateKey(privateKey);
  demand(hash(crypto.createPublicKey(keyObject).export({type:'spki',format:'der'})) === profile.recipientFingerprint);
  const key = crypto.privateDecrypt({key:keyObject,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'}, envelope.wrappedKey);
  let plaintext;
  try {
    demand(key.length === 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm',key,envelope.iv);
    decipher.setAAD(Buffer.from(JSON.stringify(envelope.metadata))); decipher.setAuthTag(envelope.tag);
    plaintext = Buffer.concat([decipher.update(envelope.ciphertext),decipher.final()]);
    demand(plaintext.length <= 60000);
    return pack(consumer.parseJson(plaintext.toString('utf8')));
  } finally { key.fill(0); if (plaintext) plaintext.fill(0); }
}
function directory(file, io=fs) {
  const s = io.lstatSync(file);
  demand(s.isDirectory() && !s.isSymbolicLink() && s.uid === 0 && s.gid === 0 && (s.mode & 0o7777) === 0o700);
}
function absent(file, io=fs) {
  try { io.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('EXISTING_FILE_PRESERVED');
}
function readOwned(file, maximum, io=fs) {
  const s=io.lstatSync(file);
  demand(s.isFile() && !s.isSymbolicLink() && s.uid===0 && s.gid===0 && (s.mode&0o7777)===0o600 && s.nlink===1 && s.size>=1 && s.size<=maximum);
  const fd=io.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const buffer=Buffer.alloc(maximum+1);
  const stable=current=>current.isFile() && ['ino','dev','mode','uid','gid','nlink','size','mtimeMs','ctimeMs'].every(k=>current[k]===s[k]);
  try {
    demand(stable(io.fstatSync(fd)));
    let size=0;
    while(size<buffer.length){const count=io.readSync(fd,buffer,size,buffer.length-size,null);if(count===0)break;size+=count;}
    demand(size===s.size && size<=maximum && stable(io.fstatSync(fd)));
    return Buffer.from(buffer.subarray(0,size));
  } finally {buffer.fill(0);io.closeSync(fd);}
}
function loadConsumer(io=fs) {
  directory(__dirname,io);
  // Inspect both installed public siblings; compile the exact checked consumer buffer once.
  readOwned(__filename,65536,io);
  const bytes=readOwned(__dirname+'/ops-pack-consumer.cjs',32768,io);
  demand(hash(bytes)===CONSUMER_SHA);
  const loaded={exports:{}};
  const wrapped=new Script('(function(require,module,exports){'+bytes.toString('utf8')+'\n})', {filename:'ccpun-checked-ops-consumer.cjs'}).runInThisContext();
  wrapped(name=>{demand(name==='node:fs');return fs;},loaded,loaded.exports);
  consumer=loaded.exports;
  demand(Object.keys(consumer.FIELDS).filter(name=>name!=='googleData').sort().join('|')===[...CAPABILITIES].sort().join('|'));
  return consumer;
}

function createOwned(file, data, io=fs) {
  const fd=io.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try {
    io.writeFileSync(fd,data); io.fsyncSync(fd);
    const s=io.fstatSync(fd); demand(s.isFile() && s.uid===0 && s.gid===0 && s.nlink===1 && (s.mode&0o7777)===0o600 && s.size===Buffer.byteLength(data));
  } finally {io.closeSync(fd);}
  const parent=io.openSync(file.slice(0,file.lastIndexOf('/')),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
  try {io.fsyncSync(parent);} finally {io.closeSync(parent);}
}
function consume(serialized, proof, now, io=fs) {
  directory(PRIVATE_DIR,io); directory(STAGE_DIR,io); directory("/operator",io);
  absent(CLAIM,io); absent(TARGET,io); absent(BUILD_CONFIG,io); // Metadata only; never opens any existing OPS/Auth/Neon pack.
  const profile=consumer.parseJson(readOwned(PROFILE,16384,io).toString('utf8'));
  validateEnvelope(serialized,proof,profile,now); // Trusted capture/hash checked before private key access or nonce claim.
  const privateKey=readOwned(KEY,16384,io);
  let result;
  try {result=decrypt(serialized,proof,profile,privateKey,now);} finally {privateKey.fill(0);}
  const manifest=consumer.parseJson(readOwned(MANIFEST,16384,io).toString('utf8'));
  consumer.validate(result,manifest,{gitSha:TARGET_SHA,lockSha256:LOCK,releaseId:manifest.releaseId,exportWebhookUrl:result.sections.googleSheetTrigger?.CCPUN_N8N_EXPORT_WEBHOOK_URL??null});
  const data=Buffer.from(JSON.stringify(result)+'\n');
  try {
    // Durable fail-closed claim first; a failed partial stage needs explicit operator recovery.
    createOwned(CLAIM,JSON.stringify({schemaVersion:1,transferId:profile.transferId,cipherSha256:proof.cipherSha256,exporterSha:proof.exporterSha})+'\n',io);
    createOwned(TARGET,data,io);
    if(result.sections.driveInteractive){const fields=consumer.FIELDS.driveInteractive.slice(0,3);
      createOwned(BUILD_CONFIG,JSON.stringify(Object.fromEntries(fields.map(name=>[name,result.sections.driveInteractive[name]])))+'\n',io);}
  } finally {data.fill(0);}
  return {accepted:true,root0600:true,singleLink:true,capabilities:Object.keys(result.sections).sort(),driveBuildConfigStaged:Boolean(result.sections.driveInteractive),mounted:false,executionEnabled:false,productionReady:false};
}
function main() {
  demand(process.platform==='linux' && process.getuid()===0 && process.getgid()===0
    && process.env.CCPUN_TRANSFER_VPS_ID==='908107' && process.argv.length===3);
  process.umask(0o077);loadConsumer();
  const mode=process.argv[2];
  directory(PRIVATE_DIR);
  if (mode==='prepare') {
    demand(!process.env.CCPUN_TRANSFER_CIPHERTEXT && !process.env.CCPUN_TRANSFER_CAPTURE_PROOF);
    absent(KEY);absent(PROFILE);absent(CLAIM);
    const pair=crypto.generateKeyPairSync('rsa',{modulusLength:3072});
    const publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
    const preparedAt=Math.floor(Date.now()/1000);
    const profile={schemaVersion:1,transferId:crypto.randomBytes(16).toString('hex'),
      recipientFingerprint:hash(pair.publicKey.export({type:'spki',format:'der'})),recipientPublicKeyPem:publicKey,preparedAt,profileExpiresAt:preparedAt+86400,targetSha:TARGET_SHA,lockSha256:LOCK};
    const privateBytes=Buffer.from(pair.privateKey.export({type:'pkcs8',format:'pem'}));
    try {createOwned(KEY,privateBytes);createOwned(PROFILE,JSON.stringify(profile)+'\n');} finally {privateBytes.fill(0);}
    console.log(JSON.stringify(profile)); // Public key, fingerprint and nonce only.
  } else if (mode==='consume') {
    const serialized=decode(process.env.CCPUN_TRANSFER_CIPHERTEXT).toString('utf8');
    const rawProof=process.env.CCPUN_TRANSFER_CAPTURE_PROOF;
    demand(typeof rawProof==='string' && rawProof.length<=4096);
    const proof=consumer.parseJson(rawProof);
    delete process.env.CCPUN_TRANSFER_CIPHERTEXT;delete process.env.CCPUN_TRANSFER_CAPTURE_PROOF;
    console.log(JSON.stringify(consume(serialized,proof,Math.floor(Date.now()/1000))));
  } else throw new Error('INVALID_MODE');
}
module.exports={validateProfile,validateEnvelope,decrypt,pack,consume,createOwned,readOwned,hash,TARGET_SHA,LOCK,CAPABILITIES,CONSUMER_SHA,loadConsumer};
if(require.main===module){try{main();}catch{console.error('OPS_MIGRATION_RECIPIENT_FAILED existingPacksPreserved=true executionEnabled=false');process.exitCode=1;}}
