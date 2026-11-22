import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PersistentAuth,serviceURL} from './auth-session.mjs';
const src=fs.readFileSync('./app.mjs','utf8');
const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
assert.equal(/guest|PublicDrive|免登入|訪客/i.test(src),false);
const elements=new Map(),store=new Map();
const $=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:true,textContent:'',disabled:false,innerHTML:'',open:false});return elements.get(id);};
let applied='',requests=0,binds=0,renders=0,schedules=0,refreshHandler;
const ctx=vm.createContext({PersistentAuth,serviceURL,URL,AbortController,Date,console,clearTimeout,setTimeout:()=>0,
 $,document:{hidden:false,querySelector:()=>null,getElementById:()=>({}),head:{append(){}}},location:{href:'https://site.example/PWA-MemeFinder-GD/',hash:''},navigator:{onLine:true},
 drive:{connected:()=>!!applied,setToken:t=>{applied=t;},disconnect:()=>{applied='';},setRefreshHandler:h=>{refreshHandler=h;}},
 get:async(_db,key)=>store.get(key),put:async(_db,key,v)=>store.set(key,v),del:async(_db,key)=>store.delete(key),
 loadGoogleScript(){},esc:s=>s||'',bind:async()=>{binds++;},render:()=>{renders++;},scheduleSync:()=>{schedules++;},toast(){},fail:e=>{throw e;},persistCfg(){},folderId:s=>s,tags:s=>[s],checkUpdate(){},maybeActivate(){},locked(){},scan(){},
});
vm.runInContext(`let auth=null,authSiteConfig={},authState='idle',authText='',authGeneration=0,loginOpening=false;let db={},cfg={folder:'folder123456',account:'test@example.com',authURL:'https://auth.example'},account='',files=[{id:'image1'}],pending=[],page='settings',busy=false,syncing=false,backingUp=false,savingEdit=false,syncError='',backupState={},synonyms=[],latest='V1_3',VERSION='V1_3',syncTimer,backupTimer;const draftWrite=Promise.resolve(),authURL=()=>cfg.authURL??authSiteConfig.workerURL??'';`,ctx);
vm.runInContext(extract('function status(){','function scheduleSync')+extract('function suspendAuth(){','function persistCfg(){')+extract('function renderSettings','$(\'#connect\').onclick'),ctx);
vm.runInContext("renderSettings($('#main'))",ctx);
assert.ok($('#main').innerHTML.includes('持續登入授權服務網址'));assert.equal(typeof $('#config').onsubmit,'function');assert.equal(typeof $('#logout').onclick,'function');assert.equal(typeof $('#update').onclick,'function');
const prefix='device-auth:/PWA-MemeFinder-GD/:https://auth.example:';
store.set(prefix+'session',{token:'s'.repeat(43),account:'test@example.com'});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url)=>{requests++;assert.ok(url.endsWith('/session')||url.endsWith('/logout'));return Response.json(url.endsWith('/logout')?{loggedOut:true}:{accessToken:'access-token',expiresAt:Date.now()+3600000,account:'test@example.com',name:'Rex'});};
try{
 await vm.runInContext('setupAuth()',ctx);assert.equal(applied,'access-token');assert.equal(binds,0);assert.equal(renders,0);
 $('#synonyms').value='未儲存的編輯';await vm.runInContext('resumeAuth()',ctx);assert.equal($('#synonyms').value,'未儲存的編輯');assert.equal(requests,1);
 applied='';await refreshHandler();assert.equal(applied,'access-token');assert.equal(requests,1);
 await $('#logout').onclick();assert.equal(applied,'');assert.equal(vm.runInContext('cfg.autoLogin',ctx),false);assert.equal(store.has(prefix+'session'),false);
 const count=requests;await vm.runInContext('setupAuth()',ctx);assert.equal(requests,count);
 $('#folder').value='folder123456';$('#client').value='';$('#auth-url').value='https://newauth.example';$('#auto-login').checked=false;await $('#config').onsubmit({preventDefault(){}});assert.equal(vm.runInContext('cfg.authURL',ctx),'https://newauth.example');assert.equal(vm.runInContext('cfg.autoLogin',ctx),false);
 console.log('PASS V1.1 settings handlers; auth-only UI; auto-restore; same-account edits preserved; Drive token reapplied; manual logout stops restore; Worker-only settings save');
}finally{await vm.runInContext('auth?.suspend()',ctx);globalThis.fetch=originalFetch;}
