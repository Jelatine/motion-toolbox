'use strict';
const $=id=>document.getElementById(id), M=DHMath;
let rows=[], convention='MDH', angle='deg', length='mm', model, playing=false, lastTime=0, animationId=0;
const camera={yaw:0.75,pitch:0.48,scale:220,target:[0,0,0.4],pan:[0,0]};
const canvas=$('scene'),ctx=canvas.getContext('2d');
let width=800,height=480;
const fmt=n=>Number(n.toPrecision(10)).toString();
const fixed=n=>(Math.abs(n)<0.0000005?0:n).toFixed(6);
const angleLabel=()=>angle==='deg'?'°':'rad';
const kind=(row,key)=>['alpha','theta'].includes(key)?'angle':['a','d'].includes(key)?'length':row.type==='R'?'angle':'length';
const factor=(row,key)=>M.factor(kind(row,key),angle,length);
const unit=row=>row.type==='R'?angleLabel():length;
function stop(){playing=false;cancelAnimationFrame(animationId);$('play').textContent='▶ 播放运动';lastTime=0;}
function example(){
  stop();
  rows=[
    {type:'R',a:0,alpha:0,d:0.3,theta:0,q:Math.PI/6,min:-Math.PI,max:Math.PI},
    {type:'R',a:0.3,alpha:Math.PI/2,d:0,theta:0,q:Math.PI/5,min:-Math.PI/2,max:Math.PI/2},
    {type:'P',a:0.25,alpha:0,d:0.1,theta:0,q:0.08,min:0,max:0.3},
    {type:'R',a:0.18,alpha:-Math.PI/2,d:0,theta:0,q:0,min:-Math.PI,max:Math.PI}
  ];
  rebuild();fit();
}
function rebuild(){
  $('error').textContent='';
  const sub=convention==='MDH'?'ᵢ₋₁':'ᵢ';
  $('parameter-head').innerHTML='<tr>'+['关节','类型',`a${sub} (${length})`,`α${sub} (${angleLabel()})`,`d₀ (${length})`,`θ₀ (${angleLabel()})`,'q 下限','q 上限',''].map(t=>`<th scope="col">${t}</th>`).join('')+'</tr>';
  $('parameter-body').innerHTML=rows.map((r,i)=>`<tr><td>J${i+1}</td><td><select data-index="${i}" data-key="type" aria-label="J${i+1} 类型"><option value="R" ${r.type==='R'?'selected':''}>旋转轴 R</option><option value="P" ${r.type==='P'?'selected':''}>平移轴 P</option></select></td>${['a','alpha','d','theta','min','max'].map(k=>`<td><input type="number" step="any" data-index="${i}" data-key="${k}" aria-label="J${i+1} ${k}" value="${fmt(r[k]/factor(r,k))}" required></td>`).join('')}<td><button data-delete="${i}" aria-label="删除 J${i+1}" ${rows.length===1?'disabled':''}>删除</button></td></tr>`).join('');
  $('controls').innerHTML=rows.map((r,i)=>`<div class="joint"><div class="joint-title"><strong>J${i+1} · ${r.type==='R'?'旋转轴':'平移轴'}</strong><span class="badge">${unit(r)}</span></div><div class="joint-controls"><input type="range" data-index="${i}" data-q="range" aria-label="J${i+1} 运动滑块" min="${r.min/factor(r,'q')}" max="${r.max/factor(r,'q')}" step="any" value="${r.q/factor(r,'q')}"><input type="number" data-index="${i}" data-q="number" aria-label="J${i+1} 关节位置" min="${r.min/factor(r,'q')}" max="${r.max/factor(r,'q')}" step="any" value="${fmt(r.q/factor(r,'q'))}" required></div><small>${fmt(r.min/factor(r,'q'))} ～ ${fmt(r.max/factor(r,'q'))} ${unit(r)}</small></div>`).join('');
  $('formula').textContent=convention==='MDH'?'MDH：Tᵢ₋₁,ᵢ = Rx(αᵢ₋₁) · Tx(aᵢ₋₁) · Rz(θᵢ) · Tz(dᵢ)':'SDH：Tᵢ₋₁,ᵢ = Rz(θᵢ) · Tz(dᵢ) · Tx(aᵢ) · Rx(αᵢ)';
  $('joint-count').textContent=`${rows.length} 个关节`;
  $('scene-badge').textContent=`${convention} / ${angleLabel()} / ${length}`;
  $('add').disabled=rows.length>=20;update();
}
function update(){
  model=M.forward(rows,convention);
  const f=M.factor('length',angle,length);$('position-unit').textContent=length;
  $('position').innerHTML=M.origin(model.end).map((v,i)=>`<div><span class="muted">${'XYZ'[i]}</span><b>${fixed(v/f)}</b></div>`).join('');
  $('matrix').innerHTML=[0,1,2,3].map(r=>'<tr>'+[0,1,2,3].map(c=>`<td>${fixed(model.end[r*4+c]/(r<3&&c===3?f:1))}</td>`).join('')+'</tr>').join('');draw();
}
function syncControls(){document.querySelectorAll('[data-q]').forEach(el=>{const r=rows[+el.dataset.index];el.value=fmt(r.q/factor(r,'q'));el.removeAttribute('aria-invalid');});}
$('parameter-body').addEventListener('change',e=>{
  const el=e.target,k=el.dataset.key,i=+el.dataset.index;if(!k)return;stop();const r=rows[i];
  if(k==='type'){r.type=el.value;r.q=0;r.min=r.type==='R'?-Math.PI:0;r.max=r.type==='R'?Math.PI:0.3;rebuild();return;}
  const v=el.value.trim()===''?NaN:Number(el.value)*factor(r,k);
  if(!Number.isFinite(v)||Math.abs(v)>1e6||(k==='min'&&v>=r.max)||(k==='max'&&v<=r.min)){
    $('error').textContent=`J${i+1}：请输入有效数值（内部值绝对值不超过 10⁶ rad / m），且下限必须小于上限。已保留原值。`;el.value=fmt(r[k]/factor(r,k));return;
  }
  r[k]=v;r.q=Math.max(r.min,Math.min(r.max,r.q));rebuild();
});
$('parameter-body').addEventListener('click',e=>{const el=e.target.closest('[data-delete]');if(!el||rows.length===1)return;stop();rows.splice(+el.dataset.delete,1);rebuild();});
function setJoint(el){
  const r=rows[+el.dataset.index],v=el.value.trim()===''?NaN:Number(el.value)*factor(r,'q');stop();
  const tolerance=1e-9*Math.max(1,Math.abs(r.min),Math.abs(r.max));
  if(!Number.isFinite(v)||v<r.min-tolerance||v>r.max+tolerance){$('error').textContent=`J${+el.dataset.index+1}：q 必须在 ${fmt(r.min/factor(r,'q'))} ～ ${fmt(r.max/factor(r,'q'))} ${unit(r)} 范围内。`;el.setAttribute('aria-invalid','true');return;}
  el.removeAttribute('aria-invalid');$('error').textContent='';r.q=Math.max(r.min,Math.min(r.max,v));syncControls();update();
}
$('controls').addEventListener('input',e=>{if(e.target.dataset.q==='range')setJoint(e.target);});
$('controls').addEventListener('change',e=>{if(e.target.dataset.q==='number'){setJoint(e.target);if(e.target.getAttribute('aria-invalid'))syncControls();}});
for(const id of ['convention','angle-unit','length-unit']) $(id).addEventListener('change',()=>{stop();convention=$('convention').value;angle=$('angle-unit').value;length=$('length-unit').value;rebuild();});
$('add').onclick=()=>{if(rows.length>=20)return;stop();rows.push({type:'R',a:0.2,alpha:0,d:0,theta:0,q:0,min:-Math.PI,max:Math.PI});rebuild();fit();};
$('example').onclick=example;
$('zero').onclick=()=>{stop();rows.forEach(r=>r.q=Math.max(r.min,Math.min(r.max,0)));rebuild();if(rows.some(r=>r.q!==0))$('error').textContent='部分关节的范围不包含 0，已移至最接近 0 的限位。';};
$('play').onclick=()=>{if(playing){stop();return;}playing=true;lastTime=0;$('error').textContent='';syncControls();$('play').textContent='Ⅱ 暂停运动';animationId=requestAnimationFrame(animate);};
function animate(time){
  if(!playing)return;const dt=lastTime?Math.min((time-lastTime)/1000,0.05):0;lastTime=time;
  rows.forEach(r=>{const span=r.max-r.min;let phase=(r.q-r.min)/span;if(r.direction===-1)phase=2-phase;phase=(phase+dt/4)%2;r.direction=phase<1?1:-1;r.q=r.min+span*(phase<1?phase:2-phase);});
  syncControls();update();animationId=requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
// Orthographic camera, world Z up. Primitives are sorted by camera depth.
function project(p){
  const [x,y,z]=p.map((v,i)=>v-camera.target[i]),c=Math.cos(camera.yaw),s=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  const horizontal=c*x-s*y,depth=s*x+c*y;
  return [width/2+camera.pan[0]+horizontal*camera.scale,height/2+camera.pan[1]-(cp*z-sp*depth)*camera.scale,cp*depth+sp*z];
}
function fit(){
  const points=model.paths.flat(),lo=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
  camera.target=lo.map((v,i)=>(v+hi[i])/2);camera.pan=[0,0];const span=Math.max(Math.hypot(...hi.map((v,i)=>v-lo[i])),0.1);camera.scale=Math.min(width,height)*0.65/span;draw();
}
function draw(){
  if(!model)return;ctx.clearRect(0,0,width,height);const primitives=[];
  function line(a,b,color,size=1,dash=false){const p=project(a),q=project(b);primitives.push({depth:(p[2]+q[2])/2,paint(){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineCap='round';ctx.setLineDash(dash?[5,5]:[]);ctx.stroke();ctx.setLineDash([]);}});}
  function marker(p,label,color,square=false){const q=project(p);primitives.push({depth:q[2]+0.00001,paint(){ctx.fillStyle=color;ctx.strokeStyle='#0b1220';ctx.lineWidth=2;ctx.beginPath();if(square)ctx.rect(q[0]-6,q[1]-6,12,12);else ctx.arc(q[0],q[1],6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font='12px Segoe UI';ctx.fillStyle='#e2e8f0';ctx.fillText(label,q[0]+10,q[1]-9);}});}
  const worldSpan=Math.min(width,height)/camera.scale,raw=worldSpan/8,base=10**Math.floor(Math.log10(raw)),gridStep=[1,2,5,10].map(x=>x*base).find(x=>x>=raw);
  const extent=gridStep*8,cx=Math.round(camera.target[0]/gridStep)*gridStep,cy=Math.round(camera.target[1]/gridStep)*gridStep;
  for(let i=-8;i<=8;i++){line([cx+i*gridStep,cy-extent,0],[cx+i*gridStep,cy+extent,0],'#243449');line([cx-extent,cy+i*gridStep,0],[cx+extent,cy+i*gridStep,0],'#243449');}
  primitives.forEach(p=>p.paint());primitives.length=0;
  const axisSize=worldSpan*0.085;
  model.paths.forEach((path,i)=>{for(let j=1;j<path.length;j++)line(path[j-1],path[j],rows[i].type==='R'?'#38bdf8':'#fbbf24',7);});
  model.joints.forEach((t,i)=>{if($('axes').checked)line(M.point(t,[0,0,-axisSize]),M.point(t,[0,0,axisSize]),'#c4b5fd',2,true);marker(M.origin(t),`J${i+1}`,rows[i].type==='R'?'#38bdf8':'#fbbf24',rows[i].type==='P');});
  model.frames.forEach((t,i)=>{
    if(!$('frames').checked)return;const origin=M.origin(t);
    ['#fb7185','#4ade80','#60a5fa'].forEach((color,k)=>{const p=[0,0,0];p[k]=axisSize;line(origin,M.point(t,p),color,2);});
    const q=project(origin);primitives.push({depth:q[2]+0.00002,paint(){ctx.fillStyle='#94a3b8';ctx.font='11px Segoe UI';ctx.fillText(`F${i}`,q[0]+9,q[1]+17);}});
  });
  marker(M.origin(model.end),'末端','#34d399');primitives.sort((a,b)=>a.depth-b.depth).forEach(p=>p.paint());
  ctx.fillStyle='#94a3b8';ctx.font='12px Segoe UI';ctx.fillText(`网格 ${fmt(gridStep/M.factor('length',angle,length))} ${length} · 正交视图`,16,height-16);
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(drag.pan){camera.pan[0]+=dx;camera.pan[1]+=dy;}else{camera.yaw+=dx*0.008;camera.pitch=Math.max(-1.56,Math.min(1.56,camera.pitch+dy*0.008));}draw();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.scale=Math.max(1e-6,Math.min(1e9,camera.scale*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*0.002)));draw();},{passive:false});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')fit();else if(e.key==='+')camera.scale=Math.min(1e9,camera.scale*1.1);else if(e.key==='-')camera.scale=Math.max(1e-6,camera.scale/1.1);else if(e.key==='ArrowLeft')camera.yaw-=0.1;else if(e.key==='ArrowRight')camera.yaw+=0.1;else camera.pitch=Math.max(-1.56,Math.min(1.56,camera.pitch+(e.key==='ArrowUp'?0.1:-0.1)));draw();}});
$('fit').onclick=fit;$('home-view').onclick=()=>{camera.yaw=0.75;camera.pitch=0.48;fit();};$('frames').onchange=draw;$('axes').onchange=draw;
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;const first=canvas.width===300;width=rect.width;height=rect.height;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);if(first)fit();else draw();}).observe(canvas);
example();
