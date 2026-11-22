import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {heads,record,score,validEvent} from './core.mjs';
import {mergeEvents,ackPending,makeBackup} from './sync-state.mjs';
import * as driveReal from './drive.mjs';
const src=fs.readFileSync('./app.mjs','utf8');
const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const base={title:'',tags:['貓'],scene:'',phrase:'',text:'',notes:'想下班',confirmed:true};
const rev=(id,parents=[])=>({schema:1,id,fileId:'image1',parents,time:'2026-11-21T00:00:00Z',data:structuredClone(base)});
let store=new Map(),sent=[],generation=0,remote=[],pause=null,failWrite=false;
const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,close(){},open:true});return elements.get(id);};
const ctx=vm.createContext({mergeEvents,ackPending,makeBackup,heads,record,validEvent,structuredClone,crypto:{randomUUID},Date,Set,Map,JSON,console,VERSION:'V1_4',navigator:{onLine:true},$,
 drive:{connected:()=>true,children:async()=>{if(pause)await pause;return remote.map(e=>({id:e.driveId,name:e.id+'.json',mimeType:'application/json'}));},media:async id=>new Blob([JSON.stringify(remote.find(e=>e.driveId===id))]),generateId:async()=>`drive-${++generation}`,writeJSON:async(parent,id,data,name)=>{if(failWrite){failWrite=false;throw Error('simulated connection failure');}sent.push({parent,id,data:structuredClone(data),name});}},
 put:async(db,k,v)=>{store.set(k,structuredClone(v));},get:async(db,k)=>structuredClone(store.get(k)),del:async(db,k)=>store.delete(k),
 requireScope(){},ensureMeta:async()=>{},status(){},persistCfg(){},toast(){},fail(e){throw e;},scheduleSync(){},scheduleBackup(){},maybeActivate(){},clearTimeout(){},render(){},formData:()=>({...base,notes:'第二張備註'}),edit:async()=>{},
});
vm.runInContext(`let db={},cfg={folder:'target-folder'},scope='test',files=[{id:'image1',name:'貓.png'},{id:'image2',name:'貓二.png'}],events=[],pending=[],jobs=[],synonyms=[],metaFolders=[{id:'metadata-folder'}],syncPromise=null,syncing=false,syncError='',backupTimer=null,backupPromise=null,backingUp=false,backupState={dirty:false},savingEdit=false,editParents=[],editId='image2',editIndex=0,editQueue=['image2','image3'],draftWrite=Promise.resolve();const key=k=>scope+':'+k;`,ctx);
vm.runInContext(extract('async function save(){','async function bind()')+extract('function sync(){','async function scan(')+extract('async function addEvent(','function formData()')+extract('async function saveEdit(','$(\'#editform\').onsubmit'),ctx);
let release;pause=new Promise(r=>release=r);vm.runInContext("events=["+JSON.stringify(rev('old'))+"];pending=['old'];",ctx);
const running=vm.runInContext('sync()',ctx);await Promise.resolve();
await vm.runInContext("addEvent('image2',{...events[0].data,notes:'同步讀取時新增'})",ctx);
const addedId=vm.runInContext('pending.at(-1)',ctx);remote=[{...rev('remote'),driveId:'remote-id'}];pause=null;release();await running;
assert.ok(vm.runInContext('events',ctx).some(e=>e.id===addedId));assert.equal(vm.runInContext('pending.length',ctx),0);assert.equal(sent.filter(e=>e.parent==='metadata-folder').length,2);
console.log('PASS background read merge preserves concurrent edits');
// Acknowledgement removes only the uploaded item, not later work.
assert.deepEqual(ackPending(['first','later'],'first'),['later']);
await vm.runInContext("addEvent('image1',{...events[0].data,notes:'失敗後重試'})",ctx);failWrite=true;await assert.rejects(vm.runInContext('sync()',ctx),/simulated/);const failed=vm.runInContext('events.find(e=>e.id===pending[0])',ctx);const id=failed.driveId;await vm.runInContext('sync()',ctx);assert.equal(sent.at(-1).id,id);assert.equal(vm.runInContext('pending.length',ctx),0);console.log('PASS retry retains revision and Drive ID');
// Save-and-next must resolve while a slow cloud operation is still outstanding.
pause=new Promise(r=>release=r);const slow=vm.runInContext('sync()',ctx);await Promise.resolve();await vm.runInContext('saveEdit(true)',ctx);assert.ok(vm.runInContext('events',ctx).some(e=>e.fileId==='image2'&&e.data.notes==='第二張備註'));assert.equal(vm.runInContext('syncing',ctx),true);assert.equal(vm.runInContext('savingEdit',ctx),false);pause=null;release();await slow;console.log('PASS save-and-next completes before cloud synchronization');
// Preserve a concurrent remote edit as a conflict when editing from old parents.
assert.equal(record([rev('a'),rev('b',['a']),rev('c',['a'])],'image1').conflict,true);
await vm.runInContext('cloudBackup()',ctx);const backup=sent.at(-1);assert.equal(backup.parent,'target-folder');assert.match(backup.name,/^MemeFinder-Marks-/);assert.ok(backup.data.records.some(r=>r.notes==='第二張備註'));assert.ok(backup.data.events.every(validEvent));assert.equal(vm.runInContext('backupState.dirty',ctx),false);console.log('PASS timestamped backup contains notes, file IDs and full revisions in configured folder');
failWrite=true;await assert.rejects(vm.runInContext('cloudBackup()',ctx));const work=store.get('test:backupWork');assert.ok(work);await vm.runInContext("addEvent('image1',{...events[0].data,notes:'備份失敗後新增'})",ctx);await vm.runInContext('cloudBackup()',ctx);assert.equal(sent.at(-1).id,work.id);assert.equal(vm.runInContext('backupState.dirty',ctx),true);assert.equal(store.has('test:backupWork'),false);await vm.runInContext('cloudBackup()',ctx);assert.equal(vm.runInContext('backupState.dirty',ctx),false);console.log('PASS backup retries same file; later changes stay dirty until newer snapshot');
assert.ok(score({name:'a'},base,'想下班',[])>0);vm.runInContext(extract('function isMarked(','function needsReview('),ctx);assert.ok(vm.runInContext("isMarked({notes:'備註',confirmed:true})",ctx));console.log('PASS notes searchable and notes-only record counts as marked');
// Actual multipart request builds folder and user-visible backup filename.
driveReal.setToken('test',3600);let body;globalThis.fetch=async(url,o)=>{body=o.body;return new Response('{"id":"abc"}',{status:200});};await driveReal.writeJSON('root-id','abc',{schema:1,events:[]},'MemeFinder-Marks-test.json');assert.ok(body.includes('"parents":["root-id"]'));assert.ok(body.includes('"name":"MemeFinder-Marks-test.json"'));console.log('PASS real multipart backup metadata');
