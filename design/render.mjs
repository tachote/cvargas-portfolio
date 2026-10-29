// Render design/og.html to a PNG at an exact viewport via CDP.
// usage: node design/render.mjs <url> <out.png> [w=1200] [h=630]
import {spawn} from 'node:child_process';import fs from 'node:fs';
const [url,out,w='1200',h='630']=process.argv.slice(2);
const port=9400+Math.floor(Math.random()*400);
const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--no-proxy-server','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/og-chrome-${port}`,'about:blank']);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let t;for(let i=0;i<40&&!t;i++){await sleep(250);try{t=await (await fetch(`http://127.0.0.1:${port}/json`)).json()}catch{}}
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
let id=0;const pend={};ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend[d.id])pend[d.id](d.result)};
await new Promise(r=>ws.onopen=r);const send=(method,params={})=>new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}))});
await send('Emulation.setDeviceMetricsOverride',{width:+w,height:+h,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url});
await sleep(800);
const r=await send('Runtime.evaluate',{expression:"Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode())]).then(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family).join(',')+' | imgs '+[...document.images].map(i=>i.naturalWidth).join(','))",awaitPromise:true,returnByValue:true});
console.log(r.result.value);await sleep(300);
const s=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:+w,height:+h,scale:1}});
fs.writeFileSync(out,Buffer.from(s.data,'base64'));ch.kill();process.exit(0);
