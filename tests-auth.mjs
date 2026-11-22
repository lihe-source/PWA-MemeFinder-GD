import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from './auth-worker.mjs';
import {PersistentAuth,serviceURL} from './auth-session.mjs';
import * as drive from './drive.mjs';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('./auth-schema.sql','utf8'));
class Statement {
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async first(){return db.prepare(this.sql).get(...this.args)||null;}
 async run(){const query=db.prepare(this.sql);if(/\bRETURNING\b/i.test(this.sql)){const results=query.all(...this.args);return {results,meta:{changes:results.length}};}const out=query.run(...this.args);return {meta:{changes:out.changes},results:[]};}
}
const env={APP_URL:'https://lihe-source.github.io/PWA-MemeFinder-GD/',AUTH_URL:'https://memefinder-auth.example.workers.dev',GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'server-only-secret',TOKEN_ENCRYPTION_KEY:'1a'.repeat(32),ALLOWED_EMAILS:'owner@example.com',DB:{prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
let googleMode='ok',refreshCalls=0,accessNumber=1,oauthCalls=0,clientRequests=[];
const encode=b=>Buffer.from(b).toString('base64url');const proof=encode(crypto.getRandomValues(new Uint8Array(32)));const digest=async s=>encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const origin=new URL(env.APP_URL).origin;
const post=(path,data={},token='',customOrigin=origin)=>worker.fetch(new Request(env.AUTH_URL+path,{method:'POST',headers:{Origin:customOrigin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}),env);
globalThis.fetch=async(input,options={})=>{
 const url=new URL(input);if(url.origin===env.AUTH_URL){clientRequests.push({url,options});return post(url.pathname,JSON.parse(options.body||'{}'),options.headers.Authorization?.slice(7));}
 if(url.href==='https://oauth2.googleapis.com/token'){
  const p=new URLSearchParams(options.body);assert.equal(p.get('client_secret'),'server-only-secret');oauthCalls++;
  if(p.get('grant_type')==='refresh_token'){
   refreshCalls++;if(googleMode==='temporary')return Response.json({error:'temporarily_unavailable'},{status:503});if(googleMode==='revoked')return Response.json({error:'invalid_grant'},{status:400});
   await Promise.resolve();accessNumber++;return Response.json({access_token:'access-'+accessNumber,expires_in:3600,refresh_token:'refresh-'+accessNumber});
  }
  assert.equal(p.get('redirect_uri'),env.AUTH_URL+'/oauth/callback');assert.ok(p.get('code_verifier'));
  return Response.json({access_token:'access-'+accessNumber,refresh_token:'refresh-'+accessNumber,expires_in:3600,scope:'https://www.googleapis.com/auth/drive'});
 }
 if(url.pathname==='/drive/v3/about')return Response.json({user:{emailAddress:'owner@example.com',displayName:'Rex',permissionId:'p1'}});
 throw Error('Unexpected network URL '+url.origin+url.pathname);
};
assert.throws(()=>serviceURL('http://wrong.test'));assert.throws(()=>serviceURL('https://wrong.test/path'));assert.equal(serviceURL(env.AUTH_URL+'/'),env.AUTH_URL);
assert.equal((await post('/auth/start',{challenge:await digest(proof)},'','https://evil.test')).status,403);
assert.equal((await post('/session',{},'')).status,401);
const preflight=await worker.fetch(new Request(env.AUTH_URL+'/session',{method:'OPTIONS',headers:{Origin:origin}}),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
async function login(){const started=await (await post('/auth/start',{challenge:await digest(proof),hint:'owner@example.com'})).json();const url=new URL(started.url);assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('client_secret'),null);
 assert.equal((await post('/auth/result',{flow:started.flow,proof})).status,202);
 assert.equal((await post('/auth/result',{flow:started.flow,proof:'x'.repeat(43)})).status,401);
 const callback=await worker.fetch(new Request(env.AUTH_URL+'/oauth/callback?state='+started.flow+'&code=test-code'),env);assert.equal(callback.status,200);assert.ok((await callback.text()).includes('授權已完成'));
 const handoff=await (await post('/auth/result',{flow:started.flow,proof})).json();assert.equal(handoff.account,'owner@example.com');assert.equal(handoff.accessToken,undefined);assert.equal(handoff.refresh_token,undefined);
 assert.equal((await (await post('/auth/result',{flow:started.flow,proof})).json()).sessionToken,handoff.sessionToken);return {...handoff,flow:started.flow};}
let loginInfo=await login(),session=loginInfo.sessionToken;
const stored=db.prepare('SELECT * FROM auth_sessions').get();assert.equal(stored.refresh_enc.includes('refresh-'),false);assert.equal(stored.access_enc.includes('access-'),false);assert.notEqual(stored.session_hash,session);
console.log('PASS origin/PKCE/proof validation, encrypted server tokens and idempotent login handoff');
let response=await (await post('/session',{},session)).json();assert.equal(response.accessToken,'access-1');assert.equal(refreshCalls,0);
db.prepare('UPDATE auth_sessions SET access_expires=?').run(Date.now()-1);
const parallel=await Promise.all([post('/session',{},session),post('/session',{},session)]);assert.ok(parallel.some(r=>r.status===200));response=await (await post('/session',{},session)).json();assert.equal(response.accessToken,'access-2');assert.equal(refreshCalls,1);
const stale=await (await post('/session',{rejectedToken:'access-1'},session)).json();assert.equal(stale.accessToken,'access-2');assert.equal(refreshCalls,1);
response=await (await post('/session',{rejectedToken:'access-2'},session)).json();assert.equal(response.accessToken,'access-3');assert.equal(refreshCalls,2);
console.log('PASS expiry refresh, concurrent lease protection and stale-401 recovery');
googleMode='temporary';db.prepare('UPDATE auth_sessions SET access_expires=?').run(Date.now()-1);assert.equal((await post('/session',{},session)).status,503);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,1);assert.equal(db.prepare('SELECT refresh_lock FROM auth_sessions').get().refresh_lock,0);
googleMode='ok';await post('/session',{},session);
const store=new Map([['session',{token:session,account:'owner@example.com',name:'Rex'}]]),storage={get:async key=>structuredClone(store.get(key)),set:async(key,value)=>store.set(key,structuredClone(value)),remove:async key=>store.delete(key)};
let tokenEvents=[],identities=[],states=[];const client=new PersistentAuth({url:env.AUTH_URL,storage,onToken:(...args)=>tokenEvents.push(args),onIdentity:async identity=>identities.push(identity),onState:(...args)=>states.push(args)});
const beforeRestore=oauthCalls;await client.restore('owner@example.com');assert.equal(client.state,'connected');assert.equal(identities.at(-1).account,'owner@example.com');assert.equal(oauthCalls,beforeRestore);assert.ok(clientRequests.every(r=>r.options.credentials==='omit'));assert.equal(store.get('session').accessToken,undefined);
client.expires=0;db.prepare('UPDATE auth_sessions SET access_expires=?').run(Date.now()-1);const beforeRefresh=refreshCalls;await Promise.all([client.ensure(),client.ensure(),client.ensure()]);assert.equal(refreshCalls,beforeRefresh+1);
console.log('PASS browser reopens with opaque session, no consent popup and single-flight renewal');
// Drive retries one 401 with the new token; concurrent requests share client renewal.
const serviceFetch=globalThis.fetch;let driveCalls=0;
globalThis.fetch=async(input,options)=>{const url=new URL(input);if(url.pathname==='/drive/v3/test'){driveCalls++;if(options.headers.Authorization==='Bearer rejected-access')return new Response('{}',{status:401});return Response.json({ok:true,tokenUsed:options.headers.Authorization});}return serviceFetch(input,options);};
drive.setToken('rejected-access',3600);client.token='rejected-access';client.expires=Date.now()+300000;drive.setRefreshHandler(rejected=>client.ensure(rejected).then(token=>drive.setToken(token,(client.expires-Date.now())/1000)));
const driveResult=await drive.api('test');assert.equal(driveResult.ok,true);assert.notEqual(driveResult.tokenUsed,'Bearer rejected-access');assert.equal(driveCalls,2);
drive.setRefreshHandler(null);drive.disconnect();globalThis.fetch=serviceFetch;
console.log('PASS real Drive adapter renews and retries one unauthorized API request');
client.expires=0;db.prepare('UPDATE auth_sessions SET access_expires=?').run(Date.now()-1);googleMode='temporary';await assert.rejects(client.ensure());assert.equal(client.state,'offline');assert.ok(store.get('session'));googleMode='ok';await client.ensure();
googleMode='revoked';client.expires=0;db.prepare('UPDATE auth_sessions SET access_expires=?').run(Date.now()-1);await assert.rejects(client.ensure());assert.equal(client.state,'needs-login');assert.equal(store.has('session'),false);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get().n,0);client.suspend();googleMode='ok';
console.log('PASS temporary outage retains login; revoked Google grant requests reauthorization');
loginInfo=await login();session=loginInfo.sessionToken;store.set('session',{token:session,account:'owner@example.com'});
const logoutClient=new PersistentAuth({url:env.AUTH_URL,storage});await logoutClient.restore('owner@example.com');assert.equal(await logoutClient.logout(),true);assert.equal(store.has('session'),false);assert.equal((await post('/session',{},session)).status,401);assert.equal((await post('/auth/result',{flow:loginInfo.flow,proof})).status,401);await assert.rejects(logoutClient.ensure(),/取消/);
console.log('PASS manual logout clears device/server session and prevents login-result replay');
// Suspending during a slow restore must never apply a token after the login settings change.
let release;const slowFetch=globalThis.fetch;globalThis.fetch=()=>new Promise(resolve=>release=resolve);
store.set('session',{token:'x'.repeat(43),account:'owner@example.com'});const suspended=new PersistentAuth({url:env.AUTH_URL,storage,onToken:()=>{throw Error('must not apply token');}});const slow=suspended.restore('owner@example.com');while(!release)await Promise.resolve();suspended.suspend();release(Response.json({accessToken:'late-token',expiresAt:Date.now()+3600000,account:'owner@example.com'}));await slow;globalThis.fetch=slowFetch;
console.log('PASS changing login settings ignores a late authentication response');
// Invalid origin/expired state callbacks cannot be replayed.
assert.equal((await worker.fetch(new Request(env.AUTH_URL+'/oauth/callback?state='+loginInfo.flow+'&code=again'),env)).status,400);
assert.equal(fs.readFileSync('./auth-config.json','utf8').includes('server-only-secret'),false);
db.close();
