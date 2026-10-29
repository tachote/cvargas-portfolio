// Opt-in from the home Play button; CSP-safe (no inline style attrs).
/* Gate mini-game · cvargas.com · Diseño
   Overlay que se juega al entrar. Lee CVEs de <script type="application/json" id="gate-cves">.
   Se salta con: Skip/Esc, sessionStorage 'gate', prefers-reduced-motion, ?nogate. */
import './vgate.css';
export function openGate(CVES,ST={}){
if(!CVES.length||document.getElementById('gate'))return;
const SPR={'SQLi':'sqli','XSS':'xss','SSRF':'ssrf','IDOR':'idor','Auth bypass':'authbypass'};
const COL={crit:'#B0213A',high:'#D9542B',med:'#C9A227',low:'#6E8F5A'};
const sev=v=>v>=9?'crit':v>=7?'high':v>=4?'med':'low';
const imgs={};for(const k in SPR){const i=new Image();i.src='/fx/sprites/'+SPR[k]+'.svg';imgs[k]=i}
document.documentElement.style.overflow='hidden';
const root=document.createElement('div');root.id='gate';root.setAttribute('role','dialog');root.setAttribute('aria-label','Intro mini-game');
root.innerHTML=`<canvas></canvas>
<div class="g-doors"><i></i><i></i></div>
<div class="g-hud"><span>KILLS <b id="g-k">0</b>/${CVES.length}</span><span id="g-t">20</span></div>
<ol class="g-log" aria-live="polite"></ol>
<div class="g-title"><div class="g-row"><aside class="g-card"><p class="g-lv">HUNTER · Lv. 24</p><img src="/fx/avatar-hunter-240.webp" width="120" height="139" alt=""><dl><dt>CVEs</dt><dd>${ST.cves??CVES.length}</dd><dt>Trophies</dt><dd>${ST.trophies??"–"}</dd><dt>Relics</dt><dd>${ST.relics??"–"}</dd></dl></aside><div><h1>CRISTIAN<br>VARGAS</h1><p>Offensive AppSec · Bestiary of ${CVES.length} CVEs</p><button class="g-start">▶ START</button><small>WASD / arrows · drag on mobile</small></div></div></div>
<button class="g-skip">Skip (Esc) → CV</button>`;
document.body.appendChild(root);
const c=root.querySelector('canvas'),x=c.getContext('2d'),log=root.querySelector('.g-log'),kEl=root.querySelector('#g-k'),tEl=root.querySelector('#g-t');
let W,H,dpr=Math.min(2,devicePixelRatio||1);
const rs=()=>{W=innerWidth;H=innerHeight;c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';x.setTransform(dpr,0,0,dpr,0,0)};rs();addEventListener('resize',rs);
const P={x:0,y:0,f:1,hit:0},keys={},E=[],FX=[];let queue=CVES.map((v,i)=>({...v,i})).sort(()=>Math.random()-.5);
let state='title',kills=0,t0=0,lastWhip=0,touch=null,raf,spawnT=0,DUR=20;
function end(){if(state==='open')return;state='open';sessionStorage.setItem('gate','1');root.classList.add('open');
  setTimeout(()=>{cancelAnimationFrame(raf);root.remove();document.documentElement.style.overflow='';removeEventListener('keydown',kd)},1100)}
function start(){if(state!=='title')return;state='play';root.classList.add('playing');t0=-1;spawn(1);spawn(1);spawn(1)}
const kd=e=>{const k=e.key.toLowerCase();if(k==='escape')return end();if(state==='title'&&(k==='enter'||k===' ')){e.preventDefault();return start()}keys[k]=1;if(k.startsWith('arrow')||k===' ')e.preventDefault()};
addEventListener('keydown',kd);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
root.querySelector('.g-skip').onclick=end;root.querySelector('.g-start').onclick=start;
c.addEventListener('pointerdown',e=>{if(state==='title')return start();touch={x:e.clientX,y:e.clientY}});
c.addEventListener('pointermove',e=>{if(touch)touch={x:e.clientX,y:e.clientY}});
addEventListener('pointerup',()=>touch=null);
function spawn(near){const v=queue.shift();if(!v)return;const a=Math.random()*6.283,r=near?Math.min(W,H)*.38:Math.hypot(W,H)*.5+20;
  E.push({x:P.x+Math.cos(a)*r,y:P.y+Math.sin(a)*r,v,hp:v.cvss4>=8?3:2,max:v.cvss4>=8?3:2,fl:0,sp:1.3+Math.random()*.8})}
function loot(e){kills++;kEl.textContent=kills;const li=document.createElement('li');
  const bb=document.createElement('b');bb.style.color=COL[sev(e.v.cvss4)];bb.textContent=e.v.cvss4.toFixed(1);li.append(bb,` ${e.v.id} · ${e.v.product.split(' ')[0]}`);log.prepend(li);
  if(log.children.length>5)log.lastChild.remove();
  FX.push({x:e.x,y:e.y,t:0,txt:e.v.id,c:COL[sev(e.v.cvss4)]});for(let i=0;i<14;i++)FX.push({x:e.x,y:e.y,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,t:0,p:1,c:COL[sev(e.v.cvss4)]})}
function hero(px,py){const b=Math.sin(Date.now()/90)*(Math.abs(P.vx||0)+Math.abs(P.vy||0)>0?2:0);
  x.save();x.translate(px,py+b);x.scale(P.f,1);
  x.fillStyle='#3A2A44';x.fillRect(-9,-4,18,18);           // capa
  x.fillStyle=P.hit>0?'#B0213A':'#EDE6D6';x.fillRect(-6,-14,12,10); // cabeza
  x.fillStyle='#0E0A12';x.fillRect(1,-11,3,3);              // ojo
  x.fillStyle='#C9A227';x.fillRect(-7,-16,14,3);x.fillRect(-6,2,12,2); // banda + cinturón
  x.fillStyle='#22182A';x.fillRect(-6,14,4,5);x.fillRect(2,14,4,5);x.restore()}
function whip(n,now){const a=Math.atan2(n.y-P.y,n.x-P.x);P.f=Math.cos(a)<0?-1:1;
  FX.push({whip:1,a,t:0});for(const e of E){const d=Math.hypot(e.x-P.x,e.y-P.y),da=Math.abs(((Math.atan2(e.y-P.y,e.x-P.x)-a+9.42)%6.283)-3.14);
  if(d<120&&da<.9){e.hp--;e.fl=8;const k=14/(d||1);e.x+=(e.x-P.x)*k;e.y+=(e.y-P.y)*k}}}
function loop(now){raf=requestAnimationFrame(loop);
  x.fillStyle='#0E0A12';x.fillRect(0,0,W,H);
  const cx=W/2-P.x,cy=H/2-P.y;x.save();x.translate(cx,cy);
  x.fillStyle='#22182A';const g=48;for(let gx=Math.floor((P.x-W/2)/g)*g;gx<P.x+W/2;gx+=g)for(let gy=Math.floor((P.y-H/2)/g)*g;gy<P.y+H/2;gy+=g){x.fillRect(gx,gy,2,2);if(((gx*7+gy*13)/g)%11===0){x.fillStyle='#3A2A44';x.fillRect(gx+10,gy+10,4,8);x.fillStyle='#22182A'}}
  if(state==='play'){if(t0<0)t0=now;const s=(now-t0)/1000,left=Math.max(0,DUR-s);tEl.textContent=left|0;
    let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
    if(touch){dx=touch.x-W/2;dy=touch.y-H/2;if(Math.hypot(dx,dy)<20)dx=dy=0}
    const m=Math.hypot(dx,dy)||1;P.vx=dx/m*3.4;P.vy=dy/m*3.4;if(dx||dy){P.x+=P.vx;P.y+=P.vy;if(dx)P.f=dx<0?-1:1}else P.vx=P.vy=0;
    if(now-spawnT>Math.max(380,1300-s*60)&&E.length<6){spawnT=now;spawn()}
    if(now-lastWhip>520&&E.length){const n=E.reduce((a,e)=>Math.hypot(e.x-P.x,e.y-P.y)<Math.hypot(a.x-P.x,a.y-P.y)?e:a);if(Math.hypot(n.x-P.x,n.y-P.y)<170){lastWhip=now;whip(n,now)}}
    if((kills>=CVES.length)||left<=0){root.querySelector('.g-hud span').innerHTML=kills>=CVES.length?'STAGE CLEAR':'GATE OPENS';end()}}
  if(P.hit>0)P.hit--;
  for(let i=E.length-1;i>=0;i--){const e=E[i],d=Math.hypot(P.x-e.x,P.y-e.y)||1;
    if(state==='play'){e.x+=(P.x-e.x)/d*e.sp;e.y+=(P.y-e.y)/d*e.sp;if(d<20){P.hit=6;e.x-=(P.x-e.x)/d*30;e.y-=(P.y-e.y)/d*30}}
    if(e.hp<=0){loot(e);E.splice(i,1);continue}
    const sh=e.fl>0?(Math.random()-.5)*6:0,im=imgs[e.v.vuln_class];
    if(im&&im.complete&&im.naturalWidth)x.drawImage(im,e.x-16+sh,e.y-16,32,32);else{x.fillStyle=COL[sev(e.v.cvss4)];x.fillRect(e.x-12+sh,e.y-12,24,24)}
    if(e.fl>0){e.fl--;x.globalCompositeOperation='lighter';x.fillStyle='rgba(176,33,58,.5)';x.fillRect(e.x-16,e.y-16,32,32);x.globalCompositeOperation='source-over'}
    x.fillStyle='#3A2A44';x.fillRect(e.x-14,e.y-24,28,3);x.fillStyle=COL[sev(e.v.cvss4)];x.fillRect(e.x-14,e.y-24,28*e.hp/e.max,3);
    x.fillStyle='#9A8FA3';x.font='10px Pixel,monospace';x.textAlign='center';x.fillText(e.v.vuln_class,e.x,e.y+28)}
  hero(P.x,P.y);
  for(let i=FX.length-1;i>=0;i--){const f=FX[i];f.t++;
    if(f.whip){x.strokeStyle=`rgba(201,162,39,${1-f.t/10})`;x.lineWidth=4;x.beginPath();x.arc(P.x,P.y,100,f.a-.9,f.a+.9);x.stroke();x.lineWidth=2;x.beginPath();x.arc(P.x,P.y,70,f.a-.7,f.a+.7);x.stroke();if(f.t>10)FX.splice(i,1);continue}
    if(f.p){f.x+=f.vx;f.y+=f.vy;f.vx*=.9;f.vy*=.9;x.fillStyle=f.c;x.globalAlpha=1-f.t/30;x.fillRect(f.x-2,f.y-2,4,4);x.globalAlpha=1;if(f.t>30)FX.splice(i,1);continue}
    x.globalAlpha=Math.max(0,1-f.t/70);x.fillStyle=f.c;x.font='bold 12px JBMono,monospace';x.textAlign='center';x.fillText(f.txt,f.x,f.y-30-f.t*.6);x.globalAlpha=1;if(f.t>70)FX.splice(i,1)}
  x.restore();
  const vg=x.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.max(W,H)*.75);vg.addColorStop(0,'rgba(14,10,18,0)');vg.addColorStop(1,'rgba(14,10,18,.85)');x.fillStyle=vg;x.fillRect(0,0,W,H)}
raf=requestAnimationFrame(loop);
root.querySelector('.g-start').focus();
}
