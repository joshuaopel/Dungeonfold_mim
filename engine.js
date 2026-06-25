const TS=64;
const PAL={
  voidT:'#0d0817',floorA:'#3a2d4e',floorB:'#352947',wall:'#231a38',wallTop:'#4a3a66',wallEdge:'#150f26',
  gold:'#f5c84c',goldDark:'#c79a2e',gem:'#5ee0c8',artifact:'#ff7ad9',
  mimicBody:'#9b5fd0',mimicDark:'#6e3fa0',tooth:'#fff4d6',tongue:'#ff6b8a',
  fighter:'#e85454',rogue:'#69c45f',wizard:'#5b8fe8',
  coneCalm:'rgba(255,224,130,0.10)',coneSus:'rgba(255,160,60,0.16)',coneMad:'rgba(255,70,70,0.20)',
};
const TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const angTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const angDiff=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const AUDIO={sfx:true,music:true,el:null};
function stopMusic(){ if(AUDIO.el){try{AUDIO.el.pause();}catch(e){} AUDIO.el=null;} }
let AC=null,SFXBUS=null,NOISEBUF=null;
function ac(){
  if(!AC){
    AC=new (window.AudioContext||window.webkitAudioContext)();
    SFXBUS=AC.createGain();
    SFXBUS.gain.value=(typeof SAVE!=='undefined'?SAVE.settings.sfxVol:0.8);
    SFXBUS.connect(AC.destination);
  }
  return AC;
}
function noiseBuf(){
  if(!NOISEBUF){
    const n=(AC.sampleRate*0.5)|0;
    NOISEBUF=AC.createBuffer(1,n,AC.sampleRate);
    const d=NOISEBUF.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  }
  return NOISEBUF;
}
function tone(o){
  const t=AC.currentTime+(o.at||0),osc=AC.createOscillator(),g=AC.createGain();
  osc.type=o.type||'sine';
  osc.frequency.setValueAtTime(o.f0,t);
  if(o.f1)osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1,1),t+(o.bend||o.dur*0.7));
  g.gain.setValueAtTime(o.vol,t);
  g.gain.exponentialRampToValueAtTime(.0008,t+o.dur);
  osc.connect(g);g.connect(SFXBUS);
  osc.start(t);osc.stop(t+o.dur+.05);
}
function hiss(o){
  const t=AC.currentTime+(o.at||0),s=AC.createBufferSource();
  s.buffer=noiseBuf();s.loop=true;
  const f=AC.createBiquadFilter();
  f.type=o.type||'bandpass';
  f.frequency.setValueAtTime(o.fc,t);
  if(o.fc1)f.frequency.exponentialRampToValueAtTime(o.fc1,t+o.dur);
  f.Q.value=o.q||1;
  const g=AC.createGain();
  g.gain.setValueAtTime(o.vol,t);
  g.gain.exponentialRampToValueAtTime(.0008,t+o.dur);
  s.connect(f);f.connect(g);g.connect(SFXBUS);
  s.start(t);s.stop(t+o.dur+.05);
}
const FORMS={
  mimic:{label:'Mimic',hint:'True form — heroes attack on sight!',speed:185,r:16,stealth:1.0},
  sack:{label:'Sack',hint:'Tiny & sneaky, but slow',speed:105,r:13,stealth:0.65},
  vase:{label:'Vase',hint:'Small, fragile-looking, sneaky',speed:100,r:12,stealth:0.65},
  barrel:{label:'Barrel',hint:'Balanced rolling speed',speed:145,r:15,stealth:1.0},
  chest:{label:'Chest',hint:'A classic. Suspiciously classic.',speed:135,r:16,stealth:1.05},
  statue:{label:'Statue',hint:'Very slow — but invisible when still',speed:65,r:20,stealth:1.3},
};
const PROP_KINDS=['sack','vase','barrel','chest','statue'];
const OCCL={barrel:13,chest:14,statue:18};
const HERO_DEFS={
  fighter:{color:PAL.fighter,speed:95,chaseSpeed:215,cone:{len:240,fov:0.62},perc:1.0,hearing:200},
  rogue:{color:PAL.rogue,speed:85,chaseSpeed:200,cone:{len:170,fov:1.15},perc:1.55,abilities:['lockpick'],hearing:300},
  wizard:{color:PAL.wizard,speed:60,chaseSpeed:165,cone:{len:200,fov:0.8},perc:0.8,hearing:130},
};
const TREASURE_VAL={gold:1,gem:3,artifact:5};

/* =========================================================
   TILE SYSTEM — multiple floor/wall types + baked variation
   ids: 0 void · floors: 1 stone, 3 wood, 4 moss, 5 sand,
   6 marble, 7 carpet · walls: 2 stone, 8 brick, 9 timber,
   10 mossy, 11 obsidian
   ========================================================= */
const TILE_DEFS={
  1:{kind:'floor',label:'Stone Floor'},3:{kind:'floor',label:'Wood Floor'},
  4:{kind:'floor',label:'Mossy Stone'},5:{kind:'floor',label:'Sand'},
  6:{kind:'floor',label:'Marble'},7:{kind:'floor',label:'Carpet'},
  2:{kind:'wall',label:'Stone Wall'},8:{kind:'wall',label:'Brick Wall'},
  9:{kind:'wall',label:'Timber Wall'},10:{kind:'wall',label:'Mossy Wall'},
  11:{kind:'wall',label:'Obsidian'},
};
const TOOL_TILE={floor:1,wall:2,floorWood:3,floorMoss:4,floorSand:5,floorMarble:6,floorCarpet:7,wallBrick:8,wallWood:9,wallMoss:10,wallDark:11};
const TILE_ART={1:'floor',2:'wall',3:'floorWood',4:'floorMoss',5:'floorSand',6:'floorMarble',7:'floorCarpet',8:'wallBrick',9:'wallWood',10:'wallMoss',11:'wallDark'};
const isFloorT=t=>!!(TILE_DEFS[t]&&TILE_DEFS[t].kind==='floor');
const isWallT=t=>!!(TILE_DEFS[t]&&TILE_DEFS[t].kind==='wall');
const tHash=(c,r)=>{let h=(Math.imul(c|0,2654435761)^Math.imul(r|0,1597334677))>>>0;h^=h>>>13;h=Math.imul(h,3266489917)>>>0;h^=h>>>16;return h>>>0;};
let tileCache=null;
function paintTile(g,id,v){
  let sd=(id*2654435761+v*40503+12345)>>>0;
  const R=()=>{sd=(Math.imul(sd,1103515245)+12345)>>>0;return ((sd>>>9)%8388608)/8388608;};
  const F=c=>{g.fillStyle=c;};
  if(id===1){
    F(v%2?'#3a2d4e':'#352947');g.fillRect(0,0,TS,TS);
    g.strokeStyle='rgba(0,0,0,0.15)';g.lineWidth=1;
    for(let i=0;i<2+(v&1);i++){const x=R()*52+6,y=R()*52+6;
      g.beginPath();g.moveTo(x,y);g.lineTo(x+R()*14-7,y+R()*14);g.lineTo(x+R()*20-10,y+R()*22);g.stroke();}
    if(v===3){F('rgba(0,0,0,0.10)');g.beginPath();g.arc(R()*54+5,R()*54+5,3,0,TAU);g.fill();}
  } else if(id===3){
    F(v%2?'#6e4a2a':'#664424');g.fillRect(0,0,TS,TS);
    for(let p=0;p<4;p++){
      F(p%2?'rgba(0,0,0,0.10)':'rgba(255,255,255,0.04)');g.fillRect(0,p*16,TS,16);
      g.strokeStyle='rgba(0,0,0,0.25)';g.lineWidth=1;
      g.beginPath();g.moveTo(0,p*16+0.5);g.lineTo(TS,p*16+0.5);g.stroke();
      const sx=((p*23+v*17)%48)+8;
      g.beginPath();g.moveTo(sx,p*16);g.lineTo(sx,p*16+16);g.stroke();
    }
    g.strokeStyle='rgba(0,0,0,0.08)';
    for(let i=0;i<3;i++){const y=R()*60;g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(32,y+R()*6-3,64,y);g.stroke();}
    if(v>1){g.strokeStyle='rgba(0,0,0,0.3)';g.beginPath();g.arc(14+v*11,9+v*13,3,0,TAU);g.stroke();}
  } else if(id===4){
    F(v%2?'#3c4452':'#373f4c');g.fillRect(0,0,TS,TS);
    g.strokeStyle='rgba(0,0,0,0.15)';
    for(let i=0;i<2;i++){const x=R()*52+6,y=R()*52+6;g.beginPath();g.moveTo(x,y);g.lineTo(x+R()*16-8,y+R()*16);g.stroke();}
    F('rgba(86,160,92,0.35)');
    for(let i=0;i<3+(v&1);i++){g.beginPath();g.arc(R()*64,R()*64,4+R()*7,0,TAU);g.fill();}
    F('rgba(130,210,130,0.25)');
    for(let i=0;i<2;i++){g.beginPath();g.arc(R()*64,R()*64,2+R()*3,0,TAU);g.fill();}
  } else if(id===5){
    F(v%2?'#8a7448':'#826d43');g.fillRect(0,0,TS,TS);
    F('rgba(255,240,200,0.10)');
    for(let i=0;i<8;i++)g.fillRect(R()*62,R()*62,2,2);
    F('rgba(0,0,0,0.10)');
    for(let i=0;i<5;i++)g.fillRect(R()*62,R()*62,2,2);
    if(v>1){F('rgba(0,0,0,0.12)');g.beginPath();g.ellipse(R()*50+7,R()*50+7,4,2.5,R()*3,0,TAU);g.fill();}
  } else if(id===6){
    F(v%2?'#b9b2c6':'#b1aabe');g.fillRect(0,0,TS,TS);
    g.strokeStyle='rgba(90,80,110,0.30)';g.lineWidth=1;
    for(let i=0;i<2+(v&1);i++){
      let x=R()*64,y=0;g.beginPath();g.moveTo(x,y);
      while(y<64){x+=R()*16-8;y+=10+R()*8;g.lineTo(x,y);}g.stroke();
    }
    g.strokeStyle='rgba(255,255,255,0.45)';g.strokeRect(0.5,0.5,63,63);
  } else if(id===7){
    F(v%2?'#7c2733':'#73222e');g.fillRect(0,0,TS,TS);
    F('rgba(0,0,0,0.18)');g.fillRect(0,0,TS,3);g.fillRect(0,61,TS,3);g.fillRect(0,0,3,TS);g.fillRect(61,0,3,TS);
    F('rgba(245,200,76,0.5)');
    for(let i=8;i<64;i+=12){g.fillRect(i,5,3,2);g.fillRect(i,57,3,2);}
    F('rgba(255,255,255,0.04)');
    for(let i=0;i<10;i++)g.fillRect(R()*60,R()*60,2,1);
    if(v>1){F('rgba(245,200,76,0.30)');g.beginPath();g.arc(32,32,5,0,TAU);g.fill();}
  } else if(id===2){
    F('#231a38');g.fillRect(0,0,TS,TS);
    F('#4a3a66');g.fillRect(0,0,TS,8);
    g.strokeStyle='rgba(255,255,255,0.06)';g.lineWidth=1;
    for(let yy=20;yy<64;yy+=22){g.beginPath();g.moveTo(0,yy+0.5);g.lineTo(64,yy+0.5);g.stroke();}
    const off=(v%2)*16;
    for(let row=0;row<3;row++){const yy=8+row*22;
      for(let xx=(row%2?off:off+16)%32;xx<64;xx+=32){g.beginPath();g.moveTo(xx+0.5,yy);g.lineTo(xx+0.5,Math.min(yy+22,64));g.stroke();}}
    if(v===3){F('rgba(0,0,0,0.25)');g.fillRect(20,30,10,3);}
  } else if(id===8){
    F('#5e2f28');g.fillRect(0,0,TS,TS);
    F('#7a3b30');g.fillRect(0,0,TS,8);
    F('#3a1d18');
    for(let yy=8;yy<64;yy+=14)g.fillRect(0,yy,64,2);
    for(let row=0;row<5;row++){const yy=8+row*14,off=(row%2)*16+(v%2)*8;
      for(let xx=off%32;xx<64;xx+=32)g.fillRect(xx,yy,2,14);}
    F('rgba(255,255,255,0.05)');
    for(let i=0;i<3;i++)g.fillRect(R()*56,10+R()*48,6,2);
  } else if(id===9){
    F('#4a2f1c');g.fillRect(0,0,TS,TS);
    F('#6b4426');g.fillRect(0,0,TS,8);
    g.strokeStyle='rgba(0,0,0,0.35)';g.lineWidth=2;
    for(let xx=16;xx<64;xx+=16){g.beginPath();g.moveTo(xx,8);g.lineTo(xx,64);g.stroke();}
    g.strokeStyle='rgba(0,0,0,0.15)';g.lineWidth=1;
    for(let i=0;i<4;i++){const x=R()*60;g.beginPath();g.moveTo(x,8+R()*10);g.lineTo(x+R()*4-2,60);g.stroke();}
    if(v>1){F('rgba(0,0,0,0.3)');g.beginPath();g.arc(8+v*14,20+v*9,2.5,0,TAU);g.fill();}
  } else if(id===10){
    F('#27343a');g.fillRect(0,0,TS,TS);
    F('#41545c');g.fillRect(0,0,TS,8);
    g.strokeStyle='rgba(255,255,255,0.05)';
    for(let yy=22;yy<64;yy+=20){g.beginPath();g.moveTo(0,yy);g.lineTo(64,yy);g.stroke();}
    F('rgba(86,160,92,0.4)');
    for(let i=0;i<3+(v&1);i++){g.beginPath();g.arc(R()*64,10+R()*50,4+R()*6,0,TAU);g.fill();}
    F('rgba(86,160,92,0.5)');
    for(let i=0;i<2;i++){const x=R()*56+4;g.fillRect(x,8,3,6+R()*14);}
  } else if(id===11){
    F('#191124');g.fillRect(0,0,TS,TS);
    F('#2e2244');g.fillRect(0,0,TS,8);
    g.strokeStyle='rgba(155,95,208,0.18)';g.lineWidth=1;
    for(let i=0;i<3+(v&1);i++){const x=R()*64,y=8+R()*50;g.beginPath();g.moveTo(x,y);g.lineTo(x+R()*20-10,y+R()*18);g.stroke();}
    F('rgba(255,255,255,0.06)');g.fillRect(R()*50,10+R()*40,8,2);
  } else if(TILE_DEFS[id]){
    const col=TILE_DEFS[id].color||'#3a2d4e';
    F(col);g.fillRect(0,0,TS,TS);
    if(TILE_DEFS[id].kind==='wall'){
      F('rgba(255,255,255,0.10)');g.fillRect(0,0,TS,8);
      g.strokeStyle='rgba(0,0,0,0.18)';g.lineWidth=1;
      for(let yy=22;yy<TS;yy+=20){g.beginPath();g.moveTo(0,yy+0.5);g.lineTo(TS,yy+0.5);g.stroke();}
      const off=(v%2)*16;
      for(let row2=0;row2<3;row2++){const yy=8+row2*20,o2=(row2%2?off:off+16)%32;for(let xx=o2;xx<TS;xx+=32){g.beginPath();g.moveTo(xx+0.5,yy);g.lineTo(xx+0.5,Math.min(yy+20,TS));g.stroke();}}
    }else{
      g.strokeStyle='rgba(0,0,0,0.10)';g.lineWidth=1;
      for(let i=0;i<2;i++){const x=(v*17+i*23)%50+7,y=(v*31+i*19)%50+7;g.beginPath();g.moveTo(x,y);g.lineTo(x+12,y+14);g.stroke();}
    }
  }
}
function buildTileCache(){
  tileCache={};
  for(const idStr of Object.keys(TILE_DEFS)){
    const id=+idStr,variants=[];
    for(let v=0;v<4;v++){
      const tc=document.createElement('canvas');tc.width=TS;tc.height=TS;
      paintTile(tc.getContext('2d'),id,v);
      variants.push(tc);
    }
    tileCache[id]=variants;
  }
}
buildTileCache();

/* =========================================================
   DECALS — free-placed cosmetic details on top of tiles
   ========================================================= */

/* =========================================================
   INTERACTABLES — doors, plates, levers, traps + link logic
   Triggers (plate/lever) INVERT the starting state of any
   linked target (door/trap) while active.
   ========================================================= */
const INTER_KINDS={door:1,plate:1,lever:1,trap:1,hint:1};
const INTER_TILED={door:1,plate:1,trap:1};
const TOOL_INTER={iDoor:'door',iPlate:'plate',iLever:'lever',iTrap:'trap',iHint:'hint'};
let doorBlock={};
let propBlock={};            // tiles occupied by pushable props — blocks heroes, not the player (player uses circle push)
const tileKey=(c,r)=>c+','+r;
const walkTile=(c,r)=>isFloorT(T(level,c,r))&&!doorBlock[c+','+r]&&!objBlock[c+','+r]&&!propBlock[c+','+r];
const walkTileNP=(c,r)=>isFloorT(T(level,c,r))&&!doorBlock[c+','+r]&&!objBlock[c+','+r];  // ignores pushable props (for player + the props themselves)
const interTile=it=>({c:Math.floor(it.x/TS),r:Math.floor(it.y/TS)});
function drawInter(it,st){
  if(it.kind==='hint'){
    ctx.save();ctx.translate(it.x,it.y);
    ctx.fillStyle='#6b4a2c';ctx.fillRect(-2,-3,4,16);
    ctx.fillStyle='#e8d8a8';rrect(-12,-17,24,15,3);
    ctx.fillStyle='#8a6d3b';ctx.font='bold 13px Nunito';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(it.mode==='label'?'!':'?',0,-9);ctx.textBaseline='alphabetic';
    ctx.restore();return;
  }
  const stKey = it.kind==='door' ? ((st&&st.open)?'doorOpen':'doorClosed')
    : it.kind==='plate' ? ((st&&st.active)?'plateDown':'plateUp')
    : it.kind==='lever' ? ((st&&st.flip)?'leverOn':'leverOff')
    : ((st&&st.on)?'trapOn':'trapOff');
  if((it.aid&&assetImgs[it.aid])||artImgs[stKey]){
    drawSprite(stKey,it.x,it.y,it.kind==='door'?64:it.kind==='trap'?56:it.kind==='plate'?44:40,null,0,null,it);
    return;
  }
  ctx.save();ctx.translate(it.x,it.y);
  if(it.kind==='plate'){
    const pressed=st&&st.active;
    ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.arc(0,2,20,0,TAU);ctx.fill();
    ctx.fillStyle=pressed?'#6f6781':'#9a93ad';
    ctx.beginPath();ctx.arc(0,pressed?1:0,18,0,TAU);ctx.fill();
    ctx.strokeStyle='#3b3550';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,pressed?1:0,12,0,TAU);ctx.stroke();
  } else if(it.kind==='lever'){
    const on=st&&st.flip;
    ctx.fillStyle='#54341b';rrect(-10,-4,20,12,3);
    ctx.strokeStyle='#c79a2e';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(on?12:-12,-14);ctx.stroke();ctx.lineCap='butt';
    ctx.fillStyle=on?'#69c45f':'#e85454';
    ctx.beginPath();ctx.arc(on?12:-12,-14,4.5,0,TAU);ctx.fill();
  } else if(it.kind==='trap'){
    const on=st&&st.on;
    ctx.fillStyle='rgba(0,0,0,0.30)';rrect(-26,-26,52,52,6);
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const x=i*15,y=j*15;
      if(on){
        ctx.fillStyle='#cfd2dd';
        ctx.beginPath();ctx.moveTo(x-5,y+6);ctx.lineTo(x+5,y+6);ctx.lineTo(x,y-10);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.6)';
        ctx.beginPath();ctx.moveTo(x-1.5,y+2);ctx.lineTo(x+1.5,y+2);ctx.lineTo(x,y-8);ctx.closePath();ctx.fill();
      } else {
        ctx.fillStyle='#171021';
        ctx.beginPath();ctx.arc(x,y,3.5,0,TAU);ctx.fill();
      }
    }
  } else if(it.kind==='door'){
    const open=st&&st.open;
    ctx.fillStyle='#3b2a18';
    ctx.fillRect(-31,-31,8,62);ctx.fillRect(23,-31,8,62);
    if(open){
      ctx.save();ctx.translate(-26,24);ctx.rotate(-1.15);
      ctx.fillStyle='#8a5a32';rrect(0,-12,50,12,3);
      ctx.fillStyle='#6e4525';ctx.fillRect(0,-7,50,2);
      ctx.restore();
    } else {
      ctx.fillStyle='#8a5a32';rrect(-24,-28,48,56,4);
      ctx.fillStyle='#6e4525';
      ctx.fillRect(-24,-10,48,3);ctx.fillRect(-24,8,48,3);
      ctx.strokeStyle='#54341b';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-8,-28);ctx.lineTo(-8,28);ctx.moveTo(8,-28);ctx.lineTo(8,28);ctx.stroke();
      ctx.fillStyle=PAL.gold;ctx.beginPath();ctx.arc(14,0,3.5,0,TAU);ctx.fill();
    }
  }
  ctx.restore();
}
function rrectS(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.stroke();}
/* ---------- hint signs: authorable in-world tutorial text ---------- */
function wrapHint(s,max){
  const words=String(s||'').split(/\s+/),lines=[];let cur='';
  for(const w of words){const t=cur?cur+' '+w:w;if(t.length>max&&cur){lines.push(cur);cur=w;}else cur=t;}
  if(cur)lines.push(cur);
  return lines.slice(0,4);
}
function drawHint(it,alpha){
  if(alpha<=0.01)return;
  const lines=wrapHint(it.text,26),label=(it.mode==='label');
  ctx.save();ctx.globalAlpha=alpha;
  ctx.font='600 13px Nunito';ctx.textAlign='center';ctx.textBaseline='alphabetic';
  let w=0;for(const l of lines)w=Math.max(w,ctx.measureText(l).width);
  w=Math.max(40,w+20);const h=lines.length*17+12;
  const bx=it.x,by=it.y-26-h;
  ctx.fillStyle=label?'rgba(58,46,82,0.93)':'rgba(252,246,230,0.97)';
  rrect(bx-w/2,by,w,h,8);
  ctx.fillStyle=ctx.fillStyle;
  ctx.beginPath();ctx.moveTo(bx-6,by+h);ctx.lineTo(bx+6,by+h);ctx.lineTo(bx,by+h+8);ctx.closePath();ctx.fill();
  if(label){ctx.strokeStyle='rgba(245,200,76,0.5)';ctx.lineWidth=1.5;rrectS(bx-w/2,by,w,h,8);}
  ctx.fillStyle=label?'#f3e7c0':'#2a1f33';
  lines.forEach((l,i)=>ctx.fillText(l,bx,by+18+i*17));
  ctx.globalAlpha=1;ctx.restore();
}
/* =========================================================
   CUSTOM OBJECT LIBRARY — author-defined placeable content
   Defs live in level.objDefs; placed instances in level.objects.
   ========================================================= */
let objBlock={},objOccList=[];
const defImgs={};
const defCol=def=>def.col||(def.solid?'full':'none');
function objDefById(id){ for(const d of (level.objDefs||[])) if(d.id===id) return d; return null; }
function buildObjBlock(){
  objBlock={};objOccList=[];
  for(const o of (level.objects||[])){
    const def=objDefById(o.d); if(!def)continue;
    const col=defCol(def);
    if(col==='full') objBlock[Math.floor(o.x/TS)+','+Math.floor(o.y/TS)]=1;
    else if(col==='sight') objOccList.push({x:o.x,y:o.y,r:Math.min(60,Math.max(8,22*(def.scale||1)))});
  }
}
function drawObjInst(o){
  const def=objDefById(o.d); if(!def) return;
  const sz=64*(def.scale||1), im=defImgs[o.d];
  ctx.save();ctx.translate(o.x,o.y);
  if(o.r)ctx.rotate(o.r);
  if(o.f)ctx.scale(-1,1);
  if(im){
    const fw=im.frameW||im.width;
    const sx=stripSX(im,o.x*0.03+o.y*0.03,performance.now()/1000);
    const s=sz/Math.max(fw,im.height);
    ctx.drawImage(im,sx,0,fw,im.height,-fw*s/2,-im.height*s/2,fw*s,im.height*s);
  } else {
    const _c=defCol(def);ctx.fillStyle=_c==='full'?'rgba(150,120,90,0.85)':_c==='sight'?'rgba(150,140,120,0.8)':'rgba(120,150,170,0.7)';
    rrect(-sz/2,-sz/2,sz,sz,5);
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='bold 11px Nunito';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText((def.name||'obj').slice(0,3),0,0);ctx.textBaseline='alphabetic';
  }
  ctx.restore();
}
function drawObjects(){ for(const o of (level.objects||[])) drawObjInst(o); }
function updateInter(dt){
  propBlock={};
  if(G.props)for(const _pr of G.props){ if(_pr.push) propBlock[Math.floor(_pr.x/TS)+','+Math.floor(_pr.y/TS)]=1; }
  const bodies=[G.player,...G.heroes];
  const act={};
  for(const it of G.inter){
    if(it.kind==='plate'){
      const tl=interTile(it),was=it.active;
      it.active=bodies.some(b=>Math.floor(b.x/TS)===tl.c&&Math.floor(b.y/TS)===tl.r)||(!!G.props&&G.props.some(pr=>pr.push&&Math.floor(pr.x/TS)===tl.c&&Math.floor(pr.y/TS)===tl.r));
      if(it.active&&!was)sfx('click');
    } else if(it.kind==='lever'){
      it.active=!!it.flip;
    }
    if(it.active)for(const l of G.links)if(l[0]===it.id)act[l[1]]=true;
  }
  if(G.torches)for(const to of G.torches){ const st=(to.start==null?1:to.start); to.on=(!!st)!==(!!act[to.id]); }
  doorBlock={};
  for(const it of G.inter){
    if(it.kind==='door'){
      it.open=((!!it.init)!==(!!act[it.id]))||it.picked;
      if(it.prevOpen!==null&&it.prevOpen!==it.open)sfx('door');
      it.prevOpen=it.open;
      if(!it.open){const tl=interTile(it);doorBlock[tileKey(tl.c,tl.r)]=1;}
    } else if(it.kind==='hint'){
      const near=Math.hypot(it.x-G.player.x,it.y-G.player.y)<(it.radius||90);
      const want=(it.mode==='label')?1:((near||act[it.id])?1:0);
      it.show=(it.show==null?0:it.show)+(want-(it.show||0))*Math.min(1,dt*6);
    } else if(it.kind==='trap'){
      it.on=(!!it.init)!==(!!act[it.id]);
      if(it.prevOn!==null&&it.prevOn!==it.on)sfx('trap');
      it.prevOn=it.on;
      if(it.on&&!G.over){
        const tl=interTile(it);
        if(Math.floor(G.player.x/TS)===tl.c&&Math.floor(G.player.y/TS)===tl.r)lose({name:'Spike Trap'});
        for(const h of G.heroes){
          if(h.state!=='scared'&&Math.floor(h.x/TS)===tl.c&&Math.floor(h.y/TS)===tl.r){
            h.state='scared';h.scareT=2.2*(hasAbil(h,'fearless')?0.4:1);h.suspicion=Math.min(h.suspicion,60);dropLoot(h);h.pickDoor=null;
            h.lure=null;h.route=null;
            G.chaos++;say(h,'YEOW! SPIKES!');sfx('snap');
          }
        }
      }
    }
  }
  // tile triggers — fire once per tile; re-arm when player steps to a different tile
  if(level.triggers&&level.triggers.length){
    const pc=Math.floor(G.player.x/TS),pr=Math.floor(G.player.y/TS),pk=pc+','+pr;
    if(pk!==G.stepKey){
      G.stepKey=pk;
      for(const trig of level.triggers){
        if(trig.c!==pc||trig.r!==pr)continue;
        if(trig.once&&trig.fired)continue;
        trig.fired=true;
        if(trig.effect==='creak'){sfx('click');noiseAt(G.player.x,G.player.y,trig.vol!=null?trig.vol:0.8);}
        else if(trig.effect==='alarm'){addFlash('255,140,0',0.5);sfx('alert');for(const h of G.heroes)if(h.state!=='scared'){h.suspicion=clamp(h.suspicion+65,0,100);h.lastSeen={x:G.player.x,y:G.player.y};}}
        else if(trig.effect==='trap'){if(!G.over)lose({name:'Floor Trap'});}
        else if(trig.effect==='teleport'){const tx=(trig.tc+0.5)*TS,ty=(trig.tr+0.5)*TS;G.player.x=tx;G.player.y=ty;sfx('morph');poof(tx,ty,PAL.mimicBody);}
      }
    }
  }
}

/* ---- pushable props: Mim can shove a prop in a direction (puzzle plates / blockers) ---- */
const PUSH_R=15;
function blockOtherProps(pr){
  for(const o of G.props){
    if(o===pr||!o.push)continue;
    const dx=pr.x-o.x,dy=pr.y-o.y;let d=Math.hypot(dx,dy);
    const md=(pr.r||PUSH_R)+(o.r||PUSH_R);
    if(d>0&&d<md){ pr.x=o.x+dx/d*md; pr.y=o.y+dy/d*md; }
  }
}
function resolvePush(p){
  if(!G||!G.props)return;
  for(const pr of G.props){
    if(!pr.push)continue;
    if(pr.r==null)pr.r=PUSH_R;
    let dx=pr.x-p.x,dy=pr.y-p.y,d=Math.hypot(dx,dy);
    const minD=(p.r||16)+pr.r;
    if(d>=minD)continue;
    if(d<0.0001){ dx=Math.cos(p.face||0); dy=Math.sin(p.face||0); d=1; }   // perfectly overlapped — shove along facing
    const nx=dx/d,ny=dy/d;
    pr.x+=nx*(minD-d); pr.y+=ny*(minD-d);    // slide the prop out along the contact axis
    collideTiles(pr,walkTileNP);             // keep it out of walls / doors / solid objects
    blockOtherProps(pr);                     // don't let it overlap another pushable prop
    const nd=Math.hypot(pr.x-p.x,pr.y-p.y);
    if(nd<minD-0.5){                          // prop couldn't clear (wall behind it) — block the player instead
      const cd=nd||1;
      p.x=pr.x-(pr.x-p.x)/cd*minD;
      p.y=pr.y-(pr.y-p.y)/cd*minD;
    }
  }
}
const DECAL_KINDS={rubble:1,bones:1,puddle:1,cobweb:1,mushrooms:1,crack:1,banner:1,chain:1,coins:1,moss:1};
const TOOL_DECAL={dRubble:'rubble',dBones:'bones',dPuddle:'puddle',dCobweb:'cobweb',dMushroom:'mushrooms',dCrack:'crack',dBanner:'banner',dChain:'chain',dCoins:'coins',dMoss:'moss'};
let level=null;
const T=(lv,c,r)=>(c<0||r<0||c>=lv.cols||r>=lv.rows)?0:lv.tiles[r*lv.cols+c];
const tileAtXY=(lv,x,y)=>T(lv,Math.floor(x/TS),Math.floor(y/TS));
const solidAtXY=(lv,x,y)=>!isFloorT(tileAtXY(lv,x,y))||!!doorBlock[Math.floor(x/TS)+','+Math.floor(y/TS)]||!!objBlock[Math.floor(x/TS)+','+Math.floor(y/TS)];
const SQ2=Math.SQRT2;
const DIRS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,SQ2],[1,-1,SQ2],[-1,1,SQ2],[-1,-1,SQ2]];
const artImgs={};
const assetImgs={};
/* sprite-strip support: a PNG whose width is an integer multiple (2-16x)
   of its height is treated as that many square animation frames */
function tagFrames(im){
  const r=im.width/im.height, n=Math.round(r);
  if(n>=2&&n<=16&&Math.abs(r-n)<0.02){ im.frames=n; im.frameW=im.width/n; }
  else { im.frames=1; im.frameW=im.width; }
  return im;
}
const stripSX=(im,phase,tSec)=>im.frames>1?(Math.floor(tSec*(im.fps||8)+(phase||0))%im.frames)*im.frameW:0;
function charFx(mode,t,faceX){
  let a=0,f=0,sx0=1,sy0=1;
  if(mode==='chase'){a=0.13;f=16;}        // attack WOMP
  else if(mode==='flee'){a=0.09;f=23;}    // panic jitter
  else if(mode==='walk'){a=0.06;f=13;}
  else if(mode==='sneak'){a=0.03;f=9;sx0=1.10;sy0=0.82;} // crouched squash
  else {a=0.02;f=2.6;}                    // idle breathing
  const w=Math.sin(t*f)*a;
  return {sx:sx0*(1+w),sy:sy0*(1-w),flip:faceX<-0.05};
}


let G=null;
const keys={};
function tryMorph(){
  const p=G.player;
  let best=null,bd=52;
  for(const pr of G.props){const d=Math.hypot(pr.x-p.x,pr.y-p.y);if(d<bd){bd=d;best=pr;}}
  if(best&&p.form!==best.kind){p.form=best.kind;p.formAid=best.aid;p.integrity=100;p.crackT=0;sfx('morph');poof(p.x,p.y,PAL.mimicBody);}
  else if(p.form!=='mimic'){p.form='mimic';p.formAid=undefined;p.integrity=100;p.crackT=0;sfx('morph');poof(p.x,p.y,PAL.mimicBody);}
  updateFormHUD();
}
const pick=a=>a[Math.floor(Math.random()*a.length)];
function say(who,text){G.bubbles.push({who,text,t:2.4});}
/* ---- noiseAt: emit a sound burst; nearby heroes investigate the source ---- */
function noiseAt(x,y,vol){
  if(!G||!G.heroes)return;
  vol=(vol==null?1:vol);
  for(const h of G.heroes){
    if(h.state==='chase'||h.state==='scared')continue;
    const d=dist(h,{x,y}),range=(h.hearing||200)*vol;
    if(d>=range)continue;
    const gain=30*h.perc*(1-d/range);
    h.suspicion=clamp(h.suspicion+gain,0,100);
    if(h.state!=='investigate'&&h.state!=='lured'){
      h.state='investigate';clearNav(h);
      h.poi={x,y};h.pauseT=1.8;
      say(h,pick(['What was that?','...Hello?','I heard something!']));
    } else if(h.state==='investigate'){h.poi={x,y};}
  }
}
function moveDirect(h,target,speed,dt){
  const a=angTo(h,target);
  h.ang=lerpAngle(h.ang,a,clamp(dt*6,0,1));
  const d=dist(h,target);
  if(d>4){h.x+=Math.cos(a)*speed*dt;h.y+=Math.sin(a)*speed*dt;}
  collideTiles(h);
  return d<=10;
}
function hasAbil(h,n){return h.abil&&h.abil.indexOf(n)>=0;}
function closedDoorAhead(h,wp){
  let best=null,bd=50;
  for(const it of G.inter){
    if(it.kind!=='door'||it.open||it.picked)continue;
    const d=dist(h,it); if(d>=bd)continue;
    const ax=wp.x-h.x,ay=wp.y-h.y,bx=it.x-h.x,by=it.y-h.y;
    if(ax*bx+ay*by>=0){ bd=d; best=it; }
  }
  return best;
}
function clearNav(h){h.route=null;h.routeGoal=null;h.routeI=0;}
function loadVal(h){ let v=0; for(const it of h.load)v+=it.val; return v; }
function updateInvaderLoot(h,dt){
  const carrySpd=h.speed*(1-(h.carrySlow||0)*(h.load.length>0?1:0));
  let best=null,bd=1e9;
  for(const tr of G.treasures){ if(tr.taken)continue; const d=dist(h,tr); if(d<bd){bd=d;best=tr;} }
  const full=h.load.length>=(h.cap||1);
  if(full || (h.load.length>0 && !best)){
    if(navTo(h,h.home,carrySpd,dt)){
      G.invaderLoot+=loadVal(h); sfx('coin'); poof(h.x,h.y,PAL.goldDark,6);
      h.load=[]; clearNav(h); say(h,pick(['Hauling it out!','Mine now!','Got the goods!']));
      checkRace();
    }
    return;
  }
  if(best){
    if(dist(h,best)<30){ best.taken=true; h.load.push({val:best.val,kind:best.kind,aid:best.aid}); sfx('coin'); clearNav(h); say(h,pick(['Loot!','Grab it!','For the guild!'])); }
    else navTo(h,best,carrySpd,dt);
  } else {
    if(dist(h,h.home)>8)navTo(h,h.home,h.speed,dt);
    else { h.ang+=dt*0.7*h.scanDir; if(Math.random()<dt*0.2)h.scanDir*=-1; }
  }
}
function dropLoot(h){
  if(!h.load||!h.load.length)return;
  for(const it of h.load) G.treasures.push({kind:it.kind,x:h.x+rnd(-12,12),y:h.y+rnd(-12,12),val:it.val,aid:it.aid,taken:false,bob:rnd(0,TAU),id:'drop'+(G.decoyId++)});
  poof(h.x,h.y,PAL.gold,9); h.load=[];
}
function checkRace(){
  if(G.over||G.mode!=='plunder')return;
  const worldLeft=G.treasures.reduce((s,tr)=>tr.taken?s:s+tr.val,0);
  const carried=G.heroes.reduce((s,h)=>s+(h.load?loadVal(h):0),0);
  if(G.goalValue+worldLeft+carried < G.goal) loseRace();
}
function loseRace(){ if(G.over)return; G.over=true; sfx('lose'); addShake(10); addFlash('255,55,55',0.6); showEnd(false,{name:'__race__'}); }
function lose(h){if(G.over)return;G.over=true;sfx('lose');addShake(13);addFlash('255,55,55',0.7);showEnd(false,h);}
function cdBar(id,frac){
  const el=document.getElementById(id);
  el.querySelector('.cd').style.height=(frac*100)+'%';
  el.classList.toggle('ready',frac<=0);
}
const fmtTime=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
function updateGoalHUD(){
  const extra=(G&&G.mode==='plunder')?'   invaders '+G.invaderLoot:'';
  document.getElementById('goalValue').textContent=Math.min(G.goalValue,G.goal)+' / '+G.goal+(G.portal.active?'  ✦':'')+extra;
  document.getElementById('goalBar').style.width=clamp(G.goalValue/G.goal*100,0,100)+'%';
}
function updateFormHUD(){
  const f=FORMS[G.player.form];
  document.getElementById('formName').textContent=f.label;
  document.getElementById('formHint').textContent=f.hint;
}
function shadowAt(r){ctx.fillStyle='rgba(0,0,0,0.30)';ctx.beginPath();ctx.ellipse(0,14,r,r*0.4,0,0,TAU);ctx.fill();}
function rrect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();
}
function vecProp(kind){
  if(kind==='sack'){
    ctx.fillStyle='#c9a368';
    ctx.beginPath();ctx.moveTo(-12,10);ctx.quadraticCurveTo(-15,-8,-4,-12);
    ctx.quadraticCurveTo(0,-18,4,-12);ctx.quadraticCurveTo(15,-8,12,10);
    ctx.quadraticCurveTo(0,15,-12,10);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#8d6c3c';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#8d6c3c';ctx.fillRect(-4,-16,8,5);
  } else if(kind==='vase'){
    ctx.fillStyle='#5aa7a0';
    ctx.beginPath();ctx.moveTo(-6,-14);ctx.quadraticCurveTo(-14,-4,-9,8);
    ctx.quadraticCurveTo(0,14,9,8);ctx.quadraticCurveTo(14,-4,6,-14);ctx.closePath();ctx.fill();
    ctx.fillStyle='#3d7f79';ctx.fillRect(-7,-17,14,4);
    ctx.strokeStyle='#2e635e';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-9,0);ctx.quadraticCurveTo(0,4,9,0);ctx.stroke();
  } else if(kind==='barrel'){
    ctx.fillStyle='#8a5a32';rrect(-13,-15,26,30,7);
    ctx.fillStyle='#6e4525';ctx.fillRect(-13,-9,26,4);ctx.fillRect(-13,5,26,4);
    ctx.strokeStyle='#54341b';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-4,-15);ctx.lineTo(-4,15);ctx.moveTo(5,-15);ctx.lineTo(5,15);ctx.stroke();
  } else if(kind==='chest'){
    ctx.fillStyle='#9a6230';rrect(-15,-6,30,18,4);
    ctx.fillStyle='#7c4c22';rrect(-15,-14,30,10,5);
    ctx.fillStyle=PAL.gold;ctx.fillRect(-15,-5,30,3);ctx.fillRect(-2,-6,4,8);
    ctx.strokeStyle='#54341b';ctx.lineWidth=2;ctx.strokeRect(-15,-14,30,26);
  } else if(kind==='statue'){
    ctx.fillStyle='#9a93ad';rrect(-15,8,30,10,3);
    ctx.fillStyle='#b3abc6';
    ctx.beginPath();ctx.ellipse(0,-2,10,14,0,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(0,-18,7,0,TAU);ctx.fill();
    ctx.fillStyle='#8a8299';ctx.fillRect(-13,-8,5,14);ctx.fillRect(8,-8,5,14);
  }
}
function vecMimic(t,p){
  const open=4+Math.sin(t*6)*2+(p?p.snapAnim*26:0);
  ctx.fillStyle=PAL.mimicDark;rrect(-16,-2,32,16,4);
  ctx.fillStyle=PAL.mimicBody;rrect(-16,-2,32,5,2);
  ctx.save();ctx.translate(0,-2);ctx.rotate(-open*0.03);
  ctx.fillStyle=PAL.mimicBody;rrect(-16,-12,32,12,5);
  ctx.fillStyle=PAL.gold;ctx.fillRect(-16,-2,32,2.5);
  ctx.fillStyle=PAL.tooth;
  for(let i=-12;i<=12;i+=6){tri(i,0,3,5);}
  ctx.fillStyle='#ffd2f0';
  ctx.beginPath();ctx.arc(-7,-7,3.6,0,TAU);ctx.arc(7,-7,3.6,0,TAU);ctx.fill();
  ctx.fillStyle='#1c1426';
  const lx=p?Math.cos(p.face)*1.4:0,ly=p?Math.sin(p.face)*1.4:0;
  ctx.beginPath();ctx.arc(-7+lx,-7+ly,1.7,0,TAU);ctx.arc(7+lx,-7+ly,1.7,0,TAU);ctx.fill();
  ctx.restore();
  ctx.fillStyle=PAL.tongue;
  ctx.beginPath();ctx.ellipse(0,3,7,3.5,0,0,TAU);ctx.fill();
  ctx.fillStyle=PAL.tooth;
  for(let i=-12;i<=12;i+=6){tri(i,-2,3,-4);}
  function tri(x,y,w,h){ctx.beginPath();ctx.moveTo(x-w,y);ctx.lineTo(x+w,y);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();}
}
function vecHero(kind,ang){
  ctx.fillStyle=HERO_DEFS[kind].color;
  ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#ffe6c8';
  ctx.beginPath();ctx.arc(Math.cos(ang)*5,Math.sin(ang)*5,6.5,0,TAU);ctx.fill();
  ctx.fillStyle='#1c1426';
  ctx.beginPath();
  ctx.arc(Math.cos(ang)*7-2,Math.sin(ang)*7,1.4,0,TAU);
  ctx.arc(Math.cos(ang)*7+2,Math.sin(ang)*7,1.4,0,TAU);ctx.fill();
  if(kind==='fighter'){ctx.fillStyle='#c6c9d4';rrect(-9,-16,18,8,3);ctx.fillStyle='#9da1b0';ctx.fillRect(-2,-20,4,6);}
  else if(kind==='rogue'){ctx.fillStyle='#3f8a37';ctx.beginPath();ctx.moveTo(-11,-8);ctx.quadraticCurveTo(0,-24,11,-8);ctx.closePath();ctx.fill();}
  else{ctx.fillStyle='#3b6bc4';ctx.beginPath();ctx.moveTo(-12,-8);ctx.lineTo(12,-8);ctx.lineTo(2,-26);ctx.closePath();ctx.fill();
       ctx.fillStyle=PAL.gold;ctx.beginPath();ctx.arc(2,-16,2,0,TAU);ctx.fill();}
}
function vecTreasure(kind,t,bob){
  const b=Math.sin(t*2.4+bob)*2.5;
  ctx.translate(0,b);
  const C=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();};
  if(kind==='gold'){
    ctx.fillStyle=PAL.goldDark;ctx.beginPath();ctx.ellipse(0,6,16,7,0,0,TAU);ctx.fill();
    ctx.fillStyle=PAL.gold;C(-5,0,6);C(5,1,6);C(0,-5,6);
    ctx.fillStyle='#fff0b8';C(-6,-2,1.8);C(2,-7,1.8);
  } else if(kind==='gem'){
    ctx.fillStyle=PAL.gem;
    ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,-2);ctx.lineTo(0,12);ctx.lineTo(-10,-2);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(4,-3);ctx.lineTo(-4,-3);ctx.closePath();ctx.fill();
  } else {
    ctx.fillStyle=PAL.artifact;
    ctx.beginPath();
    for(let i=0;i<5;i++){
      const a=-Math.PI/2+i*TAU/5,a2=a+TAU/10;
      ctx.lineTo(Math.cos(a)*13,Math.sin(a)*13);
      ctx.lineTo(Math.cos(a2)*5.5,Math.sin(a2)*5.5);
    }
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1;ctx.stroke();
  }
}
function drawPropAt(kind,x,y,t,isPlayer,inst){
  ctx.save();ctx.translate(x,y);
  shadowAt(kind==='statue'?22:16);
  ctx.restore();
  if(inst&&inst.push&&!isPlayer){          // faint dashed base ring marks a prop Mim can push
    ctx.save();ctx.translate(x,y+15);ctx.globalAlpha=0.45;
    ctx.strokeStyle='rgba(150,205,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.ellipse(0,0,19,8,0,0,TAU);ctx.stroke();
    ctx.restore();
  }
  let fx=null;
  if(isPlayer&&G){
    const mode=G.player.sneak?'sneak':(G.player.moving?'walk':'idle');
    fx=charFx(mode,t,Math.cos(G.player.face||0));
  }
  const drewImg=drawSprite(kind,x,y,48,()=>{
    if(kind==='mimic')vecMimic(t,isPlayer?G.player:null);else vecProp(kind);
  },isPlayer?0:(x*0.03+y*0.03),fx,inst);
  if(isPlayer&&kind!=='mimic'){
    const blink=G.player.eyeBlink<0.12;
    if(!blink){
      ctx.fillStyle='#1c1426';
      const ey=drewImg?-6:(kind==='chest'?-9:kind==='statue'?-18:-4);
      ctx.beginPath();ctx.arc(x-4,y+ey,1.8,0,TAU);ctx.arc(x+4,y+ey,1.8,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(x-4.5,y+ey-0.5,0.6,0,TAU);ctx.arc(x+3.5,y+ey-0.5,0.6,0,TAU);ctx.fill();
    }
  }
}
function drawHeroAt(h,t){
  ctx.save();ctx.translate(h.x,h.y);shadowAt(14);ctx.restore();
  const mode=h.state==='chase'?'chase':h.state==='scared'?'flee':(h.moving?'walk':'idle');
  const fx=charFx(mode,t+(h.phase||0),Math.cos(h.ang||0));
  drawSprite(h.kind,h.x,h.y,44,()=>vecHero(h.kind,h.ang),h.phase||0,fx,h);
  if(artImgs[h.kind]){
    ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(h.x+Math.cos(h.ang)*16,h.y+Math.sin(h.ang)*16);
    ctx.lineTo(h.x+Math.cos(h.ang)*24,h.y+Math.sin(h.ang)*24);ctx.stroke();
  }
}
function drawTreasureAt(tr,t){
  drawSprite(tr.kind,tr.x,tr.y+Math.sin(t*2.4+(tr.bob||0))*2.5,34,()=>vecTreasure(tr.kind,t,tr.bob||0),(tr.bob||0)*2,null,tr);
}
function curTorches(){ return (MODE==='play'&&typeof G!=='undefined'&&G&&G.torches)?G.torches:level.torches; }
function torchLit(to){ return (to&&to.on!=null)?!!to.on:((!to||to.start==null)?true:!!to.start); }
function drawTorchAt(p,t){
  const fl=Math.sin(t*9+p.x)*2;
  const _c=(p.color&&p.color.length===3)?p.color:[255,176,92], _rgb=_c[0]+','+_c[1]+','+_c[2];
  const _aim=(p.aid&&assetImgs[p.aid])||(p.glow?artImgs['beacon']:artImgs['torch'])||null;
  function _spr(alpha){
    if(!_aim)return false;
    const fw=_aim.frameW||_aim.width;
    const sx=stripSX(_aim,p.x*0.05+p.y*0.05,performance.now()/1000);
    const s=40/Math.max(fw,_aim.height);
    ctx.save();if(alpha!=null)ctx.globalAlpha=alpha;
    ctx.drawImage(_aim,sx,0,fw,_aim.height,p.x-fw*s/2,p.y-_aim.height*s/2,fw*s,_aim.height*s);
    ctx.restore();return true;
  }
  if(!torchLit(p)){
    if(_spr(0.3))return;
    if(p.glow){ ctx.strokeStyle='rgba('+_rgb+',0.3)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,6,0,TAU);ctx.stroke();return; }
    ctx.fillStyle='#4a3420';ctx.fillRect(p.x-3,p.y-2,6,14);
    ctx.fillStyle='rgba(110,84,58,0.7)';ctx.beginPath();ctx.ellipse(p.x,p.y-6,4,6,0,0,TAU);ctx.fill();
    return;
  }
  if(p.glow){
    const ps=(p.pulse==null?1:p.pulse), br=1+Math.sin(t*ps*3)*0.18, R=18*br;
    const gb=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,R+12);
    gb.addColorStop(0,'rgba('+_rgb+',0.95)');gb.addColorStop(0.5,'rgba('+_rgb+',0.5)');gb.addColorStop(1,'rgba('+_rgb+',0)');
    ctx.fillStyle=gb;ctx.beginPath();ctx.arc(p.x,p.y,R+12,0,TAU);ctx.fill();
    if(_spr())return;
    ctx.fillStyle='rgb('+_rgb+')';ctx.beginPath();ctx.arc(p.x,p.y,7*br,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.85)';ctx.beginPath();ctx.arc(p.x,p.y,3,0,TAU);ctx.fill();
    return;
  }
  const amb=(level.ambient==null?0:level.ambient);
  const gr=amb>0?40:90;
  const g=ctx.createRadialGradient(p.x,p.y,4,p.x,p.y,gr+fl*4);
  g.addColorStop(0,'rgba('+_rgb+','+(amb>0?0.5:0.30)+')');g.addColorStop(1,'rgba('+_rgb+',0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,gr+fl*4,0,TAU);ctx.fill();
  if(_spr())return;
  ctx.fillStyle='#6b4a2c';ctx.fillRect(p.x-3,p.y-2,6,14);
  ctx.fillStyle='rgb('+_rgb+')';ctx.beginPath();ctx.ellipse(p.x,p.y-6+fl*0.5,5,9+fl,0,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,255,236,0.92)';ctx.beginPath();ctx.ellipse(p.x,p.y-5,2.5,5,0,0,TAU);ctx.fill();
}
/* =========================================================
   DYNAMIC LIGHTING — torches (and the Mimic) cast real light
   onto a multiplied light-map; level.ambient sets how dark
   the unlit areas are (0 = lighting off, backward-compatible)
   ========================================================= */
let lightCanvas=null,lightCtx=null;
function applyLighting(t,camX,camY,zoom){
  const amb=(level.ambient==null?0:level.ambient);
  if(amb<=0)return;
  if(camX==null)camX=cam.x; if(camY==null)camY=cam.y; if(!zoom)zoom=1;
  if(!lightCanvas)lightCanvas=document.createElement('canvas');
  if(!lightCtx||lightCanvas.width!==vw||lightCanvas.height!==vh){lightCanvas.width=vw;lightCanvas.height=vh;lightCtx=lightCanvas.getContext('2d');}
  const lx=lightCtx;
  lx.setTransform(1,0,0,1,0,0);
  lx.globalCompositeOperation='source-over';
  const base=Math.round(255*(1-amb));
  lx.fillStyle='rgb('+base+','+Math.round(base*0.9)+','+Math.min(255,Math.round(base*1.08))+')';
  lx.fillRect(0,0,vw,vh);
  lx.globalCompositeOperation='lighter';
  const addLight=(wx,wy,r,cr,cg,cb,inten)=>{
    const sx=(wx-camX)*zoom,sy=(wy-camY)*zoom,R=r*zoom;
    if(sx<-R||sy<-R||sx>vw+R||sy>vh+R)return;
    const grd=lx.createRadialGradient(sx,sy,Math.min(8,R*0.15),sx,sy,R);
    grd.addColorStop(0,'rgba('+cr+','+cg+','+cb+','+inten+')');
    grd.addColorStop(0.55,'rgba('+cr+','+cg+','+cb+','+(inten*0.4)+')');
    grd.addColorStop(1,'rgba('+cr+','+cg+','+cb+',0)');
    lx.fillStyle=grd;lx.fillRect(sx-R,sy-R,R*2,R*2);
  };
  for(const to of curTorches()){
    if(!torchLit(to))continue;
    const fa=(to.flick==null?0.06:to.flick);
    const fl=1+Math.sin(t*9+to.x)*fa;
    const tc=(to.color&&to.color.length===3)?to.color:[255,176,92];
    const br=to.glow?(1+Math.sin(t*(to.pulse||1)*3)*0.18):1;
    addLight(to.x,to.y-(to.glow?0:4),(to.radius||190)*fl*br,tc[0],tc[1],tc[2],(to.intensity==null?0.95:to.intensity)*(to.glow?br:1));
  }
  if(typeof G!=='undefined'&&G){
    if(G.player)addLight(G.player.x,G.player.y,150,150,170,225,0.55);
    if(G.decoys)for(const d of G.decoys)if(d.t>0)addLight(d.x,d.y,90,255,210,120,0.5*Math.min(1,d.t));
    if(G.inter)for(const it of G.inter)if(it.kind==='trap'&&it.on)addLight(it.x,it.y,70,180,220,255,0.4);
  }
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='multiply';
  ctx.drawImage(lightCanvas,0,0);
  ctx.globalCompositeOperation='source-over';
  ctx.setTransform(1,0,0,1,-cam.x,-cam.y);
}

function coneOccluders(h){
  const out=[];
  for(const p of G.props){
    const r=OCCL[p.kind];if(!r)continue;
    if(dist(p,h)<h.r+r+10)continue;
    if(dist(p,h)<h.cone.len+r+10)out.push({x:p.x,y:p.y,r});
  }
  for(const p of objOccList){
    if(dist(p,h)<h.r+p.r+10)continue;
    if(dist(p,h)<h.cone.len+p.r+10)out.push({x:p.x,y:p.y,r:p.r});
  }
  return out;
}
let SHAKE=0,HITSTOP=0,FLASH=0,FLASHCOL='255,80,80';
const reduceMotion=()=>!!(typeof SAVE!=='undefined'&&SAVE.settings&&SAVE.settings.reduceMotion);
function addShake(m){ if(!reduceMotion()) SHAKE=Math.min(22,SHAKE+m); }
function addHitStop(s){ if(!reduceMotion()) HITSTOP=Math.max(HITSTOP,s); }
function addFlash(col,a){ FLASH=Math.max(FLASH, reduceMotion()?a*0.35:a); FLASHCOL=col||'255,80,80'; }
function feelDecay(dt){
  if(SHAKE>0){ SHAKE*=Math.pow(0.0016,dt); if(SHAKE<0.35)SHAKE=0; }
  if(FLASH>0){ FLASH*=Math.pow(0.02,dt); if(FLASH<0.012)FLASH=0; }
}
function shakeOffset(){ return SHAKE>0 ? {x:(Math.random()*2-1)*SHAKE,y:(Math.random()*2-1)*SHAKE} : {x:0,y:0}; }
const GB_SCHEMES={
  dmg:[[15,56,15],[48,98,48],[139,172,15],[155,188,15]],   // classic DMG green
  grey:[[28,28,33],[88,88,99],[156,156,170],[224,224,235]], // Pocket grey
  dusk:[[30,20,46],[74,52,104],[150,110,190],[214,196,240]], // Dusk purple
  amber:[[36,22,8],[120,72,20],[208,138,42],[255,216,150]],
  ice:[[16,26,44],[50,84,126],[120,170,210],[212,240,255]]
};
const GB_BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
function gbLevel(lum,n){ n=n||4; const l=Math.floor(lum*n); return l<0?0:l>=n?n-1:l; }
let gbBuf=null,gbCtx=null;

function applyGameBoy(px,scheme,colors){
  try{
    const P=Math.max(1,Math.min(12,Math.round(px||5)));
    const lowW=Math.max(1,Math.ceil(vw/P)), lowH=Math.max(1,Math.ceil(vh/P));
    if(!gbBuf){ gbBuf=document.createElement('canvas'); gbCtx=gbBuf.getContext('2d',{willReadFrequently:true}); }
    if(!gbCtx||!gbCtx.getImageData) return;
    if(gbBuf.width!==lowW||gbBuf.height!==lowH){ gbBuf.width=lowW; gbBuf.height=lowH; }
    gbCtx.imageSmoothingEnabled=false;
    gbCtx.clearRect(0,0,lowW,lowH);
    gbCtx.drawImage(cv,0,0,vw,vh,0,0,lowW,lowH);
    if(scheme!=='native'){            // 'native' = pixelize only, keep current textures/colors
      const PAL=(Array.isArray(colors)&&colors.length>=2)?colors:(GB_SCHEMES[scheme]||GB_SCHEMES.dmg);
      const n=PAL.length;
      const img=gbCtx.getImageData(0,0,lowW,lowH), d=img.data;
      for(let y=0;y<lowH;y++)for(let x=0;x<lowW;x++){
        const i=(y*lowW+x)*4;
        let lum=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255;
        lum+=((GB_BAYER[y&3][x&3]+0.5)/16-0.5)*0.16;
        const c=PAL[gbLevel(lum,n)];
        d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; d[i+3]=255;
      }
      gbCtx.putImageData(img,0,0);
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(gbBuf,0,0,lowW,lowH,0,0,lowW*P,lowH*P);   // integer upscale = crisp uniform pixels
    ctx.imageSmoothingEnabled=true;
  }catch(e){/* headless / no getImageData — skip */}
}
function applyColorClamp(scheme,colors){
  try{
    if(scheme==='native')return;
    const PAL=(Array.isArray(colors)&&colors.length>=2)?colors:(GB_SCHEMES[scheme]||GB_SCHEMES.dmg);
    if(!gbBuf){ gbBuf=document.createElement('canvas'); gbCtx=gbBuf.getContext('2d',{willReadFrequently:true}); }
    if(!gbCtx||!gbCtx.getImageData)return;
    if(gbBuf.width!==vw||gbBuf.height!==vh){ gbBuf.width=vw; gbBuf.height=vh; }
    gbCtx.drawImage(cv,0,0);
    const img=gbCtx.getImageData(0,0,vw,vh);
    const d32=new Uint32Array(img.data.buffer);
    // Pre-pack palette as little-endian ABGR (matches canvas Uint32 layout: R|G<<8|B<<16|A<<24)
    const p0=(0xFF000000|(PAL[0][2]<<16)|(PAL[0][1]<<8)|PAL[0][0])>>>0;
    const p1=(0xFF000000|(PAL[1][2]<<16)|(PAL[1][1]<<8)|PAL[1][0])>>>0;
    const p2=(0xFF000000|(PAL[2][2]<<16)|(PAL[2][1]<<8)|PAL[2][0])>>>0;
    const p3=(0xFF000000|(PAL[3][2]<<16)|(PAL[3][1]<<8)|PAL[3][0])>>>0;
    for(let i=0,n=d32.length;i<n;i++){
      const v=d32[i],r=v&0xFF,g=(v>>>8)&0xFF,b=(v>>>16)&0xFF;
      const lv=299*r+587*g+114*b; // integer lum * 1000 * 255, range 0-255000
      d32[i]=lv<63750?p0:lv<127500?p1:lv<191250?p2:p3;
    }
    gbCtx.putImageData(img,0,0);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(gbBuf,0,0);
  }catch(e){}
}
// Normalise a gbPop tag. Value = 0 (off) | 'full' | a scheme name | 'custom', with an optional
// trailing '*' meaning "pixelate this pop to match the scene's block size". Legacy 1/true -> 'full'.
const gbPopVal=v=>{
  if(v===1||v===true) return 'full';
  if(typeof v!=='string'||!v) return 0;
  const px=v.endsWith('*'), k=px?v.slice(0,-1):v;
  const ok=(k==='full'||k==='custom'||!!GB_SCHEMES[k]);
  return ok?(px?k+'*':k):0;
};
const gbPalFor=key=>{
  if(key==='custom'){ const c=(typeof level!=='undefined'&&level&&level.gb)?level.gb.colors:null; return (Array.isArray(c)&&c.length>=2)?c:GB_SCHEMES.dmg; }
  return GB_SCHEMES[key]||GB_SCHEMES.dmg;
};
// Redraw entities tagged .gbPop ON TOP of the GB scene so they stand out. 'full' = crisp full
// colour; a scheme/custom name = the entity recoloured with THAT palette; a '*' suffix also
// pixelates the pop to the scene's Px so it reads as part of the retro frame, not a sticker.
let popBuf=null,popCtx=null;
function drawGbPops(t,editor){
  const tre=editor?level.treasures:G.treasures, prp=editor?level.props:G.props, her=editor?level.heroes:G.heroes;
  const items=[];
  if(tre)for(const o of tre){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawTreasureAt(editor?{...o,bob:0}:o, editor?0:t)]); }
  if(prp)for(const o of prp){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawPropAt(o.kind,o.x,o.y,editor?0:t,false,o)]); }
  if(her)for(const o of her){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawHeroAt(editor?{...o,ang:0}:o, editor?0:t)]); }
  if(!editor&&typeof G!=='undefined'&&G&&G.player&&level.gb){ const v=gbPopVal(level.gb.player); if(v)items.push([v,()=>drawPropAt(G.player.form,G.player.x,G.player.y,t,true,{aid:G.player.formAid})]); }
  if(!items.length) return;
  for(const [v,draw] of items) if(v==='full') draw();          // crisp full-colour: straight on top
  const off=items.filter(([v])=>v!=='full');                    // everything needing the offscreen pass
  if(!off.length) return;
  if(!popBuf){ try{ popBuf=document.createElement('canvas'); popCtx=popBuf.getContext('2d',{willReadFrequently:true}); }catch(e){ popCtx=null; } }
  if(!popCtx||!popCtx.getImageData){ for(const [,draw] of off) draw(); return; }  // headless fallback
  if(popBuf.width!==vw||popBuf.height!==vh){ popBuf.width=vw; popBuf.height=vh; }
  if(!gbBuf){ try{ gbBuf=document.createElement('canvas'); gbCtx=gbBuf.getContext('2d',{willReadFrequently:true}); }catch(e){} }
  let m=null; try{ m=ctx.getTransform&&ctx.getTransform(); }catch(e){}
  const groups={}; for(const [v,draw] of off){ (groups[v]=groups[v]||[]).push(draw); }
  const real=ctx;
  const recolor=(c2,w,h,key,dither)=>{
    const PAL=gbPalFor(key), n=PAL.length, img=c2.getImageData(0,0,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*4; if(d[i+3]<8)continue;
      let lum=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255;
      if(dither)lum+=((GB_BAYER[y&3][x&3]+0.5)/16-0.5)*0.16;
      const c=PAL[gbLevel(lum,n)]; d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; }
    c2.setTransform(1,0,0,1,0,0); c2.putImageData(img,0,0);
  };
  try{
    for(const v in groups){
      const px=v.endsWith('*'), key=px?v.slice(0,-1):v;
      popCtx.setTransform(1,0,0,1,0,0); popCtx.clearRect(0,0,vw,vh);
      if(m&&popCtx.setTransform)popCtx.setTransform(m);
      ctx=popCtx; for(const draw of groups[v]) draw(); ctx=real;
      try{
        if((px||key!=='full')&&gbCtx&&gbCtx.getImageData){
          // all recoloured pops route through the cheap downscaled buffer (same as the scene filter)
          const P=Math.max(1,Math.min(12,Math.round((level.gb&&level.gb.px)||5)));
          const lowW=Math.max(1,Math.ceil(vw/P)), lowH=Math.max(1,Math.ceil(vh/P));
          if(gbBuf.width!==lowW||gbBuf.height!==lowH){ gbBuf.width=lowW; gbBuf.height=lowH; }
          gbCtx.imageSmoothingEnabled=false; gbCtx.clearRect(0,0,lowW,lowH);
          gbCtx.drawImage(popBuf,0,0,vw,vh,0,0,lowW,lowH);
          if(key!=='full') recolor(gbCtx,lowW,lowH,key,true);
          popCtx.setTransform(1,0,0,1,0,0); popCtx.clearRect(0,0,vw,vh); popCtx.imageSmoothingEnabled=false;
          popCtx.drawImage(gbBuf,0,0,lowW,lowH,0,0,lowW*P,lowH*P);
        } else if(key!=='full'){
          recolor(popCtx,vw,vh,key,false);   // headless fallback: no downscaled buf available
        }
      }catch(e){}
      real.setTransform(1,0,0,1,0,0); real.drawImage(popBuf,0,0);
      if(m&&real.setTransform)real.setTransform(m);
    }
  } finally { ctx=real; if(m&&ctx.setTransform){try{ctx.setTransform(m);}catch(e){}} }
}

function drawPortalAt(p,active,t){
  const W=36, half=W/2;
  ctx.save(); ctx.translate(p.x,p.y);
  // pulsing glow under the exit (pre-GB, so it reads as part of the retro art)
  const pulse=active?(0.5+0.5*Math.sin(t*3)):0;
  if(active){
    const R=half+14+pulse*8, g=ctx.createRadialGradient(0,0,4,0,0,R);
    g.addColorStop(0,'rgba(160,255,210,'+(0.5+pulse*0.3)+')');
    g.addColorStop(0.55,'rgba(110,235,190,0.28)');
    g.addColorStop(1,'rgba(110,235,190,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.fill();
  } else {
    const g=ctx.createRadialGradient(0,0,4,0,0,half+8);
    g.addColorStop(0,'rgba(120,110,150,0.28)'); g.addColorStop(1,'rgba(120,110,150,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,half+8,0,TAU); ctx.fill();
  }
  if(artImgs.portal){
    ctx.globalAlpha=active?1:0.45; drawSprite('portal',0,0,72); ctx.globalAlpha=1;
  } else {
    // stone frame + dark stairwell
    ctx.fillStyle=active?'#2c3a1c':'#2a2a33'; rrect(-half-4,-half-4,W+8,W+8,5);
    ctx.fillStyle='#0a0f08'; ctx.fillRect(-half,-half,W,W);
    // descending steps: far/top = narrow & dark, near/bottom = wide & bright
    const steps=5, sh=W/steps;
    const palA=[[150,238,200],[112,196,158],[82,156,122],[56,116,88],[34,78,58]];
    const palS=[[156,146,176],[126,118,146],[98,92,116],[72,68,88],[50,46,62]];
    for(let r=0;r<steps;r++){
      const f=r/(steps-1), sw=W*(0.6+0.4*f), yTop=-half+r*sh, c=(active?palA:palS)[(steps-1)-r];
      ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(-sw/2, yTop, sw, sh*0.30);          // riser lip
      ctx.fillStyle='rgb('+c[0]+','+c[1]+','+c[2]+')'; ctx.fillRect(-sw/2, yTop+sh*0.30, sw, sh*0.70); // tread
    }
    ctx.strokeStyle=active?'rgba(180,255,220,0.55)':'rgba(150,140,170,0.4)'; ctx.lineWidth=2;
    ctx.strokeRect(-half,-half,W,W);
  }
  ctx.restore();
  // EXIT label — part of the art, so pre-GB and pixelated. Pixel font + dark outline.
  ctx.textAlign='center'; ctx.font='8px PressStart, monospace';
  ctx.fillStyle='rgba(8,16,8,0.85)'; ctx.fillText('EXIT', p.x+1, p.y-half-8+1);
  ctx.fillStyle=active?'#eaff9c':'#9a8fb6'; ctx.fillText('EXIT', p.x, p.y-half-8);
}
