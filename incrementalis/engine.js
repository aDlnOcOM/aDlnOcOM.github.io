import { blendSky, fadeStep } from './atmosphere.mjs';
// A small WebGL 2 renderer. All geometry and effects are generated locally.
export const V = {
  add: (a, b) => a.map((v, i) => v + b[i]),
  sub: (a, b) => a.map((v, i) => v - b[i]),
  mul: (a, n) => a.map(v => v * n),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); },
  mix: (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
};

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function lookAt(eye, target) {
  const z = V.norm(V.sub(eye, target)), x = V.norm(V.cross([0, 1, 0], z)), y = V.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
}
function ortho(size, near, far) { return new Float32Array([1 / size, 0, 0, 0, 0, 1 / size, 0, 0, 0, 0, -2 / (far - near), 0, 0, 0, -(far + near) / (far - near), 1]); }

export function geometryBounds(data) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.length; i += 10) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], data[i + axis]); max[axis] = Math.max(max[axis], data[i + axis]);
  }
  return { center: min.map((v, i) => (v + max[i]) / 2), half: min.map((v, i) => (max[i] - v) / 2) };
}

export function frustumPlanes(matrix) {
  return [0, 1, 2].flatMap(axis => [-1, 1].map(sign => [0, 1, 2, 3].map(column => matrix[column * 4 + 3] + sign * matrix[column * 4 + axis])));
}

export function boundsVisible(bounds, offset, planes) {
  if (!bounds) return true;
  return planes.every(p => p[3] + bounds.center.reduce((sum, v, i) => sum + (v + offset[i]) * p[i] + bounds.half[i] * Math.abs(p[i]), 0) >= -.01);
}

export class Geometry {
  constructor() { this.data = []; }
  vertex(p, n, c, e = 0) { this.data.push(...p, ...n, ...c, e); }
  tri(a, b, c, color, emission = 0, normal = null) {
    const n = normal || V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
    this.vertex(a, n, color, emission); this.vertex(b, n, color, emission); this.vertex(c, n, color, emission);
  }
  quad(a, b, c, d, color, emission = 0) { this.tri(a, b, c, color, emission); this.tri(a, c, d, color, emission); }
  tube(points, radii, color, sides = 9, emission = 0) {
    let frameAxis = null;
    const rings = points.map((p, i) => {
      const direction = V.norm(V.sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
      // Transport the previous frame: switching world axes twists adjoining rings.
      let axis = frameAxis && V.sub(frameAxis, V.mul(direction, V.dot(frameAxis, direction)));
      if (!axis || Math.hypot(...axis) < .001) axis = V.cross(direction, Math.abs(direction[1]) > .96 ? [1, 0, 0] : [0, 1, 0]);
      axis = V.norm(axis); frameAxis = axis;
      const other = V.cross(direction, axis);
      return Array.from({ length: sides }, (_, s) => {
        const angle = s / sides * Math.PI * 2, rib = 1 + Math.sin(s * 13.4 + i * .7) * .065;
        const normal = V.add(V.mul(axis, Math.cos(angle)), V.mul(other, Math.sin(angle)));
        return { p: V.add(p, V.mul(normal, radii[i] * rib)), n: normal };
      });
    });
    for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < sides; s++) {
      const a = rings[i][s], b = rings[i][(s + 1) % sides], c = rings[i + 1][(s + 1) % sides], d = rings[i + 1][s];
      for (const v of [a, b, c, a, c, d]) this.vertex(v.p, v.n, color, emission);
    }
    for (let s = 0; s < sides; s++) {
      this.tri(points[0], rings[0][(s + 1) % sides].p, rings[0][s].p, color, emission);
      const last = rings.length - 1;
      this.tri(points[last], rings[last][s].p, rings[last][(s + 1) % sides].p, color, emission);
    }
  }
  box(center, size, color, angle = 0, emission = 0) {
    const p = (x, y, z) => [center[0] + x * size[0] * Math.cos(angle) - z * size[2] * Math.sin(angle), center[1] + y * size[1], center[2] + x * size[0] * Math.sin(angle) + z * size[2] * Math.cos(angle)];
    const a = p(-.5, -.5, -.5), b = p(.5, -.5, -.5), c = p(.5, .5, -.5), d = p(-.5, .5, -.5), e = p(-.5, -.5, .5), f = p(.5, -.5, .5), g = p(.5, .5, .5), h = p(-.5, .5, .5);
    this.quad(a, d, c, b, color, emission); this.quad(e, f, g, h, color, emission); this.quad(a, e, h, d, color, emission); this.quad(b, c, g, f, color, emission); this.quad(d, h, g, c, color, emission); this.quad(a, b, f, e, color, emission);
  }
  rock(center, scale, color, phase = 0, detail = 7) {
    const rings = 5;
    const p = (i, j) => {
      const phi = i / rings * Math.PI, theta = j / detail * Math.PI * 2;
      const wobble = 1 + Math.sin(j * 14.3 + i * 9.7 + phase) * .16;
      return [center[0] + Math.sin(phi) * Math.cos(theta) * scale[0] * wobble, center[1] + Math.cos(phi) * scale[1] * wobble, center[2] + Math.sin(phi) * Math.sin(theta) * scale[2] * wobble];
    };
    for (let i = 0; i < rings; i++) for (let j = 0; j < detail; j++) {
      const shade = 1 + Math.sin(i * 16.7 + j * 10.1 + phase) * .08;
      this.quad(p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j), color.map(v => v * shade));
    }
  }
  crystal(position, height, radius, color, lean = [0, 0], emission = .55) {
    const points = [position, [position[0] + lean[0] * .75, position[1] + height * .73, position[2] + lean[1] * .75], [position[0] + lean[0], position[1] + height, position[2] + lean[1]]];
    this.tube(points, [radius * .7, radius, 0], color, 5, emission);
  }
}

const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
layout(location=3) in float aEmission;
uniform mat4 uVP;
uniform mat4 uLight;
uniform vec3 uOffset;
out vec3 vPosition; out vec3 vTexturePosition; out vec3 vNormal; out vec3 vColor; out float vEmission; out vec4 vShadow;
void main(){vec3 p=aPosition+uOffset;vPosition=p;vTexturePosition=aPosition;vNormal=aNormal;vColor=aColor;vEmission=aEmission;vShadow=uLight*vec4(p,1.);gl_Position=uVP*vec4(p,1.);}`;
const fragmentShader = `#version 300 es
precision highp float;
in vec3 vPosition;in vec3 vTexturePosition;in vec3 vNormal;in vec3 vColor;in float vEmission;in vec4 vShadow;
uniform sampler2D uShadow;uniform vec3 uEye;uniform vec3 uFog;uniform vec3 uSun;uniform vec3 uSunDirection;uniform vec3 uAmbient;uniform float uTime;uniform float uAutumn;uniform float uFade;uniform float uRetiring;uniform float uGhost;uniform float uSkyReveal;uniform float uMaterial;uniform vec4 uPulse;
out vec4 fragColor;
uniform float uFogDensity;uniform float uFogVertical;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
 float coverage=hash(vec3(floor(gl_FragCoord.xy),0.));if(uGhost<.5 && (uRetiring>.5 ? coverage<1.-uFade : coverage>=uFade))discard;
 vec3 n=normalize(vNormal); if(!gl_FrontFacing)n=-n;
 vec3 light=normalize(uSunDirection);float diffuse=max(dot(n,light),0.);
 vec3 sc=vShadow.xyz/vShadow.w*.5+.5;float shadow=0.;
 if(sc.x>0.&&sc.x<1.&&sc.y>0.&&sc.y<1.&&sc.z<1.){float bias=max(.0022*(1.-diffuse),.0008);vec2 texel=1./vec2(textureSize(uShadow,0));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)shadow+=sc.z-bias>texture(uShadow,sc.xy+vec2(x,y)*texel).r?1.:0.;shadow/=9.;}
 float grain2=sin(vTexturePosition.y*13.+sin(vTexturePosition.x*7.)*2.+vTexturePosition.z*9.);
 float footprint=max(length(dFdx(vTexturePosition)),length(dFdy(vTexturePosition)));float micro=1.-smoothstep(.04,.20,footprint);
 vec3 base=vColor*(.98+grain2*.025*micro*uMaterial);
 float organic=step(base.r*1.10,base.g);
 vec3 texPos=vTexturePosition*vec3(.8,1.8,.8);float grain=hash(floor(texPos*18.));
 float veins=sin(vTexturePosition.y*2.+sin(vTexturePosition.x*9.+vTexturePosition.z*7.)*1.8)*.5+.5;
 float seam=step(.965,fract(vTexturePosition.y*.32))+step(.975,fract((vTexturePosition.x+vTexturePosition.z)*.42));
 float bark=step(base.g*1.16,base.r)*step(base.b*1.2,base.g)*(1.-step(.2,vEmission));
 float wood=sin((vTexturePosition.x+vTexturePosition.z*.7)*8.+sin(vTexturePosition.y*.4)*.5);
 float textureShade=mix((grain-.5)*.16*micro-seam*.15,(veins-.5)*.15*micro,organic);
 textureShade=mix(textureShade,wood*.12*micro,bark);
 base*=1.+uMaterial*textureShade;
 if(base.g>base.r*1.12&&vEmission<.1)base=mix(base,base*vec3(1.6,.78,.55),uAutumn*.75);
 vec3 ambient=uAmbient*(max(n.y,0.)*.38+.82)*mix(.37,1.,uSkyReveal);
 vec3 color=base*(ambient+uSun*diffuse*(1.-shadow*.66)*mix(.17,1.42,uSkyReveal));
 float rim=pow(1.-max(dot(n,normalize(uEye-vPosition)),0.),3.);
 color+=base*rim*.08+base*vEmission*(1.2+sin(uTime*1.4+vTexturePosition.x)*.15);
 float pulseAge=uTime-uPulse.w;float wave=exp(-pow((distance(vPosition.xz,uPulse.xz)-pulseAge*14.)*1.1,2.))*max(0.,1.-pulseAge/2.5)*step(0.,pulseAge);
 color+=vec3(.28,.78,.62)*wave*.7;
 float dist=length((uEye-vPosition)*vec3(1.,uFogVertical,1.));float fog=1.-exp(-pow(dist*uFogDensity,2.));fog=clamp(fog,0.,.995);
 color=mix(color,mix(vec3(.002,.003,.007),uFog,uSkyReveal),fog);
 color=color/(1.+color*.22);color=pow(max(color,vec3(0.)),vec3(.88));
 fragColor=vec4(color,uGhost>.5?uFade:1.);
}`;
const depthFragment = `#version 300 es
precision highp float;
void main(){}`;
const skyVertex = `#version 300 es
out vec2 vUV;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUV=p;gl_Position=vec4(p*2.-1.,1.,1.);}`;
const skyFragment = `#version 300 es
precision highp float;
in vec2 vUV;uniform float uTime;uniform vec3 uFog;uniform vec3 uSun;uniform vec3 uTop;uniform vec3 uHorizon;uniform vec3 uSunDirection;uniform vec3 uForward;uniform vec3 uRight;uniform vec3 uUp;uniform float uAspect;uniform float uNight;uniform float uSkyReveal;out vec4 fragColor;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.13)*.13+noise(p*8.19)*.07;}
void main(){
 vec2 screen=vUV*2.-1.;vec3 ray=normalize(uForward+uRight*screen.x*uAspect*.627+uUp*screen.y*.627);
 float altitude=max(0.,ray.y);vec3 c=mix(uHorizon,uTop,pow(altitude,.45));
 float facing=max(0.,dot(ray,normalize(uSunDirection)));float disk=smoothstep(.9991,.99965,facing);
 c+=uSun*(pow(facing,36.)*.35+pow(facing,280.)*.65+disk*1.5)*(1.-uNight);
 vec2 dome=vec2(atan(ray.z,ray.x),asin(clamp(ray.y,-1.,1.)));
 vec2 stars=dome*vec2(190.,190.);vec2 cell=floor(stars);float rnd=h(cell);
 float star=(1.-smoothstep(0.,.11,length(fract(stars)-vec2(.5))))*step(.981,rnd);
 float galaxy=pow(max(0.,1.-abs(ray.x*.7+ray.y*.3-ray.z*.45)*4.),3.)*fbm(dome*12.);
 c+=uNight*(star*(.7+rnd)*vec3(.78,.87,1.)+galaxy*vec3(.13,.12,.25))*smoothstep(.02,.2,altitude);
 float moon=smoothstep(.9988,.9995,facing);float craters=.78+noise(dome*240.)*.22;
 c+=uNight*(moon*craters*vec3(.87,.91,1.)+pow(facing,80.)*vec3(.09,.13,.22));
 vec2 cp=ray.xz/max(.14,ray.y)*.48+vec2(uTime*.002,uTime*.0006);
 float clouds=smoothstep(.48,.73,fbm(cp))*smoothstep(.02,.22,altitude);
 vec3 cloudColor=mix(uHorizon*.85+uSun*.20,vec3(.10,.14,.22),uNight);
 c=mix(c,cloudColor,clouds*.76);c=mix(uFog,c,smoothstep(-.08,.04,ray.y));
 fragColor=vec4(mix(vec3(.002,.003,.007),c/(1.+c*.13),uSkyReveal),1.);
}`;
const pointVertex = `#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aColor;layout(location=2)in float aSize;
uniform mat4 uVP;uniform vec3 uEye;uniform float uPixelRatio;
out vec3 vColor;
void main(){vColor=aColor;gl_Position=uVP*vec4(aPosition,1.);gl_PointSize=clamp(aSize*230.*uPixelRatio/max(length(uEye-aPosition),1.),1.,110.);}`;
const pointFragment = `#version 300 es
precision highp float;
in vec3 vColor;out vec4 fragColor;
void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=pow(1.-d,3.);fragColor=vec4(vColor*glow,glow);}`;

function program(gl, vertex, fragment) {
  const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(), v = compile(gl.VERTEX_SHADER, vertex), f = compile(gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export class Renderer {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL 2 недоступен. Включите аппаратное ускорение в настройках браузера.');
    const gl = this.gl;
    this.surface = program(gl, vertexShader, fragmentShader);
    this.depth = program(gl, vertexShader, depthFragment);
    this.sky = program(gl, skyVertex, skyFragment);
    this.particles = program(gl, pointVertex, pointFragment);
    this.locations = new Map();
    this.meshes = new Map();
    this.origin = [0, 0, 0]; this.fogDensity = .0055; this.fogVertical = .3;
    this.motion = true; this.skyState = blendSky(null, 'dawn', 0); this.shadowClock = 0;
    this.skyReveal = 1; this.materialReveal = 1; this.pulse = [0, 0, 0, -100];
    this.eye = [32, 23, 48];
    this.vp = new Float32Array(16);
    this.light = multiply(ortho(58, 1, 170), lookAt([-48, 82, 30], [0, 4, 0]));
    this.fog = [.155, .235, .198]; this.sun = [1.04, .91, .66];
    this.quality = quality;
    this.shadowTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 2048, 2048, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFBO = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTexture, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Не удалось создать освещение мира.');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pointVAO = gl.createVertexArray(); this.pointBuffer = gl.createBuffer(); gl.bindVertexArray(this.pointVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
    for (const [index, size, offset] of [[0, 3, 0], [1, 3, 12], [2, 1, 24]]) { gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, size, gl.FLOAT, false, 28, offset); }
    gl.bindVertexArray(null);
    this.shadowDirty = true;
    this.resize();
  }
  uniform(p, name) { let m = this.locations.get(p); if (!m) { m = new Map(); this.locations.set(p, m); } if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name)); return m.get(name); }
  setMesh(name, geometry, dynamic = false, shadow = true, fade = false) {
    this.dirty = true;
    fade = fade && this.motion;
    this.hasTransitions ||= fade;
    if (fade && this.meshes.has(name)) this.removeMesh(name, true);
    const gl = this.gl; let mesh = this.meshes.get(name);
    if (!mesh) {
      mesh = { vao: gl.createVertexArray(), buffer: gl.createBuffer(), count: 0, shadow, opacity: fade ? 0 : 1, targetOpacity: 1, retiring: false };
      gl.bindVertexArray(mesh.vao); gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      for (const [i, s, o] of [[0, 3, 0], [1, 3, 12], [2, 3, 24], [3, 1, 36]]) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, s, gl.FLOAT, false, 40, o); }
      this.meshes.set(name, mesh);
    }
    const vertices = geometry.data instanceof Float32Array ? geometry.data : new Float32Array(geometry.data);
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    mesh.indexed = !!geometry.indices;
    if (mesh.indexed) {
      if (!mesh.indexBuffer) mesh.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
      mesh.indexType = geometry.indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;
    }
    mesh.vertexCount = vertices.length / 10; mesh.count = geometry.indices?.length ?? mesh.vertexCount;
    mesh.byteLength = vertices.byteLength + (geometry.indices?.byteLength || 0);
    mesh.shadow = shadow; mesh.bounds = geometryBounds(vertices); gl.bindVertexArray(null);
    if (!dynamic && shadow) this.shadowDirty = true;
  }
  removeMesh(name, fade = false) {
    const mesh = this.meshes.get(name);
    if (!mesh) return;
    this.dirty = true;
    if (fade && this.motion && !mesh.retiring) {
      this.removeMesh(`${name}:retired`);
      this.meshes.delete(name); this.meshes.set(`${name}:retired`, mesh);
      if (mesh.shadow) this.shadowDirty = true;
      mesh.retiring = true; mesh.targetOpacity = 0; mesh.shadow = false;
      this.hasTransitions = true;
      return;
    }
    this.gl.deleteBuffer(mesh.buffer); if (mesh.indexBuffer) this.gl.deleteBuffer(mesh.indexBuffer); this.gl.deleteVertexArray(mesh.vao);
    this.meshes.delete(name);
    if (mesh.shadow) this.shadowDirty = true;
  }
  meshOrigin(name, origin) { const mesh = this.meshes.get(name); if (mesh) mesh.origin = [...origin]; }
  meshOffset(mesh) { return (mesh.origin || [0, 0, 0]).map((v, i) => v - this.origin[i]); }
  drawMesh(mesh) {
    const gl = this.gl; gl.bindVertexArray(mesh.vao);
    if (mesh.indexed) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  resize() {
    this.pixelRatio = Math.min(devicePixelRatio || 1, this.quality === 'low' ? 1 : 1.65);
    const w = Math.floor(this.canvas.clientWidth * this.pixelRatio), h = Math.floor(this.canvas.clientHeight * this.pixelRatio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.dirty = true; }
  }
  camera(eye, target) {
    this.eye = eye; this.forward = V.norm(V.sub(target, eye)); this.right = V.norm(V.cross(this.forward, [0, 1, 0])); this.up = V.cross(this.right, this.forward);
    this.vp = multiply(perspective(1.12, this.canvas.width / this.canvas.height, .06, this.farDistance || 650), lookAt(eye, target));
  }
  screenRay(nx = 0, ny = 0) { return V.norm(V.add(this.forward, V.add(V.mul(this.right, nx * this.canvas.width / this.canvas.height * Math.tan(.56)), V.mul(this.up, ny * Math.tan(.56))))); }
  atmosphere(preset, dt, reduced = false) {
    const previous = this.skyState.direction;
    this.motion = !reduced; this.skyState = blendSky(this.skyState, preset, dt, reduced);
    this.fog = this.skyState.fog; this.sun = this.skyState.sun; this.shadowClock += dt;
    if (this.shadowClock > .12 && previous.some((n, i) => Math.abs(n - this.skyState.direction[i]) > .00001) || !this.atmosphereReady) {
      this.light = multiply(ortho(58, 1, 220), lookAt(V.mul(V.norm(this.skyState.direction), 105), [0, 3, 0]));
      this.shadowDirty = true; this.shadowClock = 0; this.atmosphereReady = true;
    }
  }
  project(position) {
    const m = this.vp, p = [...position, 1], c = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) c[r] += m[k * 4 + r] * p[k];
    if (c[3] <= 0) return null;
    return { x: (c[0] / c[3] * .5 + .5) * this.canvas.clientWidth, y: (-c[1] / c[3] * .5 + .5) * this.canvas.clientHeight, visible: Math.abs(c[0] / c[3]) < 1 && Math.abs(c[1] / c[3]) < 1 };
  }
  render(time, points, autumn = 0, dt = .016) {
    const gl = this.gl;
    this.hasTransitions = false;
    for (const [name, mesh] of this.meshes) {
      mesh.opacity = fadeStep(mesh.opacity, mesh.targetOpacity, dt, !this.motion);
      if (mesh.opacity !== mesh.targetOpacity) this.hasTransitions = true;
      if (mesh.retiring && mesh.opacity <= 0) this.removeMesh(name);
    }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    if (this.shadowDirty) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO); gl.viewport(0, 0, 2048, 2048); gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(this.depth);
      gl.uniformMatrix4fv(this.uniform(this.depth, 'uVP'), false, this.light);
      for (const mesh of this.meshes.values()) if (mesh.shadow) { gl.uniform3fv(this.uniform(this.depth, 'uOffset'), this.meshOffset(mesh)); this.drawMesh(mesh); }
      this.shadowDirty = false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(...this.fog, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this.sky); gl.bindVertexArray(null);
    gl.uniform1f(this.uniform(this.sky, 'uTime'), time); gl.uniform3fv(this.uniform(this.sky, 'uFog'), this.fog); gl.uniform3fv(this.uniform(this.sky, 'uSun'), this.sun);
    for (const [name, value] of [['uForward', this.forward], ['uRight', this.right], ['uUp', this.up], ['uTop', this.skyState.top], ['uHorizon', this.skyState.horizon], ['uSunDirection', this.skyState.direction]]) gl.uniform3fv(this.uniform(this.sky, name), value);
    gl.uniform1f(this.uniform(this.sky, 'uAspect'), this.canvas.width / this.canvas.height); gl.uniform1f(this.uniform(this.sky, 'uNight'), this.skyState.night); gl.uniform1f(this.uniform(this.sky, 'uSkyReveal'), this.skyReveal); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.useProgram(this.surface);
    gl.uniformMatrix4fv(this.uniform(this.surface, 'uVP'), false, this.vp); gl.uniformMatrix4fv(this.uniform(this.surface, 'uLight'), false, this.light);
    gl.uniform3fv(this.uniform(this.surface, 'uEye'), this.eye); gl.uniform3fv(this.uniform(this.surface, 'uFog'), this.fog); gl.uniform3fv(this.uniform(this.surface, 'uSun'), this.sun);
    gl.uniform1f(this.uniform(this.surface, 'uTime'), time); gl.uniform1f(this.uniform(this.surface, 'uAutumn'), autumn);
    gl.uniform1f(this.uniform(this.surface, 'uFogDensity'), this.fogDensity); gl.uniform1f(this.uniform(this.surface, 'uFogVertical'), this.fogVertical);
    gl.uniform3fv(this.uniform(this.surface, 'uSunDirection'), this.skyState.direction); gl.uniform3fv(this.uniform(this.surface, 'uAmbient'), this.skyState.ambient);
    gl.uniform1f(this.uniform(this.surface, 'uSkyReveal'), this.skyReveal); gl.uniform1f(this.uniform(this.surface, 'uMaterial'), this.materialReveal); gl.uniform4fv(this.uniform(this.surface, 'uPulse'), this.pulse);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTexture); gl.uniform1i(this.uniform(this.surface, 'uShadow'), 0);
    const planes = frustumPlanes(this.vp);
    const visible = [...this.meshes.values()].filter(mesh => boundsVisible(mesh.bounds, this.meshOffset(mesh), planes));
    for (const pass of [false, true]) {
      if (pass) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      for (const mesh of visible) if (!!mesh.ghost === pass) {
        gl.uniform3fv(this.uniform(this.surface, 'uOffset'), this.meshOffset(mesh));
        gl.uniform1f(this.uniform(this.surface, 'uFade'), mesh.opacity); gl.uniform1f(this.uniform(this.surface, 'uRetiring'), mesh.retiring ? 1 : 0); gl.uniform1f(this.uniform(this.surface, 'uGhost'), mesh.ghost ? 1 : 0);
        this.drawMesh(mesh);
      }
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    if (points.length) {
      gl.useProgram(this.particles); gl.bindVertexArray(this.pointVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
      gl.uniformMatrix4fv(this.uniform(this.particles, 'uVP'), false, this.vp); gl.uniform3fv(this.uniform(this.particles, 'uEye'), this.eye); gl.uniform1f(this.uniform(this.particles, 'uPixelRatio'), this.pixelRatio);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.drawArrays(gl.POINTS, 0, points.length / 7); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
    this.dirty = false;
  }
}
