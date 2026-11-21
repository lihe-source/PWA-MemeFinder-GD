import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PublicDrive,parseFolder,readPublicCollection,guestRecord,guestBackup,validGuestBackup} from './guest.mjs';
import {record,heads,score} from './core.mjs';
const folder='public-folder-123',image='image-123',key='AIza_test_public_key_123456789';
const FOLDER='application/vnd.google-apps.folder';
const data={title:'',tags:['傻眼'],scene:'同事要加班',phrase:'',text:'',notes:'公開備註',confirmed:true};
const event={schema:1,id:'revision-1',fileId:image,time:'2026-11-21T00:00:00Z',parents:[],data};
let calls=[], scenario='normal';
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(value,options)=>{
 const url=new URL(value);calls.push({url,options});
 assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);assert.equal(url.searchParams.get('key'),key);
 if(scenario==='private')return new Response('{"error":{"message":"not found"}}',{status:404});
 const id=url.pathname.split('/').at(-1);
 if(url.searchParams.has('alt')){
  if(id==='event-file')return json(event);
  if(id==='backup-file')return json({schema:1,folder,events:[event]});
  return new Response('image bytes',{headers:{'Content-Type':'image/png'}});
 }
 if(id!=='files')return json({id,name:'公開梗圖',mimeType:FOLDER,resourceKey:'root-resource'});
 const q=url.searchParams.get('q');
 if(q.includes(folder)){
  assert.equal(options.headers['X-Goog-Drive-Resource-Keys'],folder+'/root-resource');
  if(scenario==='partial')return json({files:[],incompleteSearch:true});
  if(scenario==='backup')return json({files:[{id:image,name:'貓.png',mimeType:'image/png'},{id:'backup-file',name:'MemeFinder-Marks-20261121.json',modifiedTime:'2026-11-21'}]});
  if(!url.searchParams.has('pageToken'))return json({files:[{id:image,name:'貓.png',mimeType:'image/png',resourceKey:'image-resource',modifiedTime:'2026-11-20'}],nextPageToken:'page2'});
  return json({files:[{id:'meta-folder',name:'_meme_data',mimeType:FOLDER,resourceKey:'meta-resource'},{id:'sub-folder',name:'子資料夾',mimeType:FOLDER,resourceKey:'sub-resource'}]});
 }
 if(q.includes('meta-folder')){
  assert.equal(options.headers['X-Goog-Drive-Resource-Keys'],'meta-folder/meta-resource');
  return json({files:[{id:'event-file',name:'revision.json',mimeType:'application/json',modifiedTime:'2026-11-21',resourceKey:'event-resource'}]});
 }
 if(q.includes('sub-folder'))return json({files:[{id:'image-2',name:'哭哭.png',mimeType:'image/png'}]});
 throw Error('unexpected request');
};
assert.deepEqual(parseFolder('https://drive.google.com/drive/folders/'+folder+'?usp=sharing&resourcekey=root-resource'),{id:folder,resourceKey:'root-resource'});
assert.throws(()=>parseFolder('https://evil.example/folders/'+folder));
assert.throws(()=>parseFolder('https://drive.google.com/drive/folders/'+folder+'?resourcekey=bad%0Akey'));
const client=new PublicDrive(key,{[folder]:'root-resource'});
let result=await readPublicCollection(client,folder,true);
assert.equal(result.files.length,2);assert.equal(result.events.length,1);assert.equal(result.name,'公開梗圖');
assert.equal(calls.filter(x=>x.url.searchParams.get('q')?.includes(folder)).length,2);
await client.media(image);assert.equal(calls.at(-1).options.headers['X-Goog-Drive-Resource-Keys'],image+'/image-resource');
console.log('PASS public folder pagination, subfolders, resource keys and image GET without OAuth');
calls=[];result=await readPublicCollection(client,folder,false,result.events);assert.equal(result.files.length,1);assert.equal(calls.some(x=>x.url.pathname.endsWith('/event-file')),false);
console.log('PASS unchanged public revisions reused; recursive switch respected');
const personal={[image]:{...data,tags:['下班'],notes:'只給自己看',scene:'下班前',favorite:true}};
let combined=guestRecord(result.events,personal,image);assert.deepEqual(combined.tags,['傻眼','下班']);assert.ok(score({name:'貓.png'},combined,'只給自己看',[])>0);assert.ok(score({name:'貓.png'},combined,'同事要加班',[])>0);
const changed=[{...event,data:{...data,tags:['管理者新版'],notes:'更新'}}];combined=guestRecord(changed,personal,image);assert.deepEqual(combined.tags,['管理者新版','下班']);assert.equal(combined.favorite,true);assert.equal(record(changed,image).notes,'更新');
assert.equal(guestRecord(changed,{},image).favorite,false);
const backup=guestBackup(folder,personal,'V1_2');assert.ok(validGuestBackup(backup,folder));assert.equal(validGuestBackup(backup,'different-folder'),false);assert.equal(validGuestBackup({schema:1,folder,events:[event]},folder),false);
assert.equal(validGuestBackup({...backup,personal:JSON.parse('{"__proto__":{}}')},folder),false);
console.log('PASS cloud labels plus personal annotations, favorites and backup isolation');
scenario='private';await assert.rejects(client.metadata(folder),/知道連結/);
scenario='partial';await assert.rejects(readPublicCollection(client,folder,true,result.events),/不完整/);assert.equal(result.files.length,1);
scenario='backup';result=await readPublicCollection(client,folder,true);assert.equal(result.events[0].id,event.id);
await assert.rejects(new PublicDrive('').metadata(folder),/guest-config.json/);
console.log('PASS private-folder denial, partial-list preservation, root backup fallback and missing-key guidance');
// Execute real app persistence and namespace switching: no private token or cloud queue is involved.
const src=fs.readFileSync('./app.mjs','utf8');const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const store=new Map([['owner@example.com:owner-folder:state',{files:[{id:'owner-image'}],events:[event],pending:['owner-pending'],jobs:[{id:'job'}]}]]);
let failSave=false;
const ctx=vm.createContext({defaultSynonyms:[],PublicDrive,structuredClone,heads,clearTimeout,console,record,
 get:async(_,k)=>structuredClone(store.get(k)),put:async(_,k,v)=>{if(failSave)throw Error('quota');store.set(k,structuredClone(v));},status(){},loadGoogleScript(){},isGuest:()=>vm.runInContext("cfg.mode==='guest'",ctx)});
vm.runInContext(`let db={},cfg={mode:'guest',guestFolder:'${folder}',folder:'owner-folder',account:'owner@example.com'},scope='',files=[],events=[],pending=[],jobs=[],backupState={},guestNotes={},publicDrive=null,siteConfig={apiKey:'${key}'},metaFolders=[],synonyms=[],syncTimer=null,backupTimer=null,syncError='',guestError='',drawVersion=0,viewGeneration=0;const key=k=>scope+':'+k;`,ctx);
vm.runInContext(extract('async function save(){','function persistCfg()')+extract('async function addEvent(','function formData()'),ctx);
await vm.runInContext('bind()',ctx);assert.equal(vm.runInContext('files.length',ctx),0);
await vm.runInContext(`addEvent('${image}',${JSON.stringify(personal[image])})`,ctx);assert.equal(vm.runInContext('pending.length',ctx),0);assert.equal(vm.runInContext('events.length',ctx),0);assert.equal(store.get('guest:'+folder+':state').guestNotes[image].notes,'只給自己看');
failSave=true;await assert.rejects(vm.runInContext(`addEvent('${image}',{notes:'failed'})`,ctx),/quota/);failSave=false;assert.equal(vm.runInContext(`guestNotes['${image}'].notes`,ctx),'只給自己看');
vm.runInContext("cfg.mode='owner'",ctx);await vm.runInContext('bind()',ctx);assert.equal(vm.runInContext('files[0].id',ctx),'owner-image');assert.equal(vm.runInContext('pending[0]',ctx),'owner-pending');assert.equal(vm.runInContext('jobs[0].id',ctx),'job');
vm.runInContext("cfg.mode='guest'",ctx);await vm.runInContext('bind()',ctx);assert.equal(vm.runInContext(`guestNotes['${image}'].notes`,ctx),'只給自己看');
console.log('PASS real guest save is local-only, quota rollback and owner/guest namespace separation');
// Cache updates use the network for deployment configuration and version checks.
const sw=fs.readFileSync('./sw.js','utf8');assert.ok(sw.includes("u.pathname.endsWith('/guest-config.json')"));assert.ok(sw.includes("'./guest.mjs'"));
assert.equal(fs.readFileSync('./index.html','utf8').includes('https://accounts.google.com/gsi/client'),false);
console.log('PASS guest config freshness and no sign-in script in guest shell');
