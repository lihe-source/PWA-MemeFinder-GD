import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync('./app.mjs','utf8');
const extract=(a,b)=>{const start=src.indexOf(a),end=src.indexOf(b,start);assert.ok(start>=0&&end>start);return src.slice(start,end);};
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',checked:true,disabled:false,open:false});return elements.get(id);};
let current,restores=0,binds=0,rendered=0,synced=0,connected=false,loggedOut=false;
class MockAuth{constructor(o){Object.assign(this,o);this.options=o;this.active=true;current=this;}suspend(){this.active=false;}async restore(){restores++;return connected;}logout(){loggedOut=true;this.suspend();}ensure(){return Promise.resolve('token');}}
const ctx=vm.createContext({BrowserAuth:MockAuth,URL,Date,JSON,$,console,clearTimeout,setTimeout:f=>{f();return 0;},loadGoogleScript(){},sessionStorage:{},document:{querySelector:()=>null},location:{href:'https://site.example/PWA-MemeFinder-GD/'},drive:{connected:()=>connected,disconnect:()=>{connected=false;},setToken:()=>{connected=true;},setRefreshHandler(){}},bind:async()=>{binds++;},render:()=>{rendered++;},scheduleSync:()=>{synced++;},persistCfg(){},toast(){},status(){},fail:e=>{throw e;},locked(){},scan(){},esc:s=>s||'',folderId:s=>s,tags:s=>[s]});
vm.runInContext(`let db={},cfg={client:'old.apps.googleusercontent.com',folder:'folder123456',account:'owner@example.com'},auth=null,authState='idle',authText='',authGeneration=0,account='',files=[{id:'one'}],pending=['unsent'],page='settings',busy=false,syncing=false,backingUp=false,savingEdit=false,syncTimer,backupTimer,backupState={},synonyms=[],latest='V1_4',VERSION='V1_4';const draftWrite=Promise.resolve();`,ctx);
vm.runInContext(extract('function suspendAuth()','function persistCfg(){')+extract('function renderSettings','$(\'#connect\').onclick'),ctx);
vm.runInContext("renderSettings($('#main'))",ctx);assert.ok($('#main').innerHTML.includes('OAuth Web Client ID'));assert.equal($('#main').innerHTML.includes('auth-url'),false);assert.equal($('#main').innerHTML.includes('訪客'),false);
await vm.runInContext('resumeAuth()',ctx);assert.equal(restores,1);
await current.onIdentity({account:'owner@example.com',name:'Rex'});assert.equal(binds,0);assert.equal(rendered,0);
current.onState('connected');current.onState('remembered','授權到期');current.onState('connected');assert.equal(synced,2);assert.equal(vm.runInContext('pending.length',ctx),1);
$('#folder').value='folder123456';$('#client').value='new.apps.googleusercontent.com';await $('#config').onsubmit({preventDefault(){}});assert.equal(vm.runInContext('cfg.client',ctx),'new.apps.googleusercontent.com');
const old=current;await $('#logout').onclick();assert.equal(loggedOut,true);assert.equal(vm.runInContext('cfg.autoLogin',ctx),false);const n=restores;await vm.runInContext('resumeAuth()',ctx);assert.equal(restores,n);old.onToken('late',3600);assert.equal(connected,false);
assert.ok(!src.includes('fetch(\'./auth-config'));assert.ok(!src.includes('PersistentAuth'));
console.log('PASS settings only require Client ID/folder; restored identity preserves edits; reconnection resumes pending sync; logout prevents restore; stale callback ignored; no Worker request');
