import { generateChunk, orderChunkCoordinates, canonicalizeWorld, CONTENT_VERSION } from "./generator.js";
const $ = (id) => document.getElementById(id);
const canvas = $("world"), ctx = canvas.getContext("2d");
const colors = {water:"#26516b",shallows:"#487e87",sand:"#d1bd80",meadow:"#7d9859",forest:"#486e45",marsh:"#648174",hill:"#a1a274",mountain:"#989989"};
let player = {x:0,y:0}, chunks = [], collected = new Set(), items = [], epoch = 0, evidence;
let config = {seed:"20261102",workers:4,order:"normal",grass:true};
let center = "", loading = false;
const sha = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b)=>b.toString(16).padStart(2,"0")).join("");

async function generate(requests, workerCount) {
  if (!workerCount) {
    const results=[];
    for (const request of requests) {
      await new Promise((resolve)=>setTimeout(resolve,0));
      results.push(generateChunk(request));
    }
    return results;
  }
  const pool=Array.from({length:workerCount},()=>new Worker(new URL("worker.js",import.meta.url),{type:"module"}));
  try {
    const queues=pool.map(()=>[]);
    requests.forEach((request,index)=>queues[index%pool.length].push({request,index}));
    const result=await Promise.all(pool.map((worker,index)=>new Promise((resolve,reject)=>{
      const found=[]; let cursor=0;
      const next=()=>{
        if(cursor===queues[index].length){resolve(found);return;}
        const job=queues[index][cursor++];
        worker.postMessage({kind:"generate",requestId:job.index,request:job.request});
      };
      worker.onerror=(event)=>reject(new Error(event.message));
      worker.onmessage=({data})=>{
        if(data.kind==="error"){reject(new Error(data.error.message));return;}
        found.push(data.chunk); next();
      };
      next();
    })));
    return result.flat();
  } finally { pool.forEach((worker)=>worker.terminate()); }
}
function coordinates() {
  const cx=Math.floor(player.x/16),cy=Math.floor(player.y/16), result=[];
  for(let y=cy-1;y<=cy+1;y++) for(let x=cx-1;x<=cx+1;x++) result.push({x,y});
  return result;
}
async function refresh() {
  const ticket=++epoch; loading=true; $("status").textContent="Loading nearby chunks…";
  const snapshot={...config}, coords=orderChunkCoordinates(coordinates(),snapshot.seed,snapshot.order);
  center=`${Math.floor(player.x/16)},${Math.floor(player.y/16)}`;
  try {
    const generated=await generate(coords.map(({x,y})=>({seed:snapshot.seed,cx:x,cy:y,includeGrass:snapshot.grass})),snapshot.workers);
    if(ticket!==epoch)return;
    chunks=generated;
    const fingerprint=await sha(canonicalizeWorld(chunks));
    if(ticket!==epoch)return;
    $("fingerprint").textContent=fingerprint;
    $("status").textContent=`${chunks.length} chunks ready. Explore and gather berries or caches.`;
  } catch(error){if(ticket===epoch)$("status").textContent=error.message;}
  finally {if(ticket===epoch)loading=false;}
}
function move(dx,dy) {
  const x=player.x+dx,y=player.y+dy;
  const tile=chunks.flatMap((chunk)=>chunk.tiles).find((t)=>t.x===x&&t.y===y);
  if(!tile||["water","mountain"].includes(tile.terrain))return;
  if(chunks.some((chunk)=>chunk.entities.some((entity)=>entity.x===x&&entity.y===y&&entity.blocking)))return;
  player={x,y}; $("position").textContent=`${x}, ${y}`;
  if(!loading&&`${Math.floor(x/16)},${Math.floor(y/16)}`!==center)refresh();
}
function gather() {
  const nearby=chunks.flatMap((chunk)=>chunk.entities).filter((e)=>Math.abs(e.x-player.x)<=1&&Math.abs(e.y-player.y)<=1&&e.loot&&!collected.has(e.id));
  for(const entity of nearby){collected.add(entity.id);items.push(entity.loot);}
  $("inventory").textContent=items.length?`${items.length} gathered: ${items.slice(-5).join(", ")}`:"Empty";
  $("status").textContent=nearby.length?`Gathered ${nearby.length} item(s).`:"No uncollected items within reach.";
}
function draw() {
  ctx.fillStyle="#152923";ctx.fillRect(0,0,canvas.width,canvas.height);
  const size=24,ox=canvas.width/2-player.x*size,oy=canvas.height/2-player.y*size;
  for(const chunk of chunks) {
    for(const tile of chunk.tiles){const x=ox+tile.x*size,y=oy+tile.y*size;if(x< -size||y< -size||x>canvas.width||y>canvas.height)continue;ctx.fillStyle=colors[tile.terrain];ctx.fillRect(x,y,size+1,size+1);}
    for(const blade of chunk.grass||[]){ctx.fillStyle="#a8b77b";ctx.fillRect(ox+blade.x*size+8,oy+blade.y*size+10,2,6);}
    for(const e of chunk.entities){if(collected.has(e.id))continue;const x=ox+e.x*size+12,y=oy+e.y*size+12;ctx.fillStyle=e.type==="tree"?"#244631":e.type==="rock"?"#626e67":e.type==="ruin"?"#d1c8a3":"#eac276";ctx.beginPath();ctx.arc(x,y,e.blocking?9:5,0,Math.PI*2);ctx.fill();}
  }
  ctx.fillStyle="#f4f0da";ctx.fillRect(canvas.width/2+6,canvas.height/2+3,12,17);ctx.fillStyle="#24454a";ctx.fillRect(canvas.width/2+9,canvas.height/2+6,6,5);
  requestAnimationFrame(draw);
}
$("apply").onclick=()=>{
  try{BigInt($("seed").value);}catch{$("status").textContent="Enter an integer seed.";return;}
  if(config.seed!==$("seed").value){player={x:0,y:0};chunks=[];collected.clear();items=[];$("inventory").textContent="Empty";$("position").textContent="0, 0";$("fingerprint").textContent="—";}
  config={seed:$("seed").value,workers:Number($("workers").value),order:$("order").value,grass:$("grass").checked};
  evidence=null;$("export").disabled=true;refresh();canvas.focus();
};
document.addEventListener("keydown",(event)=>{
  if(["INPUT","SELECT","BUTTON"].includes(event.target.tagName))return;
  const moves={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
  if(moves[event.key]){event.preventDefault();move(...moves[event.key]);}else if(event.key.toLowerCase()==="e")gather();
});
document.querySelectorAll("[data-move]").forEach((button)=>button.onclick=()=>move(...button.dataset.move.split(",").map(Number)));
$("gather").onclick=gather;
$("prove").onclick=async()=>{
  $("prove").disabled=true; const snapshot={...config},coords=coordinates(),results=[];
  try{
    for(const order of ["normal","reverse","shuffled"])for(const workers of [0,1,4])for(const grass of [false,true]){
      $("proof").textContent=`Checking ${order}, ${workers} workers, grass ${grass}…`;
      const requests=orderChunkCoordinates(coords,snapshot.seed,order).map(({x,y})=>({seed:snapshot.seed,cx:x,cy:y,includeGrass:grass}));
      results.push({order,workers,grass,sha256:await sha(canonicalizeWorld(await generate(requests,workers)))});
    }
    const passed=new Set(results.map((row)=>row.sha256)).size===1;
    evidence={seed:snapshot.seed,contentVersion:CONTENT_VERSION,algorithm:"esinxe-v1",coordinates:coords,recordedAt:new Date().toISOString(),passed,results};
    $("proof").textContent=passed?"18 configurations produced identical core content.":"Content mismatch detected; export evidence for investigation.";
    $("export").disabled=false;
  }catch(error){$("proof").textContent=error.message;}finally{$("prove").disabled=false;}
};
$("export").onclick=()=>{if(!evidence)return;const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="verdant-evidence.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
refresh();draw();
