let M,A,loaded=new Map(),cv=document.getElementById('map'),ctx=cv.getContext('2d'),layer=document.getElementById('layer'),loading=document.getElementById('loading'),legend=document.getElementById('legend'),info=document.getElementById('info'),status=document.getElementById('status');
let W=0,H=0,dpr=1,s=1,ox=0,oy=0,drag=false,lx=0,ly=0;
const $=id=>document.getElementById(id), on=id=>$(id).checked;
function px(x){return x*s+ox} function py(y){return-y*s+oy}
function hash(v){v=String(v??'');let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function hsl(v){return `hsl(${hash(v)%360} 42% 55%)`}
function ramp(n,a,b){let t=Math.max(0,Math.min(1,(+n-a)/(b-a)));return `hsl(${220-210*t} 55% ${42+12*t}%)`}
function cellColor(o){
 let k=layer.value;
 if(k==='political'){let m=A.states[`${o.continent}:${o.state_id}`];return m?.color||'#aaa'}
 if(k==='continent')return hsl(o.continent);
 if(k==='elevation')return ramp(o.elevation_model_units,0,100);
 if(k==='temperature')return ramp(o.meanAnnualTemperatureF,-20,110);
 if(k==='precipitation')return ramp(o.estimatedAnnualPrecipitationIn,0,120);
 if(k==='biome')return hsl(o.reconstructedBiome||o.biome);
 if(k==='landcover')return hsl(o.permanentLandCover);
 if(k==='koppen')return hsl(o.koppenStyleClass);
 return '#aaa'
}
function visibleChunk(m){let [minx,maxx,miny,maxy]=M.bounds,[nx,ny]=M.grid,dx=(maxx-minx)/nx,dy=(maxy-miny)/ny,x0=-ox/s,x1=(W-ox)/s,y1=oy/s,y0=(oy-H)/s;return m.x>=Math.max(0,Math.floor((x0-minx)/dx))&&m.x<=Math.min(nx-1,Math.floor((x1-minx)/dx))&&m.y>=Math.max(0,Math.floor((y0-miny)/dy))&&m.y<=Math.min(ny-1,Math.floor((y1-miny)/dy))}
function loadedCells(){let n=0;for(let a of loaded.values())if(a)n+=a.length;return n}
function cached(){let n=0;for(let a of loaded.values())if(a)n++;return n}
function progress(p,stage,done,total,current=''){loading.classList.remove('hidden');$('loadBar').style.width=`${p}%`;$('loadPercent').textContent=`${Math.round(p)}%`;$('loadStage').textContent=stage;$('loadChunks').textContent=`Required chunks: ${done} / ${total}`;$('loadCache').textContent=`Cached globally: ${cached()} / ${M.chunks.length}`;$('loadCells').textContent=`Cells loaded: ${loadedCells().toLocaleString()} / ${M.count.toLocaleString()}`;$('loadCurrent').textContent=current?`Current: ${current}`:''}
async function loadVisible(){let need=M.chunks.filter(visibleChunk),missing=need.filter(m=>!loaded.has(m.file)||loaded.get(m.file)===null),done=need.length-missing.length,total=need.length;if(!missing.length){draw();return}for(let m of missing){if(!loaded.has(m.file))loaded.set(m.file,null);progress(total?done/total*88:0,'Downloading detailed geography…',done,total,m.file);try{let r=await fetch(m.file);if(!r.ok)throw Error(`${r.status} ${r.statusText}`);let a=await r.json();loaded.set(m.file,a);done++;progress(done/total*88,'Parsing map cells…',done,total,m.file)}catch(e){loaded.delete(m.file);progress(0,`Load failed: ${e.message}`,done,total,m.file);return}}progress(94,'Rendering atlas…',done,total);await new Promise(requestAnimationFrame);draw();progress(100,'Map ready',done,total);setTimeout(()=>loading.classList.add('hidden'),250)}
function path(points,close=false){if(!points?.length)return;ctx.beginPath();ctx.moveTo(px(points[0][0]),py(points[0][1]));for(let i=1;i<points.length;i++)ctx.lineTo(px(points[i][0]),py(points[i][1]));if(close)ctx.closePath()}
function draw(){
 ctx.fillStyle='#8eb9cf';ctx.fillRect(0,0,W,H);let n=0;
 for(let a of loaded.values())if(a)for(let o of a){path(o.polygon,true);ctx.fillStyle=cellColor(o);ctx.fill();n++}
 if(on('lakes')){ctx.fillStyle='#73aeca';for(let l of A.lakes){path(l.polygon_world_miles,true);ctx.fill()}}
 if(on('rivers')){ctx.strokeStyle='#4c91b5';ctx.lineWidth=Math.max(1,1.4);for(let r of A.rivers){path(r.points);ctx.stroke()}for(let q of A.hydrologyConnections){path(q.route_world_miles);ctx.stroke()}for(let q of A.minorDrainage){path(q.route_world_miles);ctx.stroke()}}
 if(on('roads')){ctx.strokeStyle='#8b765d';ctx.lineWidth=1;ctx.setLineDash([4,4]);for(let r of A.routes){path(r.points);ctx.stroke()}ctx.setLineDash([])}
 if(on('provinceBorders')){ctx.strokeStyle='#ffffff88';ctx.lineWidth=0.7;for(let q of A.provinceSegments){path([q.a,q.b]);ctx.stroke()}}
 if(on('stateBorders')){ctx.strokeStyle='#242424';ctx.lineWidth=1.8;for(let q of A.stateSegments){path([q.a,q.b]);ctx.stroke()}}
 if(on('settlements'))drawSettlements();
 if(on('markers')){ctx.fillStyle='#542d68';for(let m of A.markers){ctx.beginPath();ctx.arc(px(m.xMiles),py(m.yMiles),2.2,0,Math.PI*2);ctx.fill()}}
 if(on('labels'))drawLabels();
 status.textContent=`${n.toLocaleString()} detailed cells · ${cached()}/${M.chunks.length} chunks cached`;updateLegend()
}
function drawSettlements(){for(let b of A.burgs){let x=px(b.xMiles),y=py(b.yMiles);if(x<-10||x>W+10||y<-10||y>H+10)continue;let capital=+b.capital===1,r=capital?4:Math.max(1.7,Math.min(3.2,1.5+Math.log10(Math.max(1,+b.population||1))*.45));ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=capital?'#fff4cf':'#f5efe4';ctx.fill();ctx.strokeStyle='#242424';ctx.lineWidth=1;ctx.stroke()}}
function label(text,x,y,size,weight='500'){ctx.font=`${weight} ${size}px -apple-system,system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#ffffffdd';ctx.strokeText(text,x,y);ctx.fillStyle='#20272b';ctx.fillText(text,x,y)}
function drawLabels(){
 if(s<0.25){for(let q of A.kingdomLabels){let x=px(q.x),y=py(q.y);if(x>0&&x<W&&y>60&&y<H)label(q.name,x,y,11,'700')}}
 else {for(let q of A.kingdomLabels){let x=px(q.x),y=py(q.y);if(x>0&&x<W&&y>60&&y<H)label(q.name,x,y,13,'700')}}
 if(s>0.8)for(let p of A.provinceLabels){let x=px(p.xMiles),y=py(p.yMiles);if(x>0&&x<W&&y>60&&y<H)label(p.name,x,y,10)}
 if(s>0.45)for(let b of A.burgs){if(+b.capital!==1&&s<1.4)continue;let x=px(b.xMiles),y=py(b.yMiles);if(x>0&&x<W&&y>60&&y<H)label(b.name,x,y-7,+b.capital===1?11:9,+b.capital===1?'700':'500')}
}
function updateLegend(){
 let k=layer.value,items=[];
 if(k==='political'){let seen=new Set();for(let a of loaded.values())if(a)for(let o of a){let key=`${o.continent}:${o.state_id}`;if(!seen.has(key)&&A.states[key]){seen.add(key);items.push([A.states[key].color,A.states[key].name])}}items.sort((a,b)=>a[1].localeCompare(b[1]))}
 else if(['elevation','temperature','precipitation'].includes(k)){items=k==='elevation'?[['hsl(220 55% 42%)','Low'],['hsl(115 55% 48%)','Mid'],['hsl(10 55% 54%)','High']]:k==='temperature'?[['hsl(220 55% 42%)','Cold'],['hsl(115 55% 48%)','Temperate'],['hsl(10 55% 54%)','Hot']]:[['hsl(220 55% 42%)','Dry'],['hsl(115 55% 48%)','Moderate'],['hsl(10 55% 54%)','Wet']]}
 else {let field={continent:'continent',biome:'reconstructedBiome',landcover:'permanentLandCover',koppen:'koppenStyleClass'}[k],seen=new Set();for(let a of loaded.values())if(a)for(let o of a){let v=o[field];if(v!=null&&!seen.has(v)){seen.add(v);items.push([hsl(v),String(v)])}}items.sort((a,b)=>a[1].localeCompare(b[1]))}
 legend.innerHTML='<b>Key</b>'+items.slice(0,80).map(x=>`<div class="legendRow"><span class="swatch" style="background:${x[0]}"></span><span>${x[1]}</span></div>`).join('')
}
function fit(){let b=M.bounds;s=Math.min(W/(b[1]-b[0]),H/(b[3]-b[2]))*.94;ox=(W-(b[1]-b[0])*s)/2-b[0]*s;oy=(H-(b[3]-b[2])*s)/2+b[3]*s;loadVisible()}
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function inspect(ex,ey){let wx=(ex-ox)/s,wy=(oy-ey)/s,best=null,bd=1e99;for(let a of loaded.values())if(a)for(let o of a){let c=o.center,dd=(c[0]-wx)**2+(c[1]-wy)**2;if(dd<bd){bd=dd;best=o}}if(best){info.innerHTML='<b>Detailed cell</b><table>'+Object.entries(best).filter(([k])=>k!=='polygon').map(([k,v])=>`<tr><td>${k}</td><td>${typeof v==='object'?JSON.stringify(v):String(v??'')}</td></tr>`).join('')+'</table>';info.classList.remove('hidden')}}
cv.onpointerdown=e=>{drag=true;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(drag){ox+=e.clientX-lx;oy+=e.clientY-ly;lx=e.clientX;ly=e.clientY;draw()}};cv.onpointerup=()=>{drag=false;loadVisible()};cv.ondblclick=e=>inspect(e.clientX,e.clientY);
cv.addEventListener('wheel',e=>{e.preventDefault();let k=Math.exp(-e.deltaY*.001),wx=(e.clientX-ox)/s,wy=(oy-e.clientY)/s;s*=k;ox=e.clientX-wx*s;oy=e.clientY+wy*s;loadVisible()},{passive:false});
let pd=0,ps=1;cv.addEventListener('touchstart',e=>{if(e.touches.length===2){drag=false;pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);ps=s}},{passive:true});cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&pd){let q=e.touches,d=Math.hypot(q[0].clientX-q[1].clientX,q[0].clientY-q[1].clientY);s=ps*d/pd;draw()}},{passive:true});cv.addEventListener('touchend',()=>loadVisible(),{passive:true});
$('layersBtn').onclick=()=>$('overlays').classList.toggle('hidden');$('fit').onclick=fit;layer.onchange=draw;for(let id of ['rivers','lakes','settlements','labels','stateBorders','provinceBorders','roads','markers'])$(id).onchange=draw;addEventListener('resize',resize);
Promise.all([fetch('manifest.json').then(r=>r.json()),fetch('atlas.json').then(r=>r.json())]).then(([m,a])=>{M=m;A=a;resize();fit()}).catch(e=>{loading.classList.remove('hidden');$('loadStage').textContent='LOAD ERROR: '+e.message});
