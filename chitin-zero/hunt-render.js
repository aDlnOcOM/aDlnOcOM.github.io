(function (root) {
  'use strict';
  const D = root.HuntData || require('./hunt-data.js'), C = root.HuntCore || require('./hunt-core.js');
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normal = a => { const l = Math.hypot(...a) || 1; return a.map(n => n / l); };
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  function multiply(a, b) { const m = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return m; }
  function matrix(player, aspect, reduced = false) {
    const yaw = player.yaw, pitch = player.pitch, sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
    const eye = [player.x, player.y + 1.6 + (reduced ? 0 : Math.sin(player.walk * 5) * .025), player.z];
    const right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp], back = [-sy * cp, -sp, cy * cp], dot = a => a.reduce((s, n, i) => s + n * eye[i], 0);
    const view = [right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0, -dot(right), -dot(up), -dot(back), 1];
    const f = 1 / Math.tan(Math.PI * 35 / 180), near = .06, far = 150;
    const projection = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
    return { matrix: multiply(projection, view), eye };
  }
  class Mesh {
    constructor() { this.buffer = new Float32Array(8192); this.length = 0; }
    reserve(count) { if (this.length + count <= this.buffer.length) return; const next = new Float32Array(Math.max(this.length + count, this.buffer.length * 2)); next.set(this.buffer); this.buffer = next; }
    get data() { return this.buffer.subarray(0, this.length); }
    triangle(a, b, c, color) {
      const bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2],cx=c[0]-a[0],cy=c[1]-a[1],cz=c[2]-a[2];
      let nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx;const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
      this.reserve(27);let i=this.length;const data=this.buffer;
      for(const p of [a,b,c]){data[i++]=p[0];data[i++]=p[1];data[i++]=p[2];data[i++]=nx;data[i++]=ny;data[i++]=nz;data[i++]=color[0];data[i++]=color[1];data[i++]=color[2];}
      this.length=i;
    }
    transformed(source, x, y, z, yaw) {
      this.reserve(source.length);const co=Math.cos(yaw),si=Math.sin(yaw),target=this.buffer;let out=this.length;
      for(let i=0;i<source.length;i+=9){target[out++]=x+source[i]*co+source[i+2]*si;target[out++]=y+source[i+1];target[out++]=z-source[i]*si+source[i+2]*co;target[out++]=source[i+3]*co+source[i+5]*si;target[out++]=source[i+4];target[out++]=-source[i+3]*si+source[i+5]*co;target[out++]=source[i+6];target[out++]=source[i+7];target[out++]=source[i+8];}
      this.length=out;
    }
    quad(a, b, c, d, color) { this.triangle(a, b, c, color); this.triangle(a, c, d, color); }
    box(x, y, z, sx, sy, sz, color, yaw = 0) {
      const co = Math.cos(yaw), si = Math.sin(yaw), points = [];
      for (const [px, py, pz] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]) points.push([x + px * sx / 2 * co + pz * sz / 2 * si, y + py * sy / 2, z - px * sx / 2 * si + pz * sz / 2 * co]);
      for (const ids of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) this.quad(...ids.map(i => points[i]), color);
    }
    rod(a, b, radius, color, sides = 6) {
      const axis = normal(b.map((v, i) => v - a[i])), u = normal(cross(axis, Math.abs(axis[1]) > .9 ? [1,0,0] : [0,1,0])), v = cross(axis, u);
      const point = (p, angle) => p.map((n, i) => n + (u[i] * Math.cos(angle) + v[i] * Math.sin(angle)) * radius);
      for (let i = 0; i < sides; i++) { const t = i * C.TAU / sides, q = (i + 1) * C.TAU / sides; this.quad(point(a,t), point(a,q), point(b,q), point(b,t), color); this.triangle(b, point(b,t), point(b,q), color); }
    }
    gem(x, y, z, r, color) { const top = [x,y+r,z], bottom = [x,y-r,z], ring = [[x-r,y,z],[x,y,z+r],[x+r,y,z],[x,y,z-r]]; for (let i=0;i<4;i++) { this.triangle(top, ring[i], ring[(i+1)%4], color); this.triangle(bottom, ring[(i+1)%4], ring[i], color); } }
    array() { return this.data; }
  }
  function arenaMesh(map) {
    const m = new Mesh(), theme = D.arenas[map.kind];
    for (let z = 0; z < map.size; z++) for (let x = 0; x < map.size; x++) {
      const type = map.cells[z * map.size + x], h = map.height(type), shade = .82 + C.hash(x, z) * .25, floor = theme.floor.map(c => c * shade), px = x * 3, pz = z * 3;
      m.quad([px,0,pz],[px,0,pz+3],[px+3,0,pz+3],[px+3,0,pz],floor);
      if (type) {
        m.box(px+1.5,h/2,pz+1.5,3,h,3,theme.wall.map(c=>c*shade));
        m.box(px+1.5,h+.09,pz+1.5,3.12,.18,3.12,theme.wall.map(c=>c*1.18));
        if (type === 2) {
          m.box(px+1.5,h/2,pz-.015,1.15,h*.72,.05,[.09,.10,.11]); m.box(px+1.5,h/2,pz+3.015,1.15,h*.72,.05,[.09,.10,.11]);
          for (const d of [.35,2.65]) { m.box(px+d,h/2,pz+.1,.22,h,.25,theme.wall.map(c=>c*1.1)); m.box(px+d,h/2,pz+2.9,.22,h,.25,theme.wall.map(c=>c*1.1)); }
          if ((x+z)%3===0) { m.rod([px+1.5,h,pz+1.5],[px+1.5,h+2.5,pz+1.5],.17,[.16,.16,.16]); m.gem(px+1.5,h+2.5,pz+1.5,.28,theme.accent); }
        }
        if (type === 1 && map.kind === 'cemetery') { m.box(px+1.5,h+.5,pz+1.5,.18,1,.18,[.42,.39,.33]); m.box(px+1.5,h+.7,pz+1.5,.65,.16,.18,[.42,.39,.33]); }
        if (type === 2 && map.kind === 'foundry') m.rod([px+1.5,h,pz+1.5],[px+1.5,h+3,pz+1.5],.65,[.23,.25,.26],8);
      } else if (C.hash(z+10,x)>.88) {
        const a=px+.5,b=pz+1; m.box(a,.025,b,.8,.05,.5,theme.floor.map(c=>c*.5));
      }
    }
    return m;
  }
  function creature(m, e, reduced) {
    const scale = e.height / 1.85, co=Math.cos(e.yaw),si=Math.sin(e.yaw), color=e.flash>0?[.95,.9,.8]:e.color;
    const point=(x,y,z)=>[e.x+(x*co+z*si)*scale,e.y+y*scale,e.z+(-x*si+z*co)*scale];
    const box=(x,y,z,a,b,c,col)=>m.box(...point(x,y,z),a*scale,b*scale,c*scale,col,e.yaw);
    const rod=(a,b,r,col)=>m.rod(point(...a),point(...b),r*scale,col,5);
    if (e.type==='bat') {
      const wing=reduced?.12:Math.sin(e.age*14)*.5;
      m.gem(e.x,e.y+.3,e.z,.3,color);
      for(const side of [-1,1]) { m.triangle([e.x,e.y+.3,e.z],[e.x+side*1.1,e.y+.5+wing,e.z+.1],[e.x+side*.55,e.y+.1,e.z+.55],color); m.gem(e.x+side*.1,e.y+.35,e.z-.2,.04,[1,.15,.12]); }
      return;
    }
    const gait=reduced?0:Math.sin(e.age*(e.type==='vampire'?10:6))*.24, bone=e.type==='skeleton', skin=bone?[.72,.68,.55]:[.49,.51,.43], cloth=color;
    for(const side of [-1,1]) {
      const step=gait*side; rod([side*.16,.92,0],[side*.17,.48,step],bone?.055:.105,cloth); rod([side*.17,.48,step],[side*.17,.1,-step],bone?.045:.085,skin); box(side*.17,.08,-step-.08,.19,.15,.32,[.10,.10,.12]);
      rod([side*.34,1.42,0],[side*.48,1.05,-step-.1],bone?.045:.08,cloth); rod([side*.48,1.05,-step-.1],[side*.40,.9,-step-.35],bone?.035:.07,skin);
    }
    box(0,1.14,0,.58,.62,.32,cloth); box(0,1.51,0,.13,.18,.12,skin); box(0,1.70,0,.34,.34,.30,skin);
    if (bone) for(let i=0;i<4;i++) box(0,1.01+i*.11,-.18,.47,.045,.06,[.78,.73,.60]);
    for(const s of [-1,1]) { box(s*.09,1.74,-.158,.095,.07,.025,[.045,.04,.045]); box(s*.09,1.74,-.175,.035,.027,.015,e.type==='cultist'?[.5,.8,1]:[1,.19,.12]); }
    box(0,1.60,-.157,.13,.045,.025,[.17,.12,.12]);
    if (e.type==='vampire'||e.boss||e.type==='cultist') {
      const cloak=point(0,1.5,.15), left=point(-.55,.18,.35),right=point(.55,.18,.35); m.triangle(cloak,left,right,cloth.map(c=>c*.55));
      for(const s of [-1,1]) m.triangle(point(s*.22,1.45,.1),point(s*.48,1.75,.15),point(s*.43,.75,.20),cloth);
    }
    if(e.type==='cultist') { box(0,1.92,.02,.44,.16,.4,cloth); rod([.48,.2,0],[.48,2.05,0],.045,[.28,.18,.12]); m.gem(...point(.48,2.1,0),.13*scale,[.65,.32,.95]); }
    if(e.boss) { for(let i=-1;i<=1;i++) m.gem(...point(i*.14,2.03,0),.2*scale,[.75,.48,.20]); rod([.48,.9,-.2],[.48,1.8,-.2],.05,[.2,.2,.2]); box(.48,1.65,-.2,.55,.40,.08,[.55,.55,.58]); }
    if(e.slow>0) m.gem(e.x,e.y+e.height+.18,e.z,.12,[.35,.8,1]);
  }
  // Eight sampled poses are reusable across the horde: only world transforms run per frame.
  // The cache has a hard upper bound: enemy types × 8 poses × 2 flash states × 2 LODs.
  const poses = new Map();
  function enemyPose(e, reduced, distant) {
    const phase=reduced?0:Math.floor(e.age*8)%8,key=`${e.type}:${phase}:${e.flash>0?1:0}:${distant?1:0}`;
    if(!poses.has(key)){
      const m=new Mesh(),local={...D.enemies[e.type],type:e.type,x:0,y:0,z:0,yaw:0,age:phase*C.TAU/8/(e.type==='bat'?14:e.type==='vampire'?10:6),flash:e.flash>0?1:0,slow:0};
      if(distant&&e.type!=='bat'){
        const h=e.height,color=e.flash>0?[.95,.9,.8]:e.color,swing=Math.sin(phase*C.TAU/8)*.1;
        m.box(0,h*.60,0,e.radius*1.4,h*.42,e.radius,color);m.box(0,h*.9,0,e.radius*.8,h*.19,e.radius*.8,[.6,.6,.5]);
        for(const side of [-1,1]){m.box(side*e.radius*.4,h*.22,side*swing,e.radius*.45,h*.44,e.radius*.5,color);m.rod([side*e.radius*.8,h*.78,0],[side*e.radius,h*.4,-side*swing],e.radius*.15,color,4);}
      }else creature(m,local,reduced);
      poses.set(key,m.array());
    }
    return poses.get(key);
  }
  function dynamicMesh(game, reduced=false, aspect=16/9) {
    const m=new Mesh();
    const p=game.player,sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),edge=Math.max(0,1/Math.sqrt(1+(Math.tan(Math.PI*35/180)*aspect)**2)-.25);
    for(const e of game.enemies) {
      const dx=e.x-p.x,dz=e.z-p.z,dist=Math.hypot(dx,dz);
      if(dist<4||(dx*sy-dz*cy)/dist>edge){m.transformed(enemyPose(e,reduced,dist>24&&!e.boss),e.x,e.y,e.z,e.yaw);if(e.slow>0)m.gem(e.x,e.y+e.height+.18,e.z,.12,[.35,.8,1]);}
      if(e.windup>0)ring(m,e.strikeX,e.strikeZ,3.4,[1,.2,.25]);
    }
    for(const d of game.drops) m.gem(d.x,.25+(reduced?0:Math.sin(game.time*3+d.x)*.07),d.z,.12,d.value>25?[1,.75,.25]:[.35,.85,.8]);
    for(const c of game.chests) { m.box(c.x,.35,c.z,1.1,.7,.65,[.32,.17,.10]); m.box(c.x,.72,c.z,1.15,.12,.7,[.65,.43,.18]); m.box(c.x,.4,c.z-.34,.13,.25,.05,[1,.75,.25]); }
    for(const b of game.bullets) { const col=rgb(b.color); if(b.weapon==='saw') m.gem(b.x,b.y,b.z,.28,col); else m.rod([b.x-b.vx*.016,b.y-b.vy*.016,b.z-b.vz*.016],[b.x,b.y,b.z],b.weapon==='flame'?.13:.035,col,4); }
    for(const b of game.hostile) m.gem(b.x,b.y,b.z,.16,[.78,.29,.95]);
    for(const e of game.effects) { const r=e.size*(1-e.life/e.max*.7); if(!reduced||e.size>1) m.gem(e.x,e.y,e.z,Math.min(r,.8),rgb(e.color).map(c=>c*(e.life/e.max))); }
    return m;
  }
  function ring(m,x,z,r,color) { for(let i=0;i<32;i++){const a=i*C.TAU/32,b=(i+1)*C.TAU/32; m.quad([x+Math.cos(a)*r,.025,z+Math.sin(a)*r],[x+Math.cos(b)*r,.025,z+Math.sin(b)*r],[x+Math.cos(b)*(r-.13),.025,z+Math.sin(b)*(r-.13)],[x+Math.cos(a)*(r-.13),.025,z+Math.sin(a)*(r-.13)],color); } }
  const vertex = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; uniform mat4 uMatrix; uniform vec3 uEye; varying vec3 vColor; varying float vDistance; void main(){float light=.43+.46*max(0.,dot(normalize(aNormal),normalize(vec3(-.4,.85,.3))))+.12*max(0.,dot(normalize(aNormal),vec3(.8,.2,-.4)));vColor=aColor*light;vDistance=distance(aPosition,uEye);gl_Position=uMatrix*vec4(aPosition,1.);}`;
  const fragment = `precision mediump float; varying vec3 vColor; varying float vDistance; uniform vec3 uFog; void main(){float fog=smoothstep(16.,84.,vDistance);gl_FragColor=vec4(mix(vColor,uFog,fog*.87),1.);}`;
  class Renderer {
    constructor(canvas, overlay, sprites) {
      this.canvas=canvas; this.overlay=overlay; this.sprites=sprites; this.ctx=overlay.getContext('2d'); this.gl=canvas.getContext('webgl',{alpha:false,antialias:true});
      if(!this.gl) throw Error('WebGL недоступен. Включи аппаратное ускорение браузера.');
      const gl=this.gl, compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram(); const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(this.program);
      this.locations={matrix:gl.getUniformLocation(this.program,'uMatrix'),eye:gl.getUniformLocation(this.program,'uEye'),fog:gl.getUniformLocation(this.program,'uFog')};
      this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(this.program,n));this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);this.reduced=false;this.resize();
    }
    resize(){this.width=this.canvas.clientWidth||root.innerWidth||1280;this.height=this.canvas.clientHeight||root.innerHeight||720;this.dpr=Math.min(1.5,root.devicePixelRatio||1);for(const c of [this.canvas,this.overlay]){c.width=Math.round(this.width*this.dpr);c.height=Math.round(this.height*this.dpr);}this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
    submit(buffer,data,usage){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);if(data)gl.bufferData(gl.ARRAY_BUFFER,data,usage);this.attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});}
    draw(game){
      const gl=this.gl, theme=D.arenas[game.map.kind],cam=matrix(game.player,this.width/this.height,this.reduced);gl.useProgram(this.program);
      if(this.map!==game.map){this.map=game.map;const mesh=arenaMesh(game.map).array();this.staticCount=mesh.length/9;this.submit(this.staticBuffer,mesh,gl.STATIC_DRAW);}
      gl.clearColor(...theme.sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.locations.matrix,false,cam.matrix);gl.uniform3fv(this.locations.eye,cam.eye);gl.uniform3fv(this.locations.fog,theme.sky);
      this.submit(this.staticBuffer,null,gl.STATIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,this.staticCount);const dynamic=dynamicMesh(game,this.reduced,this.width/this.height).array();this.submit(this.dynamicBuffer,dynamic,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,dynamic.length/9);
      this.drawOverlay(game);
    }
    drawOverlay(game){
      const ctx=this.ctx,p=game.player,w=this.width,h=this.height;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,w,h);
      const layout=weaponLayout(p.weapons.length,w,h);
      for(let i=layout.length-1;i>=0;i--){const m=layout[i],gun=p.weapons[i],frame=gun.flash>.105?1:gun.flash>.025?2:0;const sway=this.reduced?0:Math.sin(p.walk*3+m.tier)*2;
        this.sprites.draw(ctx,gun.id,frame,m.x,m.y+sway,m.width,m.side<0);
      }
      ctx.strokeStyle='#f3e5c5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w/2-10,h/2);ctx.lineTo(w/2-4,h/2);ctx.moveTo(w/2+4,h/2);ctx.lineTo(w/2+10,h/2);ctx.moveTo(w/2,h/2-10);ctx.lineTo(w/2,h/2-4);ctx.stroke();
      ctx.fillStyle='#f3e5c5';ctx.fillRect(w/2-1,h/2-1,2,2);
      if(p.hurt>0){ctx.strokeStyle='#c1373d';ctx.lineWidth=9;ctx.strokeRect(0,0,w,h);}
      if(game.enemies.some(e=>e.windup>0&&Math.hypot(e.strikeX-p.x,e.strikeZ-p.z)<3.4)){ctx.textAlign='center';ctx.font='bold 16px Georgia';ctx.fillStyle='#ffad87';ctx.fillText('УХОДИ ИЗ КРУГА',w/2,h*.32);ctx.textAlign='start';}
      const behind=game.enemies.find(e=>C.distance(e,p)<5&&Math.cos(Math.atan2(e.x-p.x,-(e.z-p.z))-p.yaw)<0);
      if(behind){ctx.textAlign='center';ctx.font='12px sans-serif';ctx.fillStyle='#f2ac7a';ctx.fillText('▼ ОПАСНОСТЬ СЗАДИ',w/2,h*.70);ctx.textAlign='start';}
    }
  }
  function weaponLayout(count,w,h){const width=Math.min(w*.29,h*.39);return Array.from({length:Math.min(14,count)},(_,i)=>({side:i%2?-1:1,x:w*(i%2?.12:.88),y:h*(.80-Math.floor(i/2)*.073),width:width*(1-Math.floor(i/2)*.035),tier:Math.floor(i/2)}));}
  class Sprites {
    constructor(){this.images=[];this.ready=false;}
    async load(onProgress=()=>{}){let done=0;this.images=await Promise.all(['a','b'].map(id=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{if(img.naturalWidth!==1024||img.naturalHeight!==1536){reject(Error(`Размер атласа weapons-${id}.png`));return;}onProgress(++done,2);resolve(img);};img.onerror=()=>reject(Error(`assets/hunt/weapons-${id}.png`));img.src=`assets/hunt/weapons-${id}.png`;})));this.ready=true;}
    draw(ctx,id,frame,x,y,width,flip=false){if(!this.ready)return;const rect=spriteRect(id,frame),img=this.images[rect.sheet],height=width*rect.h/rect.w;ctx.save();ctx.translate(x,y);ctx.scale(flip?-1:1,1);ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h,-width/2,-height/2,width,height);ctx.restore();}
  }
  function spriteRect(id,frame){const i=D.weapons[id].sprite,sheet=Math.floor(i/7),row=i%7,rows=sheet?[0,203,403,605,803,1018,1248,1536]:[0,218,426,638,838,1057,1280,1536];const cols=[0,342,684,1024],col=C.clamp(Math.floor(frame),0,2);return{sheet,x:cols[col],y:rows[row],w:cols[col+1]-cols[col],h:rows[row+1]-rows[row]};}
  const api={Renderer,Sprites,Mesh,arenaMesh,dynamicMesh,matrix,multiply,weaponLayout,spriteRect,vertex,fragment};root.HuntRender=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
