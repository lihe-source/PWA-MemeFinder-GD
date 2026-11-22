// Cloudflare Worker only. Deploy with wrangler.auth.toml; never runs in the PWA.
const enc = new TextEncoder(), dec = new TextDecoder();
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FLOW_MS = 10 * 60 * 1000, SESSION_MS = 90 * 24 * 60 * 60 * 1000;
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64 = str => Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))));
function problem(code, status=400) { return Object.assign(Error(code), {code,status}); }
function settings(env) {
  const app = new URL(env.APP_URL), auth = new URL(env.AUTH_URL);
  if(app.protocol!=='https:'||auth.protocol!=='https:'||app.username||auth.username||app.search||app.hash||auth.pathname!=='/'||auth.search||auth.hash)throw problem('service_not_configured',503);
  if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!/^[a-fA-F0-9]{64}$/.test(env.TOKEN_ENCRYPTION_KEY||''))throw problem('service_not_configured',503);
  return {app,auth,origin:app.origin,redirect:auth.origin+'/oauth/callback'};
}
function secretBytes(env){return Uint8Array.from(env.TOKEN_ENCRYPTION_KEY.match(/../g),h=>parseInt(h,16));}
async function seal(env,value,context) {
  const iv=crypto.getRandomValues(new Uint8Array(12)), key=await crypto.subtle.importKey('raw',secretBytes(env),'AES-GCM',false,['encrypt']);
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(context)},key,enc.encode(JSON.stringify(value)));
  return b64(iv)+'.'+b64(new Uint8Array(bytes));
}
async function unseal(env,value,context) {
  const [iv,body]=value.split('.'),key=await crypto.subtle.importKey('raw',secretBytes(env),'AES-GCM',false,['decrypt']);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:enc.encode(context)},key,un64(body))));
}
async function sessionToken(env,flow,proof) {
  const key=await crypto.subtle.importKey('raw',secretBytes(env),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('memefinder-session\n'+flow+'\n'+proof))));
}
function reply(value,status=200,origin) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  if(origin)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
  return new Response(value===null?null:JSON.stringify(value),{status,headers});
}
async function body(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw problem('json_required',415);
  const text=await request.text();if(text.length>4096)throw problem('request_too_large',413);
  try{return JSON.parse(text);}catch{throw problem('invalid_json');}
}
async function googleTokens(env,params) {
  let res;try{res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...params}),signal:AbortSignal.timeout(20000)});}catch{throw problem('google_temporarily_unavailable',503);}
  let value;try{value=await res.json();}catch{throw problem('google_temporarily_unavailable',503);}
  if(!res.ok){if(value.error==='invalid_grant')throw problem('reauthorization_required',401);if(value.error==='invalid_client')throw problem('service_credentials_invalid',503);throw problem('google_temporarily_unavailable',503);}
  if(!value.access_token||!(Number(value.expires_in)>0))throw problem('invalid_google_response',503);
  return value;
}
async function cleanup(env) {
  const now=Date.now();await env.DB.batch([
    env.DB.prepare('DELETE FROM auth_flows WHERE expires < ?').bind(now),
    env.DB.prepare('DELETE FROM auth_sessions WHERE expires < ?').bind(now),
    env.DB.prepare('DELETE FROM auth_limits WHERE expires < ?').bind(now)
  ]);
}
async function start(request,env,cfg) {
  const input=await body(request);if(!/^[\w-]{43}$/.test(input.challenge||''))throw problem('invalid_challenge');
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown',bucket=await hash(ip+':'+Math.floor(now/FLOW_MS));
  const rate=await env.DB.prepare('INSERT INTO auth_limits(bucket,attempts,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(bucket,now+FLOW_MS).first();
  if(rate.attempts>20)throw problem('too_many_login_attempts',429);
  const state=random(),stateHash=await hash(state),verifier=random();
  await env.DB.prepare('INSERT INTO auth_flows(state_hash,challenge,verifier_enc,expires) VALUES(?,?,?,?)').bind(stateHash,input.challenge,await seal(env,verifier,stateHash),now+FLOW_MS).run();
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:cfg.redirect,response_type:'code',scope:DRIVE_SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:await hash(verifier),code_challenge_method:'S256',...(typeof input.hint==='string'&&input.hint.length<256?{login_hint:input.hint}:{})});
  return {flow:state,url:url.href,expiresAt:now+FLOW_MS};
}
function callbackPage(cfg,ok) {
  const message=ok?'Google 授權已完成':'Google 授權未完成';
  const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+message+'</title><style>body{font:18px system-ui;max-width:560px;margin:15vh auto;padding:24px;background:#f4f6fb;color:#1b2944}a{display:inline-block;padding:14px 20px;background:#2057d5;color:white;border-radius:12px;text-decoration:none}</style><h1>'+message+'</h1><p>請關閉這個視窗，回到原本的梗圖庫。程式會自動確認授權結果。</p><p>iPhone 主畫面版請直接切回原本的 PWA。</p><a href="'+cfg.app.href.replaceAll('&','&amp;').replaceAll('"','&quot;')+'">返回網頁版梗圖庫</a></html>';
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}
async function callback(request,env,cfg) {
  const url=new URL(request.url),state=url.searchParams.get('state');if(!/^[\w-]{43}$/.test(state||''))throw problem('invalid_state');
  const stateHash=await hash(state),now=Date.now();
  const flow=await env.DB.prepare('UPDATE auth_flows SET claimed=1 WHERE state_hash=? AND claimed=0 AND expires>? RETURNING *').bind(stateHash,now).first();
  if(!flow)throw problem('login_expired_or_consumed',400);
  try {
    if(url.searchParams.has('error'))throw problem('authorization_cancelled');
    const code=url.searchParams.get('code');if(!code)throw problem('missing_code');
    const tokens=await googleTokens(env,{grant_type:'authorization_code',code,redirect_uri:cfg.redirect,code_verifier:await unseal(env,flow.verifier_enc,stateHash)});
    if(!tokens.refresh_token)throw problem('offline_permission_missing');
    if(tokens.scope&&!tokens.scope.split(' ').includes(DRIVE_SCOPE))throw problem('drive_permission_missing');
    const response=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,permissionId)',{headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw problem('account_lookup_failed');
    const {user}=await response.json(),account=user?.emailAddress||user?.permissionId;
    if(!account)throw problem('account_lookup_failed');
    const allow=String(env.ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(allow.length&&!allow.includes(account.toLowerCase()))throw problem('account_not_allowed',403);
    const bundle={refresh:tokens.refresh_token,access:tokens.access_token,accessExpires:Date.now()+Number(tokens.expires_in)*1000,account,name:user.displayName||account};
    await env.DB.prepare('UPDATE auth_flows SET result_enc=?,verifier_enc=? WHERE state_hash=?').bind(await seal(env,bundle,stateHash),'',stateHash).run();
    return callbackPage(cfg,true);
  }catch(e){await env.DB.prepare('UPDATE auth_flows SET error_code=?,verifier_enc=? WHERE state_hash=?').bind(e.code||'authorization_failed','',stateHash).run();return callbackPage(cfg,false);}
}
async function result(request,env) {
  const {flow,proof}=await body(request);if(!/^[\w-]{43}$/.test(flow||'')||!/^[\w-]{43}$/.test(proof||''))throw problem('invalid_flow');
  const stateHash=await hash(flow),row=await env.DB.prepare('SELECT * FROM auth_flows WHERE state_hash=? AND expires>?').bind(stateHash,Date.now()).first();
  if(!row||row.challenge!==await hash(proof))throw problem('login_expired_or_invalid',401);
  if(row.error_code)throw problem(row.error_code,400);
  if(!row.result_enc)return {pending:true};
  const bundle=await unseal(env,row.result_enc,stateHash),credential=await sessionToken(env,flow,proof),sessionHash=await hash(credential);
  if(!row.session_hash)await env.DB.batch([
    env.DB.prepare('INSERT INTO auth_sessions(session_hash,refresh_enc,access_enc,access_expires,account,display_name,expires) SELECT ?,?,?,?,?,?,? FROM auth_flows WHERE state_hash=? AND session_hash IS NULL ON CONFLICT(session_hash) DO NOTHING').bind(sessionHash,await seal(env,bundle.refresh,sessionHash),await seal(env,bundle.access,sessionHash),bundle.accessExpires,bundle.account,bundle.name,Date.now()+SESSION_MS,stateHash),
    env.DB.prepare('UPDATE auth_flows SET session_hash=? WHERE state_hash=? AND session_hash IS NULL').bind(sessionHash,stateHash)
  ]);
  if(!await env.DB.prepare('SELECT session_hash FROM auth_sessions WHERE session_hash=? AND expires>?').bind(sessionHash,Date.now()).first())throw problem('session_expired',401);
  // Idempotent for the ten-minute login window: a lost network response can be retried.
  return {sessionToken:credential,account:bundle.account,name:bundle.name};
}
async function session(request,env,input) {
  const credential=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!/^[\w-]{43}$/.test(credential||''))throw problem('session_missing',401);
  const sessionHash=await hash(credential),now=Date.now();
  let row=await env.DB.prepare('SELECT * FROM auth_sessions WHERE session_hash=? AND expires>?').bind(sessionHash,now).first();
  if(!row)throw problem('session_expired',401);
  if(input.logout){await env.DB.batch([env.DB.prepare('DELETE FROM auth_sessions WHERE session_hash=?').bind(sessionHash),env.DB.prepare('DELETE FROM auth_flows WHERE session_hash=?').bind(sessionHash)]);return {loggedOut:true};}
  const access=await unseal(env,row.access_enc,sessionHash);
  // Reject a stale access token once; concurrent 401 callers reuse an already refreshed token.
  const force=input.rejectedToken===access;
  if(row.access_expires<=now+90000||force){
    const lease=now+30000;
    const locked=await env.DB.prepare('UPDATE auth_sessions SET refresh_lock=? WHERE session_hash=? AND refresh_lock<? RETURNING session_hash').bind(lease,sessionHash,now).first();
    if(!locked)throw problem('refresh_in_progress',503);
    try {
      row=await env.DB.prepare('SELECT * FROM auth_sessions WHERE session_hash=? AND expires>?').bind(sessionHash,Date.now()).first();
      if(!row)throw problem('session_expired',401);
      const current=await unseal(env,row.access_enc,sessionHash);
      if(row.access_expires>Date.now()+90000&&input.rejectedToken!==current)return {accessToken:current,expiresAt:row.access_expires,account:row.account,name:row.display_name};
      const fresh=await googleTokens(env,{grant_type:'refresh_token',refresh_token:await unseal(env,row.refresh_enc,sessionHash)});
      const expires=Date.now()+Number(fresh.expires_in)*1000;
      const refresh=fresh.refresh_token?await seal(env,fresh.refresh_token,sessionHash):row.refresh_enc;
      const updated=await env.DB.prepare('UPDATE auth_sessions SET refresh_enc=?,access_enc=?,access_expires=?,expires=?,refresh_lock=0 WHERE session_hash=? AND refresh_lock=? RETURNING session_hash').bind(refresh,await seal(env,fresh.access_token,sessionHash),expires,Date.now()+SESSION_MS,sessionHash,lease).first();
      if(!updated)throw problem('session_expired',401);
      row={...row,access_expires:expires};return {accessToken:fresh.access_token,expiresAt:expires,account:row.account,name:row.display_name};
    }catch(e){if(e.code==='reauthorization_required')await env.DB.prepare('DELETE FROM auth_sessions WHERE session_hash=?').bind(sessionHash).run();throw e;}
    finally{await env.DB.prepare('UPDATE auth_sessions SET refresh_lock=0 WHERE session_hash=? AND refresh_lock=?').bind(sessionHash,lease).run();}
  }
  await env.DB.prepare('UPDATE auth_sessions SET expires=? WHERE session_hash=?').bind(now+SESSION_MS,sessionHash).run();
  return {accessToken:access,expiresAt:row.access_expires,account:row.account,name:row.display_name};
}
export default {
  async fetch(request,env,ctx) {
    let cfg,origin;
    try {
      cfg=settings(env);const url=new URL(request.url);
      if(url.origin!==cfg.auth.origin)throw problem('wrong_service_origin',403);
      if(url.pathname==='/oauth/callback'&&request.method==='GET')return await callback(request,env,cfg);
      if(url.pathname==='/health'&&request.method==='GET')return reply({ok:true,version:'V1_3'});
      if(request.headers.get('Origin')!==cfg.origin)throw problem('origin_not_allowed',403);origin=cfg.origin;
      if(request.method==='OPTIONS')return reply(null,204,origin);
      if(request.method!=='POST')throw problem('method_not_allowed',405);
      let value;
      if(url.pathname==='/auth/start'){value=await start(request,env,cfg);ctx?.waitUntil(cleanup(env));}
      else if(url.pathname==='/auth/result')value=await result(request,env);
      else if(url.pathname==='/session')value=await session(request,env,await body(request));
      else if(url.pathname==='/logout')value=await session(request,env,{logout:true});
      else throw problem('not_found',404);
      return reply(value,value.pending?202:200,origin);
    }catch(e){return reply({error:e.code||'service_unavailable'},e.status||503,origin);}
  },
  async scheduled(_event,env,ctx){ctx.waitUntil(cleanup(env));}
};
