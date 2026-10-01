#!/usr/bin/env node
'use strict';
// Operator-only, no network service. Inputs after preparation are public ciphertext and
// independently captured canonical owner-authenticated TLS/deployment proof, never secrets.
const crypto = require('node:crypto'); // eslint-disable-line @typescript-eslint/no-require-imports -- Native standalone CommonJS operator, no package loader.
const fs = require('node:fs'); // eslint-disable-line @typescript-eslint/no-require-imports -- Native standalone CommonJS operator, no package loader.
const TARGET_SHA = 'a1f7a827fcbc56154edcfe35fa6bdcf1f8eccaca';
const LOCK = '96a9011823170ed2953e12b300d6ec039df81de9b548f0848af370a5bb8783cf';
const PROJECT = 'prj_6tuUxJxYbQ4mpF7sMgNWx2p2jowN';
const FIELDS = ['CCPUN_GOOGLE_DATA_CLIENT_ID','CCPUN_GOOGLE_DATA_CLIENT_SECRET','CCPUN_GOOGLE_DATA_REFRESH_TOKEN','CCPUN_GSC_SITE_URL','CCPUN_GA4_PROPERTY_ID'];
const PRIVATE_DIR = '/private';
const STAGE_DIR = '/stage';
const KEY = PRIVATE_DIR + '/recipient.pem';
const PROFILE = PRIVATE_DIR + '/recipient.json';
const CLAIM = PRIVATE_DIR + '/accepted.json';
const TARGET = STAGE_DIR + '/production-admin-ops-pack.json';
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
  exact(profile, ['schemaVersion','transferId','recipientFingerprint','recipientPublicKeyPem']);
  demand(profile.schemaVersion === 1 && /^[a-f0-9]{32}$/.test(profile.transferId)
    && /^[a-f0-9]{64}$/.test(profile.recipientFingerprint));
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
  const envelope = JSON.parse(serialized);
  exact(envelope, ['metadata','wrappedKey','iv','tag','ciphertext']);
  const m = envelope.metadata;
  // Reconstruct canonical AAD order; never trust arbitrary envelope metadata/order.
  exact(m, ['schemaVersion','kind','transferId','recipientFingerprint','sourceProjectId','sourceRef','exporterSha','deploymentHost','targetSha','lockSha256','issuedAt','expiresAt']);
  demand(m.schemaVersion === 1 && m.kind === 'ccpun-google-data-migration'
    && m.transferId === profile.transferId && m.recipientFingerprint === profile.recipientFingerprint
    && m.sourceProjectId === PROJECT && m.sourceRef === 'v4-production'
    && m.exporterSha === proof.exporterSha && m.deploymentHost === proof.deploymentHost
    && m.targetSha === TARGET_SHA && m.lockSha256 === LOCK
    && Number.isSafeInteger(m.issuedAt) && Number.isSafeInteger(m.expiresAt)
    && m.issuedAt <= now && now < m.expiresAt && m.expiresAt > m.issuedAt
    && m.expiresAt - m.issuedAt <= 900);
  const metadata = {schemaVersion:1,kind:m.kind,transferId:m.transferId,recipientFingerprint:m.recipientFingerprint,
    sourceProjectId:PROJECT,sourceRef:'v4-production',exporterSha:m.exporterSha,deploymentHost:m.deploymentHost,
    targetSha:TARGET_SHA,lockSha256:LOCK,issuedAt:m.issuedAt,expiresAt:m.expiresAt};
  return { metadata, wrappedKey:decode(envelope.wrappedKey,384), iv:decode(envelope.iv,12),
    tag:decode(envelope.tag,16), ciphertext:decode(envelope.ciphertext) };
}
function pack(values) {
  exact(values, FIELDS);
  demand(Object.values(values).every(v => typeof v === 'string' && v === v.trim()
    && v.length >= 1 && v.length <= 16384 && !/[\x00-\x1f\x7f]/.test(v)));
  demand(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(values.CCPUN_GOOGLE_DATA_CLIENT_ID)
    && /^\d{1,20}$/.test(values.CCPUN_GA4_PROPERTY_ID)
    && ['sc-domain:ccpun.com','https://ccpun.com/','https://www.ccpun.com/'].includes(values.CCPUN_GSC_SITE_URL));
  return {schemaVersion:1,provider:'hostinger',role:'admin',environment:'production-admin',gitRef:'v4-production',
    sanityProjectId:'kyfxgjnq',sanityDataset:'production',neonProjectId:'lively-bar-43618798',
    neonBranchId:'br-long-resonance-b3ys5xrv',neonEndpointId:'ep-broad-butterfly-b3ro7u8w',neonDatabase:'neondb',
    gitSha:TARGET_SHA,lockSha256:LOCK,sections:{googleData:{...values,reuseLoginOAuthClient:false}}};
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
    demand(plaintext.length <= 90000);
    return pack(JSON.parse(plaintext.toString('utf8')));
  } finally { key.fill(0); if (plaintext) plaintext.fill(0); }
}
function directory(file, io=fs) {
  const s = io.lstatSync(file);
  demand(s.isDirectory() && !s.isSymbolicLink() && s.uid === 0 && s.gid === 0 && (s.mode & 0o777) === 0o700);
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
function createOwned(file, data, io=fs) {
  const fd=io.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try {
    io.writeFileSync(fd,data); io.fsyncSync(fd);
    const s=io.fstatSync(fd); demand(s.isFile() && s.uid===0 && s.gid===0 && s.nlink===1 && (s.mode&0o777)===0o600 && s.size===Buffer.byteLength(data));
  } finally {io.closeSync(fd);}
}
function consume(serialized, proof, now, io=fs) {
  directory(PRIVATE_DIR,io); directory(STAGE_DIR,io);
  absent(CLAIM,io); absent(TARGET,io); // Metadata only; never opens any existing OPS/Auth/Neon pack.
  const profile=JSON.parse(readOwned(PROFILE,16384,io).toString('utf8'));
  validateEnvelope(serialized,proof,profile,now); // Trusted capture/hash checked before private key access or nonce claim.
  const privateKey=readOwned(KEY,16384,io);
  let result;
  try {result=decrypt(serialized,proof,profile,privateKey,now);} finally {privateKey.fill(0);}
  const data=Buffer.from(JSON.stringify(result)+'\n');
  try {
    // Durable fail-closed claim first; a failed partial stage needs explicit operator recovery.
    createOwned(CLAIM,JSON.stringify({schemaVersion:1,transferId:profile.transferId,cipherSha256:proof.cipherSha256,exporterSha:proof.exporterSha})+'\n',io);
    createOwned(TARGET,data,io);
  } finally {data.fill(0);}
  return {accepted:true,root0600:true,singleLink:true,capabilities:['googleData'],mounted:false,executionEnabled:false,productionReady:false};
}
function main() {
  demand(process.platform==='linux' && process.getuid()===0 && process.getgid()===0
    && process.env.CCPUN_TRANSFER_VPS_ID==='908107' && process.argv.length===3);
  process.umask(0o077);
  const mode=process.argv[2];
  directory(PRIVATE_DIR);
  if (mode==='prepare') {
    demand(!process.env.CCPUN_TRANSFER_CIPHERTEXT && !process.env.CCPUN_TRANSFER_CAPTURE_PROOF);
    absent(KEY);absent(PROFILE);absent(CLAIM);
    const pair=crypto.generateKeyPairSync('rsa',{modulusLength:3072});
    const publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
    const profile={schemaVersion:1,transferId:crypto.randomBytes(16).toString('hex'),
      recipientFingerprint:hash(pair.publicKey.export({type:'spki',format:'der'})),recipientPublicKeyPem:publicKey};
    const privateBytes=Buffer.from(pair.privateKey.export({type:'pkcs8',format:'pem'}));
    try {createOwned(KEY,privateBytes);createOwned(PROFILE,JSON.stringify(profile)+'\n');} finally {privateBytes.fill(0);}
    console.log(JSON.stringify(profile)); // Public key, fingerprint and nonce only.
  } else if (mode==='consume') {
    const serialized=decode(process.env.CCPUN_TRANSFER_CIPHERTEXT).toString('utf8');
    const rawProof=process.env.CCPUN_TRANSFER_CAPTURE_PROOF;
    demand(typeof rawProof==='string' && rawProof.length<=4096);
    const proof=JSON.parse(rawProof);
    delete process.env.CCPUN_TRANSFER_CIPHERTEXT;delete process.env.CCPUN_TRANSFER_CAPTURE_PROOF;
    console.log(JSON.stringify(consume(serialized,proof,Math.floor(Date.now()/1000))));
  } else throw new Error('INVALID_MODE');
}
module.exports={validateProfile,validateEnvelope,decrypt,pack,consume,createOwned,readOwned,hash};
if(require.main===module){try{main();}catch{console.error('GOOGLE_DATA_MIGRATION_RECIPIENT_FAILED existingPacksPreserved=true executionEnabled=false');process.exitCode=1;}}
