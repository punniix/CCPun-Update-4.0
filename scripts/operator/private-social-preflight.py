#!/usr/bin/env python3
"""Finite, read-only Social preflight. --self-test never reads packs or uses network.

Private execution requires separate owner authorization. Only the retained Social
section is projected; Core packs are never opened (SANITY_SCHEMA_HOLD). Public
Node code uses ephemeral container tmpfs; private bytes use an internal pipe only.
"""
import hashlib
import json
import os
import re
import select
import stat
import subprocess
import sys
import time

IMAGE = 'node@sha256:64af3819f9275802414d7cdc38c27e9d82bd564dec4d4da87d008255d36c63b4'
NODE_SHA = '7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c'
CONSUMER_SHA = '2c85972322cf8c6b67c4d0d7f09537fab66f10121802452e9163ce3dfbee21ce'
MANIFEST_SHA = '90064735a7c50aae33da50fa3ab46e50daa9fb5fe88bc30bdbb681c982a4a6f7'
# Original PUBLIC manifest locator/metadata was independently read back by the
# parent. This is the original 20261001 build evidence, not a new lab harness.
MANIFEST_PATH = '/opt/ccpun-labs/ccpun-native-admin-production-build-d8adcac3-20261001/evidence/build-manifest.json'
SOURCE_DIR = '/etc/ccpun/hostinger-migration'
PACK = 'production-admin-fullops-d8adcac3-20261001.json'
ORIGINAL = dict(gitSha='d8adcac35bb68b457ef38bf1e399a917fa53a9e4',
    lockSha256='96a9011823170ed2953e12b300d6ec039df81de9b548f0848af370a5bb8783cf',
    releaseId='ccpun-native-admin-production-build-d8adcac3-20261001', exportWebhookUrl=None)
FIXED = dict(provider='hostinger', role='admin', environment='production-admin',
    gitRef='v4-production', sanityProjectId='kyfxgjnq', sanityDataset='production',
    neonProjectId='lively-bar-43618798', neonBranchId='br-long-resonance-b3ys5xrv',
    neonEndpointId='ep-broad-butterfly-b3ro7u8w', neonDatabase='neondb')
FIELDS = ('CCPUN_SOCIAL_DATABASE_URL', 'CCPUN_META_ACCESS_TOKEN',
    'CCPUN_META_GRAPH_VERSION', 'CCPUN_META_GRANTED_SCOPES', 'CCPUN_META_PAGE_ID')
RESULT_KEYS = ('sourceVerified', 'socialContractVerified', 'executionDisabled',
    'neonIdentityVerified', 'neonMigrationsVerified', 'neonRoleRestricted',
    'metaIdentityVerified', 'metaPermissionsVerified', 'operationalRows')


class Hold(Exception):
    pass


def require(ok):
    if not ok:
        raise Hold()


def parse(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result)
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(Hold()))


def stable_read(name, directory_fd, *, public_hash=None):
    require(isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9._-]+', name))
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory_fd)
    try:
        before = os.fstat(fd)
        metadata(before)
        raw = bytearray()
        while len(raw) <= before.st_size:
            piece = os.read(fd, min(16384, before.st_size + 1 - len(raw)))
            if not piece:
                break
            raw.extend(piece)
        after = os.fstat(fd)
        metadata(after)
        require(len(raw) == before.st_size and fingerprint(before) == fingerprint(after))
        if public_hash:
            require(hashlib.sha256(raw).hexdigest() == public_hash)
        return raw
    finally:
        os.close(fd)


def metadata(s):
    require(stat.S_ISREG(s.st_mode) and s.st_uid == s.st_gid == 0
        and stat.S_IMODE(s.st_mode) == 0o600 and s.st_nlink == 1
        and 2 <= s.st_size <= 131072)


def fingerprint(s):
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def open_directory(path):
    require(os.path.isabs(path) and os.path.realpath(path) == path)
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    s = os.fstat(fd)
    if not (s.st_uid == s.st_gid == 0 and stat.S_IMODE(s.st_mode) == 0o700):
        os.close(fd)
        raise Hold()
    return fd


def project(pack, manifest):
    require(isinstance(pack, dict) and set(pack) ==
        {'schemaVersion', *FIXED, 'gitSha', 'lockSha256', 'sections', 'activation'})
    require(pack['schemaVersion'] == 1 and all(pack[k] == v for k, v in FIXED.items())
        and all(pack[k] == ORIGINAL[k] for k in ('gitSha', 'lockSha256')))
    expected = dict(schemaVersion=1, **{k: v for k, v in FIXED.items() if k != 'neonEndpointId'},
        **{k: ORIGINAL[k] for k in ('gitSha', 'lockSha256', 'releaseId')},
        capabilityProfile='full', schedulerBackend='disabled', productionReady=False,
        platform='linux', architecture='x64')
    require(isinstance(manifest, dict) and all(manifest.get(k) == v for k, v in expected.items()))
    sections = pack['sections']
    require(isinstance(sections, dict) and isinstance(sections.get('socialWorker'), dict))
    social = sections['socialWorker']
    require(set(social) == set(FIELDS) and all(isinstance(v, str) and v == v.strip()
        and 1 <= len(v) <= 16384 and not re.search(r'[\x00-\x1f\x7f]', v) for v in social.values()))
    return dict(schemaVersion=1, credentialSource=ORIGINAL, social=dict(social))


# Builtins only until actual source, tracked lock, consumer and Node are checked.
# No worker imports, providers, listeners, private files, refresh or retry paths.
NODE = r'''
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const lifetime=setTimeout(()=>process.exit(1),40000);
const publicConfig=JSON.parse(process.argv[2]);
const demand=x=>{if(!x)throw Error('HOLD');};
const hash=x=>createHash('sha256').update(x).digest('hex');
const exact=(x,keys)=>demand(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('\0')===[...keys].sort().join('\0'));
const off={CCPUN_SOCIAL_ENABLED:'false',CCPUN_SOCIAL_OPERATIONS_ENABLED:'0',CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED:'0',CCPUN_SOCIAL_PROVIDER_READS_ENABLED:'0',CCPUN_SOCIAL_ANALYTICS_INGESTION_ENABLED:'0',CCPUN_BACKGROUND_WORKER_ENABLED:'0',CCPUN_ARTICLE_SCHEDULING_ENABLED:'0',CCPUN_ARTICLE_SCHEDULE_EXECUTOR_ENABLED:'0',CCPUN_NATIVE_WORKFLOW_ENABLED:'0',CCPUN_ENABLE_PRODUCTION_ANALYTICS:'0'};
const wipeEnv=()=>{for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',...off});};
const git=args=>{const r=spawnSync('/usr/bin/git',['-c','safe.directory=/source','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null',...args],{cwd:'/source',encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe'],maxBuffer:131072});demand(r.status===0&&!r.error);return r.stdout.trim();};
const fields=['CCPUN_SOCIAL_DATABASE_URL','CCPUN_META_ACCESS_TOKEN','CCPUN_META_GRAPH_VERSION','CCPUN_META_GRANTED_SCOPES','CCPUN_META_PAGE_ID'];
const original={gitSha:'d8adcac35bb68b457ef38bf1e399a917fa53a9e4',lockSha256:'96a9011823170ed2953e12b300d6ec039df81de9b548f0848af370a5bb8783cf',releaseId:'ccpun-native-admin-production-build-d8adcac3-20261001',exportWebhookUrl:null};
const readPacket=async parse=>{let bytes=0,parts=[];for await(const part of process.stdin){bytes+=part.length;demand(bytes<=98304);parts.push(part);}const buffer=Buffer.concat(parts);try{return parse(buffer.toString('utf8'));}finally{buffer.fill(0);for(const part of parts)part.fill(0);}};
const get=async(url,token)=>{const u=new URL(url);demand(u.protocol==='https:'&&u.hostname==='graph.facebook.com'&&!u.username&&!u.password&&!u.port&&[...u.searchParams].every(([k])=>k==='fields'));const response=await fetch(u,{method:'GET',redirect:'error',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(7000)});demand(response.ok);let n=0,parts=[];for await(const part of response.body){n+=part.length;if(n>65536){await response.body.cancel().catch(()=>{});throw Error('HOLD');}parts.push(part);}const raw=Buffer.concat(parts);try{return JSON.parse(raw.toString('utf8'));}finally{raw.fill(0);}};
try{
  wipeEnv();
  exact(publicConfig,['sha','lock','nodeSha','consumerSha']);
  demand(/^[a-f0-9]{40}$/.test(publicConfig.sha)&&/^[a-f0-9]{64}$/.test(publicConfig.lock));
  demand(process.platform==='linux'&&process.arch==='x64'&&process.getuid()===65534&&process.getgid()===65534&&process.version==='v24.21.0');
  demand(publicConfig.nodeSha==='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c'&&hash(readFileSync('/usr/local/bin/node'))===publicConfig.nodeSha);
  demand(git(['rev-parse','HEAD'])===publicConfig.sha&&git(['rev-parse','--abbrev-ref','HEAD'])==='v4-production'&&git(['rev-parse','--verify','refs/heads/v4-production^{commit}'])===publicConfig.sha&&!git(['status','--porcelain','--untracked-files=no']));
  git(['ls-files','--error-unmatch','package-lock.json','apps/admin/scripts/build-provider.mjs','lib/admin/social/runtime.ts','scripts/operator/ops-pack-consumer.cjs']);
  demand(hash(readFileSync('/source/package-lock.json'))===publicConfig.lock&&publicConfig.consumerSha==='2c85972322cf8c6b67c4d0d7f09537fab66f10121802452e9163ce3dfbee21ce'&&hash(readFileSync('/source/scripts/operator/ops-pack-consumer.cjs'))===publicConfig.consumerSha);
  const env={...process.env,CCPUN_DEPLOYMENT_PROVIDER:'hostinger',CCPUN_DEPLOYMENT_ROLE:'admin',CCPUN_APP_ENV:'production-admin',NEXT_PUBLIC_CCPUN_APP_ENV:'production-admin',CCPUN_ADMIN_CAPABILITY_PROFILE:'full',CCPUN_ARTICLE_SCHEDULER_BACKEND:'disabled',NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND:'disabled',CCPUN_ARTICLE_SCHEDULE_EXECUTION_PLANE:'vps',CCPUN_GIT_SHA:publicConfig.sha,CCPUN_GIT_REF:'v4-production',CCPUN_RELEASE_ID:`private-social-preflight-${publicConfig.sha.slice(0,8)}`,AUTH_URL:'https://admin.ccpun.com',NEXT_PUBLIC_SANITY_PROJECT_ID:'kyfxgjnq',NEXT_PUBLIC_SANITY_DATASET:'production',CCPUN_NEON_PROJECT_ID:'lively-bar-43618798',CCPUN_NEON_BRANCH_ID:'br-long-resonance-b3ys5xrv',CCPUN_NEON_ENDPOINT_ID:'ep-broad-butterfly-b3ro7u8w',CCPUN_NEON_DATABASE:'neondb',CCPUN_UAT_MODE:'0'};
  Object.assign(process.env,env);
  const {validateNativeNeonSource}=await import('/source/apps/admin/scripts/build-provider.mjs');
  const sealedGit=(_binary,args,options)=>spawnSync('/usr/bin/git',['-c','safe.directory=/source','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null',...args],{...options,timeout:5000,maxBuffer:131072});
  const seal=validateNativeNeonSource('/source/apps/admin',env,sealedGit);
  demand(seal?.gitSha===publicConfig.sha&&seal.lockSha256===publicConfig.lock&&seal.environment==='production-admin');
  const require=createRequire('/source/package.json');
  const consumer=require('/source/scripts/operator/ops-pack-consumer.cjs');
  const {register}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
  register();
  const runtime=await import('/source/lib/admin/social/runtime.ts');
  // Dependency loading and public seals are complete before requesting private input.
  const {neon}=require('@neondatabase/serverless');
  process.stdout.write('SOCIAL_PREFLIGHT_READY_V1\n');
  let packet=await readPacket(consumer.parseJson);
  exact(packet,['schemaVersion','credentialSource','social']);demand(packet.schemaVersion===1);
  exact(packet.credentialSource,Object.keys(original));demand(Object.entries(original).every(([k,v])=>packet.credentialSource[k]===v));
  exact(packet.social,fields);consumer.validateSection('socialWorker',packet.social,original);
  const privateEnv={...env,...packet.social,...off};
  const descriptor=runtime.resolveSocialRuntimeDescriptor(runtime.socialRuntimeInputFromEnvironment(privateEnv));
  demand(descriptor?.lane==='production'&&descriptor.neonIdentity.role==='ccpun_social_runtime');
  const sql=neon(packet.social.CCPUN_SOCIAL_DATABASE_URL);
  const query=`SELECT current_database()='neondb' AND current_user='ccpun_social_runtime' AS role_ok,
    EXISTS(SELECT 1 FROM ccpun_social.system_identity WHERE singleton=true AND project_id=$1 AND branch_id=$2 AND endpoint_id=$3 AND database_name='neondb') AS identity_ok,
    (SELECT count(*)=3 FROM ccpun_social.schema_migration WHERE (version,checksum) IN (
      ('20260828_website_42_social_foundation_v2','sha256:b6ad0b823775df1dcfc06e0da896dfcc477cfbeae897b70e228c18a051712acb'),
      ('20260901_website_42_social_publication_execution_v1','sha256:9c9a95c3f29d0c912b6b0c226fea873569809f49ebc8f1a66ab32699bde85bba'),
      ('20260901_website_42_social_comment_execution_v1','sha256:c9a5512469d8894ccbdebf5c051d7471aef1f9d59973b6a71f5d0f2b7618155d'))) AS migrations_ok,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid)) AS restricted,
    (SELECT count(*) FROM ccpun_social.social_publication)+(SELECT count(*) FROM ccpun_social.social_publication_job)+(SELECT count(*) FROM ccpun_social.social_comment_item)+(SELECT count(*) FROM ccpun_social.social_execution_audit) AS operational_rows`;
  const [rows]=await sql.transaction([sql.query(query,['lively-bar-43618798','br-long-resonance-b3ys5xrv','ep-broad-butterfly-b3ro7u8w'])],{readOnly:true,isolationLevel:'RepeatableRead',fetchOptions:{signal:AbortSignal.timeout(10000),redirect:'error'}});
  demand(rows.length===1&&rows[0].role_ok===true&&rows[0].identity_ok===true&&rows[0].migrations_ok===true&&rows[0].restricted===true);
  const count=Number(rows[0].operational_rows);demand(Number.isSafeInteger(count)&&count>=0);
  let metaIdentityVerified=false,metaPermissionsVerified=false;
  try{const page=await get(`https://graph.facebook.com/${packet.social.CCPUN_META_GRAPH_VERSION}/${packet.social.CCPUN_META_PAGE_ID}?fields=id`,packet.social.CCPUN_META_ACCESS_TOKEN);metaIdentityVerified=page.id===packet.social.CCPUN_META_PAGE_ID;}catch{}
  try{const permissions=await get(`https://graph.facebook.com/${packet.social.CCPUN_META_GRAPH_VERSION}/me/permissions`,packet.social.CCPUN_META_ACCESS_TOKEN);metaPermissionsVerified=Array.isArray(permissions.data)&&['pages_show_list','pages_read_engagement','pages_manage_posts'].every(scope=>permissions.data.some(p=>p.permission===scope&&p.status==='granted'));}catch{}
  for(const key of fields){privateEnv[key]='';packet.social[key]='';}packet=null;
  process.stdout.write(JSON.stringify({sourceVerified:true,socialContractVerified:true,executionDisabled:true,neonIdentityVerified:true,neonMigrationsVerified:true,neonRoleRestricted:true,metaIdentityVerified,metaPermissionsVerified,operationalRows:count})+'\n');
}catch{process.stdout.write('SOCIAL_PREFLIGHT_HOLD\n');process.exitCode=1;}
finally{clearTimeout(lifetime);wipeEnv();}
'''


def docker_command(source, config, name):
    # All arguments/environment are PUBLIC. No inherited environment, mounts of
    # private packs, published ports, auto-restart, worker command or Docker logs.
    require(re.fullmatch(r'ccpun-social-readonly-[a-f0-9]{32}', name))
    return ['/usr/bin/docker', 'run', '--rm', '-i', '--pull=never', '--log-driver=none',
        '--name='+name, '--label=ccpun.private-social-preflight='+name,
        '--user=65534:65534', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--pids-limit=32', '--memory=384m', '--cpus=1',
        '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=8m,mode=1777',
        '--mount', f'type=bind,src={source},dst=/source,readonly',
        '--entrypoint=/bin/sh', IMAGE, '-s', '--', json.dumps(config, separators=(',', ':'))]


def bootstrap():
    return ("umask 077\ncat > /tmp/preflight.mjs <<'CCPUN_PUBLIC_NODE_END'\n" + NODE +
        "\nCCPUN_PUBLIC_NODE_END\nexec /usr/local/bin/node --conditions=react-server /tmp/preflight.mjs \"$1\"\n").encode()


def read_line(pipe, deadline):
    line = bytearray()
    while len(line) <= 4096:
        remaining = deadline - time.monotonic()
        require(remaining > 0 and bool(select.select([pipe], [], [], remaining)[0]))
        part = os.read(pipe.fileno(), 1)
        require(bool(part))
        if part == b'\n':
            return bytes(line)
        line.extend(part)
    raise Hold()


def write_all(pipe, data, deadline, write=os.write, ready=select.select):
    os.set_blocking(pipe.fileno(), False)
    view = memoryview(data)
    try:
        while view:
            remaining = deadline - time.monotonic()
            require(remaining > 0 and bool(ready([], [pipe], [], remaining)[1]))
            try:
                count = write(pipe.fileno(), view)
            except BlockingIOError:
                continue
            require(0 < count <= len(view))
            view = view[count:]
    finally:
        view.release()


def cleanup(name, run=subprocess.run):
    require(re.fullmatch(r'ccpun-social-readonly-[a-f0-9]{32}', name))
    options = dict(stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=5,
        env={'PATH':'/usr/bin:/bin','HOME':'/nonexistent','LANG':'C'})
    # Never kill/filter unrelated containers. Already-removed --rm is acceptable
    # only after an exact-name bounded readback proves absence.
    run(['/usr/bin/docker','rm','--force',name], **options)
    check=run(['/usr/bin/docker','ps','-a','--filter','name=^/'+name+'$',
        '--format','{{.Names}}'], **options)
    require(check.returncode == 0 and check.stdout == b'')


def exchange(child, private_reader):
    private = None
    try:
        deadline = time.monotonic() + 45
        write_all(child.stdin, bootstrap(), deadline)
        require(read_line(child.stdout, deadline) == b'SOCIAL_PREFLIGHT_READY_V1')
        # Never call the retained-pack reader before the trusted source READY.
        private = bytearray(json.dumps(private_reader(), separators=(',', ':')).encode())
        require(len(private) <= 98304)
        write_all(child.stdin, private, deadline)
        child.stdin.close()
        line = read_line(child.stdout, deadline)
        result = parse(line)
        require(set(result) == set(RESULT_KEYS) and all(type(result[k]) is bool for k in RESULT_KEYS[:-1])
            and type(result['operationalRows']) is int and result['operationalRows'] >= 0)
        require(child.wait(timeout=max(1, deadline-time.monotonic())) == 0)
        require(child.stdout.read(1) == b'')
        return result
    finally:
        if private is not None:
            private[:] = b'\0' * len(private)
        if child.poll() is None:
            child.kill()
            child.wait(timeout=5)


def run_readonly(source, sha, lock, manifest_path):
    require(sys.platform == 'linux' and os.getuid() == os.getgid() == 0 and sys.flags.isolated)
    require(re.fullmatch('[a-f0-9]{40}', sha) and re.fullmatch('[a-f0-9]{64}', lock))
    require(source == '/opt/ccpun-workers/releases/' + sha and os.path.realpath(source) == source)
    require(MANIFEST_PATH is not None and manifest_path == MANIFEST_PATH)
    public_fd = open_directory(os.path.dirname(manifest_path))
    try:
        manifest_raw = stable_read(os.path.basename(manifest_path), public_fd, public_hash=MANIFEST_SHA)
        manifest = parse(manifest_raw)
    finally:
        os.close(public_fd)
    def private_reader():
        fd = open_directory(SOURCE_DIR)
        raw = None
        try:
            raw = stable_read(PACK, fd)
            return project(parse(raw), manifest)
        finally:
            if raw is not None:
                raw[:] = b'\0' * len(raw)
            os.close(fd)
    config = dict(sha=sha, lock=lock, nodeSha=NODE_SHA, consumerSha=CONSUMER_SHA)
    name = 'ccpun-social-readonly-' + os.urandom(16).hex()
    try:
        child = subprocess.Popen(docker_command(source, config, name), stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0,
            env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'LANG': 'C'})
        return exchange(child, private_reader)
    finally:
        cleanup(name)


def self_test(node_binary):
    # Only synthetic objects and an inert local child; no Docker/private reads/network.
    import unittest
    from types import SimpleNamespace
    require(os.path.isabs(node_binary) and os.path.realpath(node_binary) == node_binary)
    sterile = {'PATH':'/usr/bin:/bin','HOME':'/nonexistent','LANG':'C'}
    consumer_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ops-pack-consumer.cjs')
    with open(consumer_path, 'rb') as public:
        require(hashlib.sha256(public.read()).hexdigest() == CONSUMER_SHA)
    def node_check(code, args=()):
        result = subprocess.run([node_binary,'--input-type=module',*args],input=code.encode(),
            stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=sterile,timeout=10)
        require(len(result.stdout)<=4096)
        return result
    class Checks(unittest.TestCase):
        def test_duplicate_json(self):
            with self.assertRaises(Hold): parse('{"a":1,"a":2}')
        def test_projection_and_original_source(self):
            pack = dict(schemaVersion=1, **FIXED, gitSha=ORIGINAL['gitSha'],
                lockSha256=ORIGINAL['lockSha256'], sections={'socialWorker':dict.fromkeys(FIELDS,'synthetic'),
                'localAiCallbacks':{'CCPUN_LOCAL_AI_N8N_TOKEN':'excluded'}},activation={'anything':True})
            manifest = dict(schemaVersion=1, **{k:v for k,v in FIXED.items() if k!='neonEndpointId'},
                **{k:ORIGINAL[k] for k in ('gitSha','lockSha256','releaseId')},
                capabilityProfile='full',schedulerBackend='disabled',productionReady=False,platform='linux',architecture='x64')
            payload=project(pack,manifest)
            self.assertEqual(set(payload['social']),set(FIELDS))
            self.assertNotIn('SANITY_API_READ_TOKEN',payload['social'])
            self.assertEqual(payload['credentialSource'],ORIGINAL)
            pack['gitSha']='a'*40
            with self.assertRaises(Hold): project(pack,manifest)
        def test_extra_field_denied(self):
            code="""import {createRequire} from 'node:module';
const {validateSection,parseJson}=createRequire(import.meta.url)(process.argv[1]);
const social={CCPUN_SOCIAL_DATABASE_URL:'postgresql://ccpun_social_runtime:FAKE_ONLY@ep-broad-butterfly-b3ro7u8w.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',CCPUN_META_ACCESS_TOKEN:'FAKE_ONLY',CCPUN_META_GRAPH_VERSION:'v24.0',CCPUN_META_GRANTED_SCOPES:'pages_show_list,pages_read_engagement,pages_manage_posts',CCPUN_META_PAGE_ID:'12345'};
validateSection('socialWorker',social,{});
let denied=0;for(const patch of [{AUTH_SECRET:'FAKE_ONLY'},{CCPUN_ARTICLE_SCHEDULING_ENABLED:'1'},{CCPUN_SOCIAL_DATABASE_URL:social.CCPUN_SOCIAL_DATABASE_URL.replace('ccpun_social_runtime','ccpun_admin_runtime')},{CCPUN_SOCIAL_DATABASE_URL:social.CCPUN_SOCIAL_DATABASE_URL.replace('ep-broad-butterfly-b3ro7u8w','ep-mute-frost-aztvz394')},{CCPUN_META_GRANTED_SCOPES:'pages_show_list,pages_read_engagement'},{CCPUN_META_PAGE_ID:'../unexpected'}]){try{validateSection('socialWorker',{...social,...patch},{});}catch{denied++;}}
try{parseJson('{"schemaVersion":1,"schemaVersion":1}');}catch{denied++;}
if(denied!==7)process.exit(1);else process.stdout.write('PURE_CONSUMER_PASS');"""
            # Public synthetic values only; no provider imports, environment or network.
            result=node_check(code,('--eval',code,consumer_path))
            self.assertEqual(result.returncode,0)
            self.assertEqual(result.stdout,b'PURE_CONSUMER_PASS')
        def test_actual_embedded_node_syntax(self):
            result=node_check(NODE,('--check',))
            self.assertEqual(result.returncode,0)
        def test_actual_runtime_denial_before_private_input(self):
            code=NODE.replace('const publicConfig=JSON.parse(process.argv[2]);',
                'const publicConfig='+json.dumps(dict(sha='a'*40,lock='b'*64,nodeSha=NODE_SHA,consumerSha=CONSUMER_SHA))+';')
            result=node_check(code)
            # Actual guarded program, on local host, cannot pass Linux/nonroot/binary/source pins.
            self.assertEqual(result.returncode,1)
            self.assertEqual(result.stdout,b'SOCIAL_PREFLIGHT_HOLD\n')
        def test_actual_neon_readonly_call_shape(self):
            # Exercise the actual production SQL/call fragment, with no SDK/network.
            fragment=NODE[NODE.index('  const query='):NODE.index('  demand(rows.length')]
            code="""import assert from 'node:assert/strict';
const sql={query(q,parameters){assert.match(q,/^SELECT /);assert.doesNotMatch(q,/\\b(UPDATE|INSERT|DELETE|CREATE|ALTER|DROP|TRUNCATE)\\b/i);assert.deepEqual(parameters,['lively-bar-43618798','br-long-resonance-b3ys5xrv','ep-broad-butterfly-b3ro7u8w']);return {q,parameters};},async transaction(queries,options){assert.equal(queries.length,1);assert.equal(options.readOnly,true);assert.equal(options.isolationLevel,'RepeatableRead');assert.equal(options.isolationMode,undefined);assert.equal(options.fetchOptions.redirect,'error');assert.ok(options.fetchOptions.signal instanceof AbortSignal);return [[{}]];}};
"""+fragment+"process.stdout.write('NEON_READONLY_MOCK_PASS');"
            result=node_check(code)
            self.assertEqual(result.returncode,0)
            self.assertEqual(result.stdout,b'NEON_READONLY_MOCK_PASS')
        def test_actual_meta_fixed_get_and_error_redaction(self):
            getter=NODE[NODE.index('const get='):NODE.index('try{\n  wipeEnv();')]
            probe=NODE[NODE.index('  let metaIdentityVerified='):NODE.index('  for(const key of fields)')]
            code="""import assert from 'node:assert/strict';
const demand=x=>{if(!x)throw Error('HOLD');};let calls=[],fail=false;
globalThis.fetch=async(url,options)=>{calls.push([String(url),options]);if(fail)throw Error('FAKE_ONLY sensitive provider error');const data=String(url).includes('/me/permissions')?{data:['pages_show_list','pages_read_engagement','pages_manage_posts'].map(permission=>({permission,status:'granted'}))}:{id:'12345'};return {ok:true,body:(async function*(){yield Buffer.from(JSON.stringify(data));})()};};
const packet={social:{CCPUN_META_GRAPH_VERSION:'v24.0',CCPUN_META_PAGE_ID:'12345',CCPUN_META_ACCESS_TOKEN:'FAKE_ONLY'}};
"""+getter+'async function probe(){'+probe+'return [metaIdentityVerified,metaPermissionsVerified];}\n'+"""
assert.deepEqual(await probe(),[true,true]);assert.equal(calls.length,2);
assert.deepEqual(calls.map(x=>x[0]),['https://graph.facebook.com/v24.0/12345?fields=id','https://graph.facebook.com/v24.0/me/permissions']);
for(const [,options] of calls){assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.deepEqual(options.headers,{Authorization:'Bearer FAKE_ONLY'});assert.ok(options.signal instanceof AbortSignal);}
calls=[];fail=true;assert.deepEqual(await probe(),[false,false]);assert.equal(calls.length,2);
await assert.rejects(()=>get('https://graph.facebook.com/v24.0/me?access_token=FAKE_ONLY','FAKE_ONLY'));
await assert.rejects(()=>get('https://unapproved.invalid/v24.0/me','FAKE_ONLY'));
assert.equal(calls.length,2);process.stdout.write('META_GET_MOCK_PASS');
"""
            result=node_check(code)
            self.assertEqual(result.returncode,0)
            self.assertEqual(result.stdout,b'META_GET_MOCK_PASS')
        def test_metadata(self):
            s=SimpleNamespace(st_mode=stat.S_IFREG|0o600,st_uid=0,st_gid=0,st_nlink=1,st_size=20)
            metadata(s)
            for key,value in [('st_mode',stat.S_IFLNK|0o600),('st_mode',stat.S_IFREG|0o644),('st_uid',1),('st_nlink',2),('st_size',131073)]:
                bad=SimpleNamespace(**vars(s));setattr(bad,key,value)
                with self.assertRaises(Hold): metadata(bad)
        def test_path_denied_before_open(self):
            with self.assertRaises(Hold): stable_read('../pack',-1)
        def test_sterile_public_docker_command(self):
            args=docker_command('/opt/ccpun-workers/releases/'+'a'*40,dict(sha='a'*40,lock='b'*64,nodeSha=NODE_SHA,consumerSha=CONSUMER_SHA),'ccpun-social-readonly-'+'c'*32)
            self.assertNotIn('-e',args)
            self.assertIn('--user=65534:65534',args)
            self.assertIn('--read-only',args)
            self.assertIn('--log-driver=none',args)
            self.assertNotIn(SOURCE_DIR,' '.join(args))
            self.assertNotIn('NODE_OPTIONS', ' '.join(args))
        def test_complete_short_writes_and_timeout(self):
            r,w=os.pipe()
            try:
                received=bytearray()
                def short(_fd,data):
                    received.extend(data[:2]);return min(2,len(data))
                with os.fdopen(w,'wb',buffering=0) as pipe:
                    write_all(pipe,b'PUBLIC_SYNTHETIC',time.monotonic()+2,short)
                    self.assertEqual(received,b'PUBLIC_SYNTHETIC')
                    with self.assertRaises(Hold):write_all(pipe,b'PUBLIC',time.monotonic()-1,short)
            finally:os.close(r)
        def test_cleanup_only_unique_invocation(self):
            calls=[];name='ccpun-social-readonly-'+'c'*32
            def fake(args,**_):calls.append(args);return SimpleNamespace(returncode=0,stdout=b'')
            cleanup(name,fake)
            self.assertEqual(calls[0],['/usr/bin/docker','rm','--force',name])
            self.assertIn('name=^/'+name+'$',calls[1])
            with self.assertRaises(Hold):cleanup('unrelated',fake)
            self.assertEqual(len(calls),2)
        def test_ready_success_only_five_fields(self):
            script="""import sys,json
while True:
 line=sys.stdin.buffer.readline()
 if not line:sys.exit(1)
 if line.startswith(b'exec /usr/local/bin/node '):break
sys.stdout.write('SOCIAL_PREFLIGHT_READY_V1\\n');sys.stdout.flush()
packet=json.loads(sys.stdin.buffer.read())
expected=['CCPUN_SOCIAL_DATABASE_URL','CCPUN_META_ACCESS_TOKEN','CCPUN_META_GRAPH_VERSION','CCPUN_META_GRANTED_SCOPES','CCPUN_META_PAGE_ID']
if sorted(packet['social'])!=sorted(expected):sys.exit(1)
result={k:True for k in ['sourceVerified','socialContractVerified','executionDisabled','neonIdentityVerified','neonMigrationsVerified','neonRoleRestricted','metaIdentityVerified','metaPermissionsVerified']};result['operationalRows']=0
sys.stdout.write(json.dumps(result)+'\\n');sys.stdout.flush()
"""
            child=subprocess.Popen([sys.executable,'-I','-c',script],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0,env=sterile)
            calls=[]
            def reader():calls.append(True);return dict(schemaVersion=1,credentialSource=ORIGINAL,social=dict.fromkeys(FIELDS,'FAKE_ONLY'))
            self.assertEqual(exchange(child,reader)['operationalRows'],0)
            self.assertEqual(calls,[True])
        def test_source_denied_never_reads_private(self):
            calls=[]
            child=subprocess.Popen([sys.executable,'-I','-c',"import sys;sys.stdout.write('SOCIAL_PREFLIGHT_HOLD\\n');sys.stdout.flush()"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,bufsize=0,env={'PATH':'/usr/bin:/bin'})
            with self.assertRaises((Hold,BrokenPipeError)): exchange(child,lambda:calls.append('private'))
            self.assertEqual(calls,[])
        def test_no_worker_or_activation_and_redaction(self):
            self.assertNotIn('runSocialWorker',NODE)
            self.assertNotIn('executeSocialPublication',NODE)
            self.assertNotIn('console.',NODE)
            self.assertIn('readOnly:true',NODE)
            self.assertIn("CCPUN_SOCIAL_ENABLED:'false'",NODE)
            self.assertIn("CCPUN_SOCIAL_PROVIDER_WRITES_ENABLED:'0'",NODE)
            self.assertIn("CCPUN_BACKGROUND_WORKER_ENABLED:'0'",NODE)
            self.assertNotIn('Object.assign(process.env,packet.social',NODE)
            self.assertLess(NODE.index('const lifetime=setTimeout'),NODE.index('await import'))
            self.assertLess(NODE.index("process.version==='v24.21.0'"),NODE.index('await readPacket'))
            self.assertLess(NODE.index('seal.lockSha256'),NODE.index('await readPacket'))
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Checks)
    result=unittest.TestResult();suite.run(result)
    require(result.wasSuccessful())
    return result.testsRun


def main():
    if len(sys.argv)==3 and sys.argv[1]=='--self-test':
        print(json.dumps({'selfTestsPassed':self_test(sys.argv[2]),'networkExecuted':False,'privatePacksRead':False}))
    elif len(sys.argv)==6 and sys.argv[1]=='--owner-approved-readonly':
        result=run_readonly(*sys.argv[2:])
        print(json.dumps({**result,'sanity':'SANITY_SCHEMA_HOLD','metaExpiry':'META_EXPIRY_HOLD',
            'businessWritesExecuted':False},separators=(',',':')))
    else:
        raise Hold()


if __name__=='__main__':
    try:
        main()
    except BaseException:
        # Never emit private bytes, SDK errors/stacks, provider bodies or child stderr.
        print('{"status":"SOCIAL_PREFLIGHT_HOLD","businessWritesExecuted":false}')
        sys.exit(1)
