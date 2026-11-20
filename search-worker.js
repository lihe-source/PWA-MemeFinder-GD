import {score} from './core.mjs';
onmessage=({data:d})=>{postMessage({seq:d.seq,ids:d.rows.map(x=>({id:x.id,s:score(x,x.r,d.query,d.groups)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.id)});};
