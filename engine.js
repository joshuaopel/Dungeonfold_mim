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
  sack:{label:'Sack',hint:'Tiny & sneaky — slips under closed doors',speed:105,r:13,stealth:0.65},
  vase:{label:'Vase',hint:'Sneaky. Ability: shatter loudly — instant diversion',speed:100,r:12,stealth:0.65},
  barrel:{label:'Barrel',hint:'Ability: roll — a fast, noisy dash',speed:145,r:15,stealth:1.0},
  chest:{label:'Chest',hint:'A classic. Ability: snap at looters',speed:135,r:16,stealth:1.05},
  statue:{label:'Statue',hint:'Very slow — invisible while still, even to rogues',speed:65,r:20,stealth:1.3},
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
/* ---------- retro pixel tileset ----------
   Every tile is authored on a 16x16 pixel grid and upscaled 4x with hard
   edges (fillRect only - no strokes, no anti-aliasing) so the dungeon reads
   as a chunky, grimey retro tileset. Each id gets 4 seeded variants; custom
   tiles derive a shade ramp from their picked colour and reuse the same
   generators, so user tiles match the built-in art style. */
const _hex2rgb=h=>{h=String(h||'#3a2d4e').replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return [parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0];};
const _shade=(c,f)=>'rgb('+Math.min(255,Math.round(c[0]*f))+','+Math.min(255,Math.round(c[1]*f))+','+Math.min(255,Math.round(c[2]*f))+')';
function hexRamp(hex){ const c=_hex2rgb(hex); return [_shade(c,0.30),_shade(c,0.55),_shade(c,0.80),_shade(c,1.0),_shade(c,1.28),_shade(c,1.6)]; }
// 6-shade ramps, darkest (grout/outline) -> lightest (chips/highlights)
const TILE_RAMP={
  stone:['#141020','#231b31','#312742','#3a2f4d','#4d4163','#5d5075'],
  wood:['#160d05','#2c1c0e','#3f2a16','#4d341d','#5f4326','#755634'],
  mossStone:['#101720','#1f2733','#2a3441','#333f4d','#455465','#576b7d'],
  sand:['#3a3020','#584a2e','#6e5d3a','#7d6a44','#8f7c52','#a5915f'],
  marble:['#332e40','#57506a','#6f6883','#847d96','#9c94ad','#b8b0c9'],
  carpet:['#1c0a10','#38121c','#4c1a26','#5c212e','#712a37','#8a3644'],
  brick:['#20100c','#43221b','#582e24','#65362a','#784235','#8d5240'],
  timber:['#150d06','#2e1e10','#3e2917','#4a311c','#5c3f24','#6f4f2e'],
  mossWall:['#101a1c','#1f2f33','#2a3d41','#33484c','#42585c','#527076'],
  obsidian:['#0a0712','#150e20','#1d142c','#241a36','#332856','#5b3f8e'],
};
const MOSS_GREEN=['#1e3018','#2f4a22','#41632c','#568038','#6f9c48'];
function paintTile(g,id,v){
  let sd=(id*2654435761+v*40503+12345)>>>0;
  const R=()=>{sd=(Math.imul(sd,1103515245)+12345)>>>0;return ((sd>>>9)%8388608)/8388608;};
  const RI=(a,b)=>a+((R()*(b-a+1))|0);
  const S=TS/16;
  const px=(x,y,c)=>{ if(x<0||y<0||x>15||y>15)return; g.fillStyle=c; g.fillRect(x*S,y*S,S,S); };
  const rect=(x,y,w,h,c)=>{ if(w<=0||h<=0)return; g.fillStyle=c; g.fillRect(x*S,y*S,w*S,h*S); };
  const speck=(n,c,y0,y1)=>{ for(let i=0;i<n;i++) px(RI(0,15),RI(y0==null?0:y0,y1==null?15:y1),c); };
  const crack=(x,y,len,c)=>{ for(let i=0;i<len;i++){ px(x,y,c); y+=RI(0,1); x+=RI(-1,1); if(y>15)return; } };
  const blot=(cx,cy,r,c)=>{ for(let yy=-r;yy<=r;yy++)for(let xx=-r;xx<=r;xx++){ if(xx*xx+yy*yy<=r*r&&R()<0.72) px(cx+xx,cy+yy,c); } };

  /* shared generators - built-ins and custom tiles both use these */
  const flagstones=P=>{
    rect(0,0,16,16,P[0]);                                    // grout underlayer
    let y=0;
    while(y<16){
      const rowH=Math.min(RI(4,6),16-y);
      let x=0;
      while(x<16){
        const sw=Math.min(RI(4,7),16-x);
        rect(x,y,Math.max(1,sw-1),Math.max(1,rowH-1),P[RI(2,3)]);
        if(R()<0.5)px(x+RI(0,Math.max(0,sw-2)),y+RI(0,Math.max(0,rowH-2)),P[4]); // worn shine
        if(R()<0.6)px(x+RI(0,Math.max(0,sw-2)),y+RI(0,Math.max(0,rowH-2)),P[1]); // pit
        if(R()<0.35)px(x,y,P[1]);                                                // chipped corner
        x+=sw;
      }
      y+=rowH;
    }
    speck(RI(3,5),P[1]); speck(2,P[4]);
    if(v>0)crack(RI(2,13),RI(1,4),RI(4,8),P[0]);
    if(v>1)blot(RI(2,13),RI(3,13),2,P[1]);                   // grime blotch
  };
  const brickWall=(P,courseH,brickW)=>{
    rect(0,0,16,2,P[4]); rect(0,0,16,1,P[5]);                // lit top face of the wall
    rect(0,2,16,1,P[0]);                                      // dark lip under the cap
    rect(0,3,16,13,P[0]);                                     // mortar underlayer
    let row=0;
    for(let y=3;y<16;y+=courseH,row++){
      const h=Math.min(courseH-1,16-y); if(h<=0)break;
      const off=((row%2)*((brickW/2)|0)+v*2)%brickW;
      for(let x=-off;x<16;x+=brickW){
        const x0=Math.max(0,x), bw=Math.min(brickW-1-(x0-x),16-x0);
        if(bw<=0)continue;
        rect(x0,y,bw,h,P[RI(2,3)]);
        if(R()<0.5)px(x0+RI(0,bw-1),y,P[4]);                 // catch-light on brick top
        if(R()<0.4)px(x0+RI(0,bw-1),y+h-1,P[1]);             // grime along brick base
      }
    }
    if(v>0){ const dx=RI(1,14),dl=RI(8,15); for(let yy=3;yy<dl;yy++) if(R()<0.8)px(dx,yy,P[1]); } // damp streak
    if(v===3)crack(RI(3,12),3,RI(5,9),P[0]);
    speck(RI(2,4),P[1],3,15);
  };

  if(id===1){ flagstones(TILE_RAMP.stone); }
  else if(id===3){                                            // wood plank floor
    const P=TILE_RAMP.wood;
    for(let p=0;p<4;p++){
      const y=p*4;
      rect(0,y,16,3,P[2+((p+v)%2)]);
      rect(0,y+3,16,1,P[0]);                                  // seam between planks
      for(let i=0;i<RI(2,3);i++){                             // grain streaks
        const gy=y+RI(0,2); let gx=RI(0,9);
        for(let l=RI(3,7);l>0&&gx<16;l--,gx++) if(R()<0.8)px(gx,gy,P[1]);
      }
      const jx=((p*5+v*3)%14)+1;                              // butt joint + nails
      rect(jx,y,1,3,P[0]);
      if(R()<0.6)px(jx+1,y+1,P[5]);
    }
    const kx=RI(1,14),ky=RI(1,13);                            // knot
    px(kx,ky,P[0]); px(kx,ky-1,P[1]); px(kx+1,ky,P[1]);
    if(v>1)blot(RI(3,12),RI(3,12),2,P[1]);                    // stain
    speck(2,P[4]);
  }
  else if(id===4){                                            // mossy stone floor
    flagstones(TILE_RAMP.mossStone);
    for(let i=0;i<RI(2,3);i++)blot(RI(2,13),RI(2,13),RI(1,2),MOSS_GREEN[1]);
    speck(RI(4,6),MOSS_GREEN[2]); speck(2,MOSS_GREEN[3]);
  }
  else if(id===5){                                            // sand
    const P=TILE_RAMP.sand;
    rect(0,0,16,16,P[3]);
    speck(26,P[4]); speck(18,P[2]); speck(6,P[1]);            // heavy grain dither
    for(let i=0;i<3;i++){                                     // wind ripples
      const ry=2+i*5+RI(0,1);
      for(let x=0;x<16;x++) if(R()<0.7)px(x,ry+(((x+v)%6<3)?0:1),P[4]);
    }
    for(let i=0;i<RI(2,3);i++){ const bx=RI(1,14),by=RI(1,14); px(bx,by,P[1]); px(bx,by-1,P[5]); } // pebbles
    if(v>1)blot(RI(3,12),RI(3,12),1,P[1]);
  }
  else if(id===6){                                            // dirty marble slabs
    const P=TILE_RAMP.marble;
    for(let sy=0;sy<2;sy++)for(let sx=0;sx<2;sx++)
      rect(sx*8,sy*8,7,7,P[3-((sx+sy+v)%2)]);
    rect(7,0,1,16,P[0]); rect(0,7,16,1,P[0]);                 // seams
    rect(15,0,1,16,P[0]); rect(0,15,16,1,P[0]);
    for(let s=0;s<RI(2,3);s++){                               // veins
      let vx=RI(1,14),vy=RI(0,4);
      for(let l=RI(5,8);l>0;l--){ px(vx,vy,P[1]); vx+=RI(-1,1); vy+=1; if(vy>15)break; if(R()<0.25)px(vx+1,vy,P[1]); }
    }
    speck(RI(3,5),P[1]); speck(2,P[5]);
    if(v>1)blot(RI(2,13),RI(2,13),1,P[1]);                    // grime
    if(v===3)crack(RI(3,12),RI(1,3),RI(4,7),P[0]);
  }
  else if(id===7){                                            // worn carpet
    const P=TILE_RAMP.carpet, GOLD=['#6e5218','#9a7a26','#c4a03a'];
    rect(0,0,16,16,P[2]);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)                // weave dither
      if(((x+((y&1)<<1)+v)&3)===0&&R()<0.8)px(x,y,P[3]);
    speck(8,P[1]);
    rect(0,0,16,1,P[1]);rect(0,15,16,1,P[1]);rect(0,0,1,16,P[1]);rect(15,0,1,16,P[1]); // dark edge
    for(let i=2;i<14;i+=2){ px(i,1,GOLD[1]); px(i,14,GOLD[1]); px(1,i,GOLD[1]); px(14,i,GOLD[1]); } // border studs
    px(1,1,GOLD[2]);px(14,1,GOLD[2]);px(1,14,GOLD[2]);px(14,14,GOLD[2]);
    if(v%2){ px(7,6,GOLD[1]);px(8,6,GOLD[1]);px(6,7,GOLD[1]);px(9,7,GOLD[1]);px(6,8,GOLD[1]);px(9,8,GOLD[1]);px(7,9,GOLD[1]);px(8,9,GOLD[1]);px(7,7,GOLD[2]);px(8,8,GOLD[2]); } // medallion
    if(v>1){ blot(RI(3,12),RI(3,12),2,P[0]); speck(3,P[0]); } // worn through to backing
  }
  else if(id===2){ brickWall(TILE_RAMP.stone,4,6); }          // stone block wall
  else if(id===8){                                            // brick wall
    brickWall(TILE_RAMP.brick,3,5);
    speck(RI(3,5),'#9a8d7a',9,15);                            // efflorescence
  }
  else if(id===9){                                            // timber wall
    const P=TILE_RAMP.timber;
    rect(0,0,16,2,P[4]); rect(0,0,16,1,P[5]); rect(0,2,16,1,P[0]);
    for(let p=0;p<4;p++){
      const x=p*4;
      rect(x,3,3,13,P[2+((p+v)%2)]);
      rect(x+3,3,1,13,P[0]);                                  // gap between planks
      const gx=x+RI(0,2);                                     // vertical grain
      for(let yy=RI(3,6),l=RI(4,8);l>0&&yy<16;l--,yy++) if(R()<0.75)px(gx,yy,P[1]);
      if(R()<0.5){ const ky=RI(6,13); px(x+1,ky,P[0]); px(x+1,ky-1,P[1]); } // knot
    }
    if(v%2){ rect(0,9,16,1,'#26262f'); px(1,9,'#61616f'); px(6,9,'#61616f'); px(11,9,'#61616f'); } // iron band + bolts
    speck(RI(2,4),P[1],3,15);
    if(v===3)crack(RI(3,12),4,RI(4,7),P[0]);
  }
  else if(id===10){                                           // moss-hung wall
    brickWall(TILE_RAMP.mossWall,4,6);
    for(let i=0,n=RI(5,7);i<n;i++){                           // moss drips from the cap
      const x=RI(0,15),len=RI(1,5);
      for(let yy=3;yy<3+len;yy++)px(x,yy,MOSS_GREEN[RI(1,2)]);
      px(x,3+len,MOSS_GREEN[3]);
    }
    blot(RI(2,13),RI(10,14),1,MOSS_GREEN[1]);
    speck(3,MOSS_GREEN[2],3,15);
  }
  else if(id===11){                                           // obsidian
    const P=TILE_RAMP.obsidian;
    rect(0,0,16,16,P[1]);
    rect(0,0,16,2,P[3]); rect(0,0,16,1,P[4]); rect(0,2,16,1,P[0]);
    for(let i=0,n=RI(3,4);i<n;i++){                           // glassy facet seams
      let fx=RI(0,15),fy=RI(3,10);
      for(let l=RI(4,8);l>0;l--){ px(fx,fy,P[2]); px(fx+1,fy,P[0]); fx+=1; fy+=1; if(fy>15)break; }
    }
    for(let i=0,n=RI(2,3);i<n;i++)px(RI(1,14),RI(4,14),P[5]); // violet glints
    speck(3,P[0],3,15);
  }
  else if(TILE_DEFS[id]){                                     // recolorable custom tiles
    const P=hexRamp(TILE_DEFS[id].color||'#3a2d4e');
    if(TILE_DEFS[id].kind==='wall')brickWall(P,4,6);
    else flagstones(P);
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
const walkTileSack=(c,r)=>isFloorT(T(level,c,r))&&!objBlock[c+','+r]; // sack quirk: slips under closed doors (walls still block)
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
function drawKeyItem(k,t){
  const bob=Math.sin((t||0)*2+(k.bob||0))*3;
  ctx.save();ctx.translate(k.x,k.y+bob);
  const grd=ctx.createRadialGradient(0,0,2,0,0,18);
  grd.addColorStop(0,'rgba(255,220,60,0.4)');grd.addColorStop(1,'rgba(255,220,60,0)');
  ctx.fillStyle=grd;ctx.beginPath();ctx.arc(0,0,18,0,TAU);ctx.fill();
  ctx.strokeStyle='#8a6020';ctx.lineWidth=2;ctx.fillStyle='#e8c44a';
  ctx.beginPath();ctx.arc(-4,0,6,0,TAU);ctx.fill();ctx.stroke();
  ctx.fillStyle='#e8c44a';ctx.beginPath();
  ctx.roundRect?ctx.roundRect(0,-2.5,13,5,2):rrect(0,-2.5,13,5,2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#e8c44a';ctx.strokeStyle='#8a6020';
  ctx.fillRect(6,2,3,5);ctx.strokeRect(6,2,3,5);
  ctx.fillRect(10,2,3,4);ctx.strokeRect(10,2,3,4);
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
  if(G.keys)for(const k of G.keys){
    if(!k.taken&&dist(G.player,k)<36){
      k.taken=true;sfx('coin');poof(k.x,k.y,PAL.gold,8);
      say(G.player,pick(['A key!','Got a key!','Useful…']));
    }
    if(k.taken)for(const l of G.links)if(l[0]===k.id)act[l[1]]=true;
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
  const abn=document.querySelector('#abSnap .nm'); // the R chip names the current form's quirk
  if(abn)abn.textContent=(G.player.form==='barrel')?'Roll':(G.player.form==='vase')?'Shatter':'Chest Snap';
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
  // GB filter on: swap the smooth flame/glow gradients for a chunky 2-frame pixel
  // flame and stepped glow discs. Smooth gradients feed the palette quantizer
  // ragged organic blobs; deliberate steps and hard pixels quantize into clean
  // retro shapes instead (the lightmap already draws the big stepped light pool).
  const _gbOn=!!(typeof level!=='undefined'&&level&&level.gb&&level.gb.on);
  if(p.glow){
    const ps=(p.pulse==null?1:p.pulse), br=1+Math.sin(t*ps*3)*0.18, R=18*br;
    if(_gbOn){
      const Rq=Math.round((R+10)/4)*4, a=0.22;
      ctx.fillStyle='rgba('+_rgb+','+a+')';
      ctx.beginPath();ctx.arc(p.x,p.y,Rq,0,TAU);ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,Rq*0.62,0,TAU);ctx.fill();
      if(_spr())return;
      ctx.fillStyle='rgb('+_rgb+')';ctx.fillRect(p.x-6,p.y-6,12,12);
      ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fillRect(p.x-3,p.y-3,6,6);
      return;
    }
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
  if(_gbOn){
    // stepped ground glow (two additive discs — quantizes to neat rings)
    const Rq=Math.round(gr/8)*8, ga=amb>0?0.22:0.15;
    ctx.fillStyle='rgba('+_rgb+','+ga+')';
    ctx.beginPath();ctx.arc(p.x,p.y,Rq,0,TAU);ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,Rq*0.55,0,TAU);ctx.fill();
    if(_spr())return;
    ctx.fillStyle='#6b4a2c';ctx.fillRect(p.x-3,p.y-2,6,14);
    // chunky 2-frame pixel flame, desynced per torch
    const u=3, frm=(((t*8)|0)+(p.x|0))&1, ox=frm?-u:0;
    ctx.fillStyle='rgb('+Math.round(_c[0]*0.62)+','+Math.round(_c[1]*0.45)+','+Math.round(_c[2]*0.4)+')';
    ctx.fillRect(p.x-2*u,p.y-11,4*u,9);            // flame body silhouette
    ctx.fillRect(p.x-u+ox+u,p.y-14,2*u,u);         // tip flicks side to side
    ctx.fillStyle='rgb('+_rgb+')';
    ctx.fillRect(p.x-u,p.y-9,2*u,2*u);             // hot mid
    ctx.fillStyle='#fff6d8';
    ctx.fillRect(p.x-2,p.y-6,4,4);                 // white core
    return;
  }
  const g=ctx.createRadialGradient(p.x,p.y,4,p.x,p.y,gr+fl*4);
  g.addColorStop(0,'rgba('+_rgb+','+(amb>0?0.5:0.30)+')');g.addColorStop(1,'rgba('+_rgb+',0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,gr+fl*4,0,TAU);ctx.fill();
  if(_spr())return;
  ctx.fillStyle='#6b4a2c';ctx.fillRect(p.x-3,p.y-2,6,14);
  ctx.fillStyle='rgb('+_rgb+')';ctx.beginPath();ctx.ellipse(p.x,p.y-6+fl*0.5,5,9+fl,0,0,TAU);ctx.fill();
  // darker hollow inside the flame body
  ctx.fillStyle='rgba('+Math.round(_c[0]*0.45)+','+Math.round(_c[1]*0.35)+','+Math.round(_c[2]*0.3)+',0.75)';
  ctx.beginPath();ctx.ellipse(p.x,p.y-9+fl*0.4,2.2,4,0,0,TAU);ctx.fill();
  ctx.fillStyle='rgba(255,255,236,0.92)';ctx.beginPath();ctx.ellipse(p.x,p.y-4,2.5,4,0,0,TAU);ctx.fill();
  // rising embers (stateless — derived from time, no particle arrays)
  for(let i=0;i<3;i++){
    const sp=0.35+(((p.x|0)*7+i*13)%10)/26;
    const ph=(t*sp+i*0.37+p.x*0.017)%1;
    if(ph>0.9)continue;
    const ex=p.x+Math.sin(t*0.9+i*2.1+p.x*0.05)*(2+ph*11);
    const ey=p.y-14-ph*26;
    ctx.globalAlpha=(1-ph)*0.85;
    ctx.fillStyle=ph<0.4?'#ffe9b0':'rgb('+_rgb+')';
    ctx.fillRect(ex-1,ey,2,2);
  }
  ctx.globalAlpha=1;
}
/* =========================================================
   DYNAMIC LIGHTING — torches (and the Mimic) cast real light
   onto a multiplied light-map; level.ambient sets how dark
   the unlit areas are (0 = lighting off, backward-compatible)
   ========================================================= */
let lightCanvas=null,lightCtx=null;
// Build the lightmap into lightCanvas but do NOT multiply onto ctx.
// Returns true if lighting is active (ambient>0).
function buildLightmap(t,camX,camY,zoom){
  const amb=(level.ambient==null?0:level.ambient);
  if(amb<=0)return false;
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
  // GB filter on: build the light pools out of STEPPED additive discs instead of a
  // smooth radial gradient. The palette pass quantizes light anyway — feeding it
  // deliberate steps gives clean concentric retro rings (one per palette band)
  // instead of ragged quantization edges, and the radius snaps to 16px so torch
  // flicker pops between ring sizes rather than shimmering. 4 solid arcs are also
  // cheaper than building a radial gradient per light per frame.
  const stepped=!!(typeof level!=='undefined'&&level&&level.gb&&level.gb.on);
  const addLight=(wx,wy,r,cr,cg,cb,inten)=>{
    const sx=(wx-camX)*zoom,sy=(wy-camY)*zoom,R=r*zoom;
    if(sx<-R||sy<-R||sx>vw+R||sy>vh+R)return;
    if(stepped){
      const Rq=Math.max(16,Math.round(R/16)*16);
      lx.fillStyle='rgba('+cr+','+cg+','+cb+','+(inten*0.25).toFixed(3)+')';
      lx.beginPath();lx.arc(sx,sy,Rq,0,TAU);lx.fill();
      lx.beginPath();lx.arc(sx,sy,Rq*0.72,0,TAU);lx.fill();
      lx.beginPath();lx.arc(sx,sy,Rq*0.5,0,TAU);lx.fill();
      lx.beginPath();lx.arc(sx,sy,Rq*0.3,0,TAU);lx.fill();
      return;
    }
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
  if(typeof G!=='undefined'&&G&&(typeof MODE==='undefined'||MODE==='play')){
    if(G.player)addLight(G.player.x,G.player.y,150,150,170,225,0.55);
    if(G.decoys)for(const d of G.decoys)if(d.t>0)addLight(d.x,d.y,90,255,210,120,0.5*Math.min(1,d.t));
    if(G.inter)for(const it of G.inter)if(it.kind==='trap'&&it.on)addLight(it.x,it.y,70,180,220,255,0.4);
  }
  return true;
}
function applyLighting(t,camX,camY,zoom){
  if(!buildLightmap(t,camX,camY,zoom))return;
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
/* ---------- frame-rate meter — press F3 to toggle (game and editor) ---------- */
let _fpsPrev=0,_fpsMs=16.7,SHOW_FPS=false;
addEventListener('keydown',e=>{ if(e.code==='F3'){ e.preventDefault(); SHOW_FPS=!SHOW_FPS; _fpsMs=16.7; } });
function fpsFrame(now){
  if(_fpsPrev){ const d=now-_fpsPrev; if(d>0&&d<500)_fpsMs+=(d-_fpsMs)*0.08; } // EMA; ignore tab-away gaps
  _fpsPrev=now;
  if(!SHOW_FPS)return;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='rgba(10,6,19,0.75)'; ctx.fillRect(vw-118,4,114,22);
  ctx.fillStyle=_fpsMs<=17?'#8bd17c':_fpsMs<=25?'#e8c34a':'#e0635a'; // green under 60fps budget, amber, red
  ctx.font='bold 11px monospace'; ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.fillText(Math.round(1000/_fpsMs)+' fps '+_fpsMs.toFixed(1)+'ms',vw-10,15);
  ctx.textAlign='start'; ctx.textBaseline='alphabetic';
}
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
let _gbLo=0,_gbHi=1; // temporally-smoothed luminance range for auto-contrast (stops palette clustering in the mid-tones)
// Reusable 256-entry dark->light colour lookup table. Both the palette and ramp-image
// paths fill this, so the per-pixel hot loop is a single indexed lookup.
let _lutBytes=new Uint8ClampedArray(256*4), _lutU32=new Uint32Array(_lutBytes.buffer);
// Ramp-image LUT, built asynchronously from a data URL. _rampKey tracks which URL it was
// built from; the editor sets _rampKey=null to force a rebuild when the ramp changes.
let _rampKey=null,_rampU32=null,_rampBytes=null,_rampLoading=null;
function rampLut(dataURL){
  if(!dataURL)return null;
  if(_rampKey===dataURL&&_rampU32)return {bytes:_rampBytes,u32:_rampU32};
  if(_rampLoading!==dataURL){
    _rampLoading=dataURL;
    try{
      const im=new Image();
      im.onload=()=>{ try{
        const c=document.createElement('canvas'); c.width=256; c.height=1;
        const cx=c.getContext('2d',{willReadFrequently:true}); cx.imageSmoothingEnabled=true;
        cx.drawImage(im,0,0,256,1);                       // resample the strip's gradient to 256 stops
        const id=cx.getImageData(0,0,256,1);
        _rampBytes=id.data; _rampU32=new Uint32Array(id.data.buffer); _rampKey=dataURL;
      }catch(e){ _rampU32=null; } _rampLoading=null; };
      im.onerror=()=>{ _rampLoading=null; };
      im.src=dataURL;
    }catch(e){ _rampLoading=null; }
  }
  return (_rampKey===dataURL&&_rampU32)?{bytes:_rampBytes,u32:_rampU32}:null;
}
// Returns a 256-entry LUT ({bytes,u32}) mapping normalised luminance 0..255 to colour.
function buildGbLut(scheme,colors,ramp){
  if(scheme==='ramp'){ const r=rampLut(ramp); if(r)return r; } // not loaded yet -> fall through to palette
  const PAL=(scheme==='custom'&&Array.isArray(colors)&&colors.length>=2)?colors:(GB_SCHEMES[scheme]||GB_SCHEMES.dmg);
  const n=PAL.length;
  for(let k=0;k<256;k++){ const c=PAL[gbLevel(k/255,n)],o=k<<2; _lutBytes[o]=c[0]; _lutBytes[o+1]=c[1]; _lutBytes[o+2]=c[2]; _lutBytes[o+3]=255; }
  return {bytes:_lutBytes,u32:_lutU32};
}

function applyGameBoy(px,scheme,colors,ramp,lift){
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
      const lb=buildGbLut(scheme,colors,ramp).bytes;
      const img=gbCtx.getImageData(0,0,lowW,lowH), d=img.data;
      const N=lowW*lowH;
      // Single pass: auto-contrast using LAST frame's smoothed range (mapping the full
      // ramp across the scene's luminance), while measuring THIS frame's range for next
      // frame. 1-frame latency is invisible and avoids a second full-buffer pass.
      // lift (lighting active): FIXED span so the mapping is absolute, not relative.
      // Auto-contrast would re-brighten the ambient veil, and a few bright flame
      // pixels would compress torch pools into one stop. Span 0.20 was measured from
      // the lit-scene histogram at 50% ambient: shadow <0.05, ambient floor 0.05-0.10,
      // wall caps 0.10-0.15, torch pools 0.15+ — one palette stop per band, so a pool
      // walks the whole ramp and anything brighter clips to the top stop (no blowout).
      // No lighting: auto-contrast as before (floor 0.34 avoids over-stretching).
      if(lift){ // absolute mapping: no range measurement needed at all
        const k=255/0.20;
        for(let p=0;p<N;p++){
          const i=p*4;
          let idx=((d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255*k)|0; if(idx>255)idx=255;
          const o=idx<<2;
          d[i]=lb[o]; d[i+1]=lb[o+1]; d[i+2]=lb[o+2]; d[i+3]=255;
        }
      }else{
        const span=Math.max(_gbHi-_gbLo,0.34), base=_gbLo;
        let lo=1,hi=0;
        for(let p=0;p<N;p++){
          const i=p*4;
          const raw=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255;
          if(raw<lo)lo=raw; if(raw>hi)hi=raw;
          let idx=((raw-base)/span)*255; idx=idx<0?0:idx>255?255:idx|0;
          const o=idx<<2;
          d[i]=lb[o]; d[i+1]=lb[o+1]; d[i+2]=lb[o+2]; d[i+3]=255;
        }
        _gbLo+=(lo-_gbLo)*0.2; _gbHi+=(hi-_gbHi)*0.2; // smooth so the mapping doesn't breathe as the view scrolls
      }
      gbCtx.putImageData(img,0,0);
    }
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(gbBuf,0,0,lowW,lowH,0,0,lowW*P,lowH*P);   // integer upscale = crisp uniform pixels
    ctx.imageSmoothingEnabled=true;
  }catch(e){/* headless / no getImageData — skip */}
}
function applyColorClamp(scheme,colors,ramp,lift){
  try{
    if(scheme==='native')return;
    if(!gbBuf){ gbBuf=document.createElement('canvas'); gbCtx=gbBuf.getContext('2d',{willReadFrequently:true}); }
    if(!gbCtx||!gbCtx.getImageData)return;
    if(gbBuf.width!==vw||gbBuf.height!==vh){ gbBuf.width=vw; gbBuf.height=vh; }
    gbCtx.drawImage(cv,0,0);
    const img=gbCtx.getImageData(0,0,vw,vh);
    const lu=buildGbLut(scheme,colors,ramp).u32;   // 256-entry dark->light LUT in native canvas byte order
    const d32=new Uint32Array(img.data.buffer);
    const len=d32.length;
    // Single pass: auto-contrast with last frame's smoothed range while measuring this
    // frame's range for next frame (avoids a second full-resolution pass).
    // lift = fixed absolute span under lighting; else auto-contrast. See applyGameBoy.
    if(lift){ // absolute mapping under lighting: integer-only, no range measurement
      for(let i=0;i<len;i++){
        const v=d32[i];
        // (299r+587g+114b) = lum*255000; idx = lum/0.20*255 = lum*1275 -> divide by 200
        let idx=((299*(v&0xFF)+587*((v>>>8)&0xFF)+114*((v>>>16)&0xFF))/200)|0; if(idx>255)idx=255;
        d32[i]=lu[idx];
      }
    }else{
      const span=Math.max(_gbHi-_gbLo,0.34), base=_gbLo;
      let lo=1,hi=0;
      for(let i=0;i<len;i++){
        const v=d32[i],r=v&0xFF,g=(v>>>8)&0xFF,b=(v>>>16)&0xFF;
        const raw=(299*r+587*g+114*b)/255000;
        if(raw<lo)lo=raw; if(raw>hi)hi=raw;
        let idx=((raw-base)/span)*255; idx=idx<0?0:idx>255?255:idx|0;
        d32[i]=lu[idx];
      }
      _gbLo+=(lo-_gbLo)*0.2; _gbHi+=(hi-_gbHi)*0.2;
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
  const ok=(k==='full'||k==='custom'||k==='scene'||!!GB_SCHEMES[k]);
  return ok?(px?k+'*':k):0;
};
// LUT for a pop recolor key. 'scene' follows whatever the level's filter is doing
// (preset, custom ramp of any size, or ramp image) — the pop then reads like the
// GB torch flame: crisp palette-true shading that survives the lighting quantizer.
const gbPopLut=key=>{
  if(key==='scene'){ const gb=(typeof level!=='undefined'&&level&&level.gb)||{}; return buildGbLut(gb.scheme,gb.colors,gb.ramp).bytes; }
  if(key==='custom') return buildGbLut('custom',(typeof level!=='undefined'&&level&&level.gb)?level.gb.colors:null,null).bytes;
  return buildGbLut(key,null,null).bytes;
};
// Redraw entities tagged .gbPop ON TOP of the GB scene so they stand out. 'full' = crisp full
// colour; a scheme/custom name = the entity recoloured with THAT palette; a '*' suffix also
// pixelates the pop to the scene's Px so it reads as part of the retro frame, not a sticker.
let popBuf=null,popCtx=null,popLow=null,popLowCtx=null; // popLow: small downscale buffer for pixelated pops (gbBuf belongs to the scene filter)
function drawGbPops(t,editor){
  const tre=editor?level.treasures:G.treasures, prp=editor?level.props:G.props, her=editor?level.heroes:G.heroes;
  const items=[];
  if(tre)for(const o of tre){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawTreasureAt(editor?{...o,bob:0}:o, editor?0:t),o.x,o.y,44]); }
  if(prp)for(const o of prp){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawPropAt(o.kind,o.x,o.y,editor?0:t,false,o),o.x,o.y,70]); }
  if(her)for(const o of her){ const v=gbPopVal(o&&o.gbPop); if(v)items.push([v,()=>drawHeroAt(editor?{...o,ang:0}:o, editor?0:t),o.x,o.y,70]); }
  if(!editor&&typeof G!=='undefined'&&G&&G.player&&level.gb){
    // The player ALWAYS renders properly (whatever form they've morphed into):
    // unset/legacy 0 defaults to the scene-palette pop; 'off' is the explicit opt-out.
    let pv=level.gb.player; if(pv==null||pv===0||pv==='0')pv='scene*'; else if(pv==='off')pv=0;
    const v=gbPopVal(pv); if(v)items.push([v,()=>drawPropAt(G.player.form,G.player.x,G.player.y,t,true,{aid:G.player.formAid}),G.player.x,G.player.y,70]);
  }
  if(!items.length) return;
  for(const it of items) if(it[0]==='full') it[1]();           // crisp full-colour: straight on top
  const off=items.filter(it=>it[0]!=='full');                   // everything needing the offscreen pass
  if(!off.length) return;
  if(!popBuf){ try{ popBuf=document.createElement('canvas'); popCtx=popBuf.getContext('2d',{willReadFrequently:true}); }catch(e){ popCtx=null; } }
  if(!popCtx||!popCtx.getImageData){ for(const it of off) it[1](); return; }  // headless fallback
  if(popBuf.width!==vw||popBuf.height!==vh){ popBuf.width=vw; popBuf.height=vh; }
  if(!popLow){ try{ popLow=document.createElement('canvas'); popLowCtx=popLow.getContext('2d',{willReadFrequently:true}); }catch(e){ popLowCtx=null; } }
  let m=null; try{ m=ctx.getTransform&&ctx.getTransform(); }catch(e){}
  const scale=m?Math.hypot(m.a,m.b):1;
  const groups={}; for(const it of off){ (groups[it[0]]=groups[it[0]]||[]).push(it); }
  const real=ctx;
  // Recolor a subregion through the palette LUT. bx/by anchor the Bayer pattern to
  // absolute screen blocks so the dither doesn't crawl as the bounding rect moves.
  const recolor=(c2,ox,oy,w,h,key,dither,bx,by)=>{
    const lb=gbPopLut(key), img=c2.getImageData(ox,oy,w,h), d=img.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*4; if(d[i+3]<8)continue;
      let lum=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255;
      if(dither)lum+=((GB_BAYER[(y+by)&3][(x+bx)&3]+0.5)/16-0.5)*0.16;
      let idx=(lum*255)|0; idx=idx<0?0:idx>255?255:idx; const o=idx<<2;
      d[i]=lb[o]; d[i+1]=lb[o+1]; d[i+2]=lb[o+2]; }
    c2.setTransform(1,0,0,1,0,0); c2.putImageData(img,ox,oy);
  };
  try{
    for(const v in groups){
      const px=v.endsWith('*'), key=px?v.slice(0,-1):v;
      const grp=groups[v];
      // union of the group's sprite bounds in SCREEN space — the whole offscreen
      // pass (clear/downscale/recolor/composite) only touches this rect, so a
      // single popped player costs ~a 150px square, not the full frame
      let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
      for(const it of grp){
        const sx=m?(m.a*it[2]+m.c*it[3]+m.e):it[2], sy=m?(m.b*it[2]+m.d*it[3]+m.f):it[3], rs=it[4]*scale;
        if(sx-rs<x0)x0=sx-rs; if(sy-rs<y0)y0=sy-rs; if(sx+rs>x1)x1=sx+rs; if(sy+rs>y1)y1=sy+rs;
      }
      const P=Math.max(1,Math.min(12,Math.round((level.gb&&level.gb.px)||5)));
      const rx=Math.max(0,Math.floor(x0/P)*P), ry=Math.max(0,Math.floor(y0/P)*P);   // block-aligned so
      const rw=Math.min(vw,Math.ceil(x1/P)*P)-rx, rh=Math.min(vh,Math.ceil(y1/P)*P)-ry; // pop pixels match scene grid
      if(rw<=0||rh<=0) continue;
      popCtx.setTransform(1,0,0,1,0,0); popCtx.clearRect(rx,ry,rw,rh);
      if(m&&popCtx.setTransform)popCtx.setTransform(m);
      ctx=popCtx; for(const it of grp) it[1](); ctx=real;
      try{
        if(px&&popLowCtx&&popLowCtx.getImageData){
          const lowW=Math.max(1,rw/P|0), lowH=Math.max(1,rh/P|0);
          if(popLow.width<lowW||popLow.height<lowH){ popLow.width=Math.max(popLow.width,lowW); popLow.height=Math.max(popLow.height,lowH); }
          popLowCtx.setTransform(1,0,0,1,0,0);
          popLowCtx.imageSmoothingEnabled=false; popLowCtx.clearRect(0,0,lowW,lowH);
          popLowCtx.drawImage(popBuf,rx,ry,rw,rh,0,0,lowW,lowH);
          if(key!=='full') recolor(popLowCtx,0,0,lowW,lowH,key,true,rx/P|0,ry/P|0);
          popCtx.setTransform(1,0,0,1,0,0); popCtx.clearRect(rx,ry,rw,rh); popCtx.imageSmoothingEnabled=false;
          popCtx.drawImage(popLow,0,0,lowW,lowH,rx,ry,rw,rh);
        } else if(key!=='full'){
          recolor(popCtx,rx,ry,rw,rh,key,false,0,0);   // crisp (non-pixelated) recolour
        }
      }catch(e){}
      real.setTransform(1,0,0,1,0,0); real.drawImage(popBuf,rx,ry,rw,rh,rx,ry,rw,rh);
      if(m&&real.setTransform)real.setTransform(m);
    }
  } finally { ctx=real; if(m&&ctx.setTransform){try{ctx.setTransform(m);}catch(e){}} }
}

/* ---------- GB torch flame + embers ----------
   Drawn AFTER the palette pass: any detail drawn pre-filter gets crushed to the
   top palette stop by the lighting quantizer, so the flame is stamped on top as
   a crisp sprite whose 5 shades are sampled from the ACTIVE palette LUT (works
   for presets, custom ramps of any size, and ramp images alike). Embers are
   stateless particles — position derived from time, no arrays, no GC. */
const _GB_FLAME_MAPS=[
  ['...O...','..OMO..','.OMLMO.','.OMNLO.','OMLNLMO','OMLCLMO','OLCCCLO','.OLLLO.'],
  ['....O..','..OMMO.','.OMLMO.','.OLNMO.','OMLNLMO','OMLCLMO','OLCCCLO','.OLLLO.'],
];
let _gbFxKey=null,_gbFxFrames=null,_gbFxCols=null;
function _gbFlameFrames(u){
  let cols;
  if(level.gb.scheme==='native'){ // pixelize-only mode keeps true colors -> fixed warm ramp
    cols={O:'#2a1608',N:'#6b3410',M:'#c66a1e',L:'#f0a83c',C:'#ffe9b0'};
  }else{
    const lb=buildGbLut(level.gb.scheme,level.gb.colors,level.gb.ramp).bytes;
    const pick=i=>{const o=i<<2;return 'rgb('+lb[o]+','+lb[o+1]+','+lb[o+2]+')';};
    // spread across the ramp: outline/notch dark, body mid, tongue light, core top
    cols={O:pick(20),N:pick(65),M:pick(130),L:pick(200),C:pick(252)};
  }
  const key=u+'|'+cols.O+cols.N+cols.M+cols.L+cols.C;
  if(_gbFxKey===key)return _gbFxFrames;
  _gbFxFrames=_GB_FLAME_MAPS.map(rows=>{
    const c=document.createElement('canvas'); c.width=7*u; c.height=8*u;
    const g=c.getContext('2d');
    rows.forEach((row,y)=>{ for(let x=0;x<7;x++){ const ch=row[x]; if(ch==='.')continue; g.fillStyle=cols[ch]; g.fillRect(x*u,y*u,u,u); } });
    return c;
  });
  _gbFxKey=key; _gbFxCols=cols;
  return _gbFxFrames;
}
function drawGbTorchFx(t){
  if(!(typeof level!=='undefined'&&level&&level.gb&&level.gb.on))return;
  const u=Math.max(3,Math.min(5,Math.round(level.gb.px||4)));
  let fr=null;
  try{ fr=_gbFlameFrames(u); }catch(e){ return; }
  if(!fr)return;
  for(const p of curTorches()){
    if(!torchLit(p)||p.glow)continue;
    if(p.aid&&assetImgs[p.aid])continue;          // custom-art torches keep their art
    const f=(((t*8)|0)+(p.x|0))&1;
    ctx.drawImage(fr[f],p.x-3.5*u,p.y-2-8*u);
    for(let i=0;i<3;i++){                          // rising embers, deterministic per torch
      const sp=0.35+(((p.x|0)*7+i*13)%10)/26;
      const ph=(t*sp+i*0.37+p.x*0.017)%1;
      if(ph>0.92)continue;
      const ex=p.x+Math.sin(t*0.9+i*2.1+p.x*0.05)*(3+ph*13);
      const ey=p.y-4-8*u-ph*36;
      const s=ph<0.5?u:Math.max(2,u-2);
      const rx=Math.round(ex-s/2),ry=Math.round(ey);
      ctx.fillStyle=_gbFxCols.O;                   // dark rim so the spark reads over bright pools
      ctx.fillRect(rx-1,ry-1,s+2,s+2);
      ctx.fillStyle=ph<0.35?_gbFxCols.C:(ph<0.7?_gbFxCols.L:_gbFxCols.M);
      ctx.fillRect(rx,ry,s,s);
    }
  }
}

function drawPortalAt(p,active,t){
  const W=36, half=W/2;
  ctx.save(); ctx.translate(p.x,p.y);
  // pulsing glow under the exit (drawn post-filter in play: the goal marker stays crisp and visible)
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
  // EXIT label — renders above the filter stack like the other in-game text. Pixel font + dark outline.
  ctx.textAlign='center'; ctx.font='8px PressStart, monospace';
  ctx.fillStyle='rgba(8,16,8,0.85)'; ctx.fillText('EXIT', p.x+1, p.y-half-8+1);
  ctx.fillStyle=active?'#eaff9c':'#9a8fb6'; ctx.fillText('EXIT', p.x, p.y-half-8);
}
