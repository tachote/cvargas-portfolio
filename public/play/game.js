const c=document.getElementById('c'),x=c.getContext('2d');let W,H;function rs(){W=c.width=innerWidth;H=c.height=innerHeight}rs();onresize=rs;
const P={x:0,y:0,hp:100},keys={},E=[],B=[],T=['SQLi','XSS','SSRF','IDOR','RCE','XXE','CSRF'];let kills=0,t0=performance.now(),last=0,dead=false,touch=null;
onkeydown=e=>keys[e.key.toLowerCase()]=1;onkeyup=e=>keys[e.key.toLowerCase()]=0;
c.ontouchstart=c.ontouchmove=e=>{const p=e.touches[0];touch={x:p.clientX-W/2,y:p.clientY-H/2};e.preventDefault()};c.ontouchend=()=>touch=null;
function spawn(){const a=Math.random()*6.28,r=Math.max(W,H)*.6;E.push({x:P.x+Math.cos(a)*r,y:P.y+Math.sin(a)*r,n:T[Math.random()*T.length|0],hp:2})}
function loop(now){if(dead)return;const s=(now-t0)/1000;
let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
if(touch){const m=Math.hypot(touch.x,touch.y)||1;dx=touch.x/m;dy=touch.y/m}const m=Math.hypot(dx,dy)||1;P.x+=dx/m*3;P.y+=dy/m*3;
if(Math.random()<.03+s/1500)spawn();
if(now-last>350&&E.length){last=now;let n=E.reduce((a,e)=>Math.hypot(e.x-P.x,e.y-P.y)<Math.hypot(a.x-P.x,a.y-P.y)?e:a);const d=Math.hypot(n.x-P.x,n.y-P.y)||1;B.push({x:P.x,y:P.y,vx:(n.x-P.x)/d*8,vy:(n.y-P.y)/d*8,l:80})}
x.fillStyle='#0E0A12';x.fillRect(0,0,W,H);x.save();x.translate(W/2-P.x,H/2-P.y);
x.fillStyle='#1A1220';for(let gx=Math.floor((P.x-W)/64)*64;gx<P.x+W;gx+=64)for(let gy=Math.floor((P.y-H)/64)*64;gy<P.y+H;gy+=64)x.fillRect(gx,gy,2,2);
for(const b of B){b.x+=b.vx;b.y+=b.vy;b.l--;x.fillStyle='#C9A227';x.fillRect(b.x-3,b.y-3,6,6)}
for(let i=E.length-1;i>=0;i--){const e=E[i],d=Math.hypot(P.x-e.x,P.y-e.y)||1;e.x+=(P.x-e.x)/d*1.4;e.y+=(P.y-e.y)/d*1.4;
for(const b of B)if(b.l>0&&Math.abs(b.x-e.x)<14&&Math.abs(b.y-e.y)<14){b.l=0;e.hp--}
if(e.hp<=0){E.splice(i,1);kills++;continue}if(d<16){P.hp-=.4}
x.fillStyle='#B0213A';x.fillRect(e.x-10,e.y-10,20,20);x.fillStyle='#EDE6D6';x.font='11px Pixel';x.textAlign='center';x.fillText(e.n,e.x,e.y-14)}
for(let i=B.length-1;i>=0;i--)if(B[i].l<=0)B.splice(i,1);
x.fillStyle='#EDE6D6';x.fillRect(P.x-8,P.y-12,16,24);x.fillStyle='#C9A227';x.fillRect(P.x-8,P.y-12,16,4);x.restore();
hp.textContent=Math.max(0,P.hp|0);k.textContent=kills;t.textContent=s|0;
if(P.hp<=0||s>=60){dead=true;msg.textContent=s>=60?'STAGE CLEAR':'YOU DIED';over.style.display='grid';return}requestAnimationFrame(loop)}
requestAnimationFrame(loop);
