'use strict';
/* =====================================================================
   Renderer, post-processing, sky, particles, FX, batching, world
   collision & terrain.
   ===================================================================== */
const R = { time: 0, shake: 0, flash: 0, shock: 0, dmg: 0, fade: 0 };
const QUALITY = {
  ultra: { scale: 1, maxDpr: 2, shadow: 4096, msaa: 4, grass: 1.3, shadowDist: 70 },
  high: { scale: 1, maxDpr: 1.25, shadow: 2048, msaa: 4, grass: 1, shadowDist: 60 },
  medium: { scale: 0.85, maxDpr: 1, shadow: 2048, msaa: 2, grass: 0.6, shadowDist: 50 },
  low: { scale: 0.65, maxDpr: 1, shadow: 1024, msaa: 0, grass: 0.3, shadowDist: 40 },
};
function Q() { return QUALITY[Settings.quality] || QUALITY.high; }

const POST_VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const POST_FS = `
precision highp float;
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime,uExposure,uSat,uContrast,uVig,uGrain,uDamage,uCA,uFade,uShock,uFlash,uBloom;
uniform vec3 uTint,uLift; varying vec2 vUv;
vec3 aces(vec3 x){const float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.);}
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime*7.13)*43758.5453);}
void main(){
  vec2 uv=vUv; vec2 dc=uv-.5; float r2=dot(dc,dc);
  float ca=uCA*(0.3+r2*2.5)+uShock*0.006;
  vec3 c; c.r=texture2D(tDiffuse,uv+dc*ca).r; c.g=texture2D(tDiffuse,uv).g; c.b=texture2D(tDiffuse,uv-dc*ca).b;
  // cheap bloom: gather bright neighbours
  vec3 bl=vec3(0.); vec2 px=1.5/uRes;
  for(int i=0;i<8;i++){ float a=float(i)*0.785398; vec2 o=vec2(cos(a),sin(a));
    vec3 s1=texture2D(tDiffuse,uv+o*px*6.).rgb; vec3 s2=texture2D(tDiffuse,uv+o*px*16.).rgb;
    bl+=max(s1-1.0,0.)*0.6+max(s2-1.0,0.)*0.4; }
  c+=bl*uBloom*0.12;
  if(uShock>0.01){ vec3 acc=c; for(int i=1;i<6;i++){ float f=float(i)*0.004*uShock; acc+=texture2D(tDiffuse,uv-dc*f*3.).rgb; } c=acc/6.; }
  c*=uExposure; c=aces(c);
  c=pow(c,vec3(1./2.2));
  float l=dot(c,vec3(.299,.587,.114));
  c=mix(vec3(l),c,uSat*(1.-uDamage*0.55)*(1.-uShock*0.5));
  c=(c-.5)*uContrast+.5; c=c*uTint+uLift;
  c*=1.-uVig*smoothstep(.12,.9,r2*2.2);
  float edge=smoothstep(.05,.55,r2*2.);
  c=mix(c,vec3(.36,0.015,0.01),uDamage*edge*0.9);
  c+=(rnd(uv*uRes)-.5)*uGrain;
  c+=vec3(1.,.93,.8)*uFlash;
  c*=1.-uFade;
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

function initRenderer() {
  const canvas = document.getElementById('game');
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  r.outputEncoding = THREE.LinearEncoding; r.toneMapping = THREE.NoToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.autoClear = false;
  R.renderer = r; MAX_ANISO = Math.min(8, r.capabilities.getMaxAnisotropy());
  R.halfFloat = r.capabilities.isWebGL2 && (!!r.extensions.get('EXT_color_buffer_float') || !!r.extensions.get('EXT_color_buffer_half_float'));
  R.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2400); R.camera.rotation.order = 'YXZ';
  R.vmCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 20);
  R.vmScene = new THREE.Scene();
  R.postScene = new THREE.Scene(); R.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  R.post = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1.05 },
      uVig: { value: 0.45 }, uGrain: { value: 0.04 }, uDamage: { value: 0 }, uCA: { value: 0.0015 }, uFade: { value: 0 }, uShock: { value: 0 }, uFlash: { value: 0 }, uBloom: { value: 1 },
      uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) }
    }, vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), R.post); quad.frustumCulled = false; R.postScene.add(quad);
  R.pmrem = new THREE.PMREMGenerator(r);
  resize(); addEventListener('resize', resize);
}
function makeRT(w, h) {
  const opts = { type: R.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false };
  let rt;
  if (R.renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget && Q().msaa > 0) { rt = new THREE.WebGLMultisampleRenderTarget(w, h, opts); rt.samples = Q().msaa; }
  else rt = new THREE.WebGLRenderTarget(w, h, opts);
  return rt;
}
function resize() {
  const q = Q(), dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr);
  const w = Math.max(320, Math.floor(innerWidth * dpr * q.scale)), h = Math.max(200, Math.floor(innerHeight * dpr * q.scale));
  R.renderer.setSize(w, h, false);
  R.w = w; R.h = h;
  R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
  R.vmCamera.aspect = w / h; R.vmCamera.updateProjectionMatrix();
  if (R.rt) R.rt.dispose();
  R.rt = makeRT(w, h); R.rtQuality = Settings.quality;
  R.post.uniforms.uRes.value.set(w, h);
  if (R.sun) { R.sun.shadow.mapSize.set(q.shadow, q.shadow); if (R.sun.shadow.map) { R.sun.shadow.map.dispose(); R.sun.shadow.map = null; } }
}
function setFov(hfovDeg) {
  const v = 2 * Math.atan(Math.tan(hfovDeg * DEG / 2) / R.camera.aspect) / DEG;
  if (Math.abs(R.camera.fov - v) > 0.01) { R.camera.fov = v; R.camera.updateProjectionMatrix(); }
}
function renderFrame() {
  const r = R.renderer, u = R.post.uniforms;
  r.setRenderTarget(R.rt); r.setClearColor(0x000000, 1); r.clear();
  if (R.scene) r.render(R.scene, R.camera);
  if (VM.visible && R.vmScene) { r.clearDepth(); r.render(R.vmScene, R.vmCamera); }
  r.setRenderTarget(null);
  u.tDiffuse.value = R.rt.texture; u.uTime.value = R.time;
  u.uDamage.value = R.dmg; u.uFade.value = R.fade; u.uShock.value = R.shock; u.uFlash.value = R.flash;
  r.render(R.postScene, R.postCam);
}

/* ---------------- sky ---------------- */
const SKY_VS = `varying vec3 vDir; void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`;
const SKY_FS = `
varying vec3 vDir; uniform vec3 uTop,uHorizon,uBottom,uSun,uSunColor,uCloud,uCloudDark; uniform float uCover,uTime,uSunI;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){
  vec3 d=normalize(vDir); float y=d.y;
  vec3 col=y>0.?mix(uHorizon,uTop,pow(clamp(y,0.,1.),0.55)):mix(uHorizon,uBottom,clamp(-y*5.,0.,1.));
  vec3 sd3=normalize(uSun); float sd=max(dot(d,sd3),0.);
  col+=uSunColor*(pow(sd,6.)*0.18+pow(sd,48.)*0.5)*uSunI;
  if(y>-0.02){
    vec2 cp=d.xz/(max(y,0.)+0.1)*0.9+vec2(uTime*0.006,uTime*0.003);
    float c=fbm(cp); float c2=fbm(cp*2.1+vec2(3.1,1.7)+uTime*0.004);
    float cov=smoothstep(1.-uCover-0.08,1.-uCover+0.32,c);
    vec3 cc=mix(uCloud,uCloudDark,clamp(smoothstep(0.35,0.85,c2)*0.9+cov*0.25,0.,1.));
    cc+=uSunColor*pow(sd,5.)*0.5*(1.-c2)*uSunI;
    float fade=smoothstep(-0.02,0.22,y);
    col=mix(col,cc,cov*fade);
    col=mix(col,uHorizon,(1.-smoothstep(0.,0.12,y))*0.6);
    col+=uSunColor*smoothstep(0.9993,0.9998,sd)*6.*(1.-cov*0.95)*uSunI;
  }
  gl_FragColor=vec4(col,1.);
}`;
/* equirectangular environment painted on a canvas (sky gradient, sun, ground) */
function makeEnvTexture(env, sunDir) {
  const W = 256, H = 128, c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const top = srgbArr(env.sky.top), hor = srgbArr(env.sky.horizon), gr = srgbArr(env.groundColor || 0x3a3830), sun = srgbArr(env.sky.sunColor || env.sunColor || 0xfff0d0), cl = srgbArr(env.sky.cloud || 0xd8d8d8);
  const cover = env.sky.cover == null ? 0.5 : env.sky.cover, sI = env.sky.sunI == null ? 1 : env.sky.sunI;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, phi = u * TAU, th = v * Math.PI;
    const dx = Math.sin(th) * Math.sin(phi), dy = Math.cos(th), dz = Math.sin(th) * Math.cos(phi);
    let r, gg, b;
    if (dy > 0) { const k = Math.pow(dy, 0.55); r = lerp(hor[0], top[0], k); gg = lerp(hor[1], top[1], k); b = lerp(hor[2], top[2], k); const cc = cover * 0.8; r = lerp(r, cl[0], cc * (1 - dy * 0.3)); gg = lerp(gg, cl[1], cc * (1 - dy * 0.3)); b = lerp(b, cl[2], cc * (1 - dy * 0.3)); }
    else { const k = clamp(-dy * 4, 0, 1); r = lerp(hor[0], gr[0], k); gg = lerp(hor[1], gr[1], k); b = lerp(hor[2], gr[2], k); }
    const sd = Math.max(0, dx * sunDir.x + dy * sunDir.y + dz * sunDir.z), sg = (Math.pow(sd, 8) * 0.35 + Math.pow(sd, 64) * 0.6) * sI * (1 - cover * 0.6);
    r += sun[0] * sg; gg += sun[1] * sg; b += sun[2] * sg;
    const j = (y * W + x) * 4; d[j] = clamp(r, 0, 1) * 255; d[j + 1] = clamp(gg, 0, 1) * 255; d[j + 2] = clamp(b, 0, 1) * 255; d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding; return t;
}
function makeSkyMaterial(p) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: col(p.top) }, uHorizon: { value: col(p.horizon) }, uBottom: { value: col(p.bottom || p.horizon) },
      uSun: { value: p.sunDir.clone() }, uSunColor: { value: col(p.sunColor || 0xfff0d0) }, uSunI: { value: p.sunI == null ? 1 : p.sunI },
      uCloud: { value: col(p.cloud || 0xd8d8d8) }, uCloudDark: { value: col(p.cloudDark || 0x707070) }, uCover: { value: p.cover == null ? 0.5 : p.cover }, uTime: { value: 0 }
    }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false
  });
}

/* ---------------- level scene setup ---------------- */
function newScene(env) {
  // dispose old
  if (R.scene) disposeScene(R.scene);
  const s = new THREE.Scene(); R.scene = s; R.env = env;
  const sunDir = new THREE.Vector3(...env.sunDir).normalize(); env.sunDirV = sunDir;
  // sky
  const skyMat = makeSkyMaterial({ ...env.sky, sunDir });
  R.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 40, 20), skyMat); R.sky.frustumCulled = false; R.sky.renderOrder = -10; s.add(R.sky);
  // environment map from the sky
  if (R.envRT) R.envRT.dispose();
  R.envRT = R.pmrem.fromEquirectangular(makeEnvTexture(env, sunDir)); s.environment = R.envRT.texture;
  // fog
  s.fog = new THREE.FogExp2(col(env.fog), env.fogDensity);
  // lights
  R.hemi = new THREE.HemisphereLight(col(env.hemiSky), col(env.hemiGround), env.hemiI); s.add(R.hemi);
  R.sun = new THREE.DirectionalLight(col(env.sunColor), env.sunI);
  R.sun.castShadow = true; const q = Q(); R.sun.shadow.mapSize.set(q.shadow, q.shadow);
  const sc = R.sun.shadow.camera, sd = q.shadowDist; sc.left = -sd; sc.right = sd; sc.top = sd; sc.bottom = -sd; sc.near = 1; sc.far = 400;
  R.sun.shadow.bias = -0.0004; R.sun.shadow.normalBias = 0.03; R.sun.shadow.radius = 2;
  s.add(R.sun); s.add(R.sun.target);
  // dynamic point-light pool (fixed count so shaders never recompile)
  R.plights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffaa55, 0, 14, 2); l.userData.t = 0; l.userData.dur = 0; l.userData.i = 0; s.add(l); R.plights.push(l); }
  R.muzzleLight = new THREE.PointLight(col(0xffc27a), 0, 9, 2); s.add(R.muzzleLight);
  // static extra lights declared by level
  (env.lights || []).forEach(L => { const l = new THREE.PointLight(col(L.color), L.i, L.dist || 12, 2); l.position.set(...L.pos); if (L.shadow) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; } s.add(l); L.obj = l; });
  // viewmodel lights
  R.vmScene.clear && R.vmScene.clear();
  while (R.vmScene.children.length) R.vmScene.remove(R.vmScene.children[0]);
  R.vmHemi = new THREE.HemisphereLight(col(env.hemiSky), col(env.hemiGround), env.hemiI * (env.vmHemi || 1));
  R.vmSun = new THREE.DirectionalLight(col(env.sunColor), env.sunI * (env.vmSun || 0.9));
  R.vmFill = new THREE.PointLight(col(0xffc27a), 0, 3, 2);
  R.vmScene.add(R.vmHemi, R.vmSun, R.vmSun.target, R.vmFill);
  R.vmScene.environment = R.envRT.texture;
  // post grade
  const u = R.post.uniforms, g = env.grade || {};
  u.uExposure.value = g.exposure || 1; u.uSat.value = g.sat == null ? 0.85 : g.sat; u.uContrast.value = g.contrast || 1.06;
  u.uVig.value = g.vig == null ? 0.5 : g.vig; u.uGrain.value = g.grain == null ? 0.045 : g.grain;
  u.uTint.value.set(...(g.tint || [1, 1, 1])); u.uLift.value.set(...(g.lift || [0, 0, 0])); u.uBloom.value = g.bloom == null ? 1 : g.bloom;
  // particle systems
  FX.init(s, env);
  return s;
}
function disposeScene(s) {
  s.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && o.material.userData && o.material.userData.dispose) o.material.dispose();
  });
}
function updateSunShadow(center) {
  if (!R.sun) return;
  const d = R.env.sunDirV, s = R.sun;
  const snap = (Q().shadowDist * 2) / Q().shadow;
  const cx = Math.round(center.x / snap) * snap, cz = Math.round(center.z / snap) * snap;
  s.target.position.set(cx, center.y, cz); s.position.set(cx + d.x * 150, center.y + d.y * 150, cz + d.z * 150);
  s.target.updateMatrixWorld();
  if (R.sky) { R.sky.position.copy(R.camera.position); R.sky.material.uniforms.uTime.value = R.time; }
  // viewmodel light follows the world light, relative to camera
  R.vmSun.position.copy(R.camera.position).addScaledVector(d, 10); R.vmSun.target.position.copy(R.camera.position); R.vmSun.target.updateMatrixWorld();
}
function flashLight(pos, color, intensity, dur, dist = 14) {
  if (!R.plights) return;
  let best = R.plights[0];
  for (const l of R.plights) if (l.userData.t <= 0) { best = l; break; } else if (l.userData.t < best.userData.t) best = l;
  best.position.copy(pos); best.color.copy(col(color)); best.distance = dist; best.userData.t = dur; best.userData.dur = dur; best.userData.i = intensity; best.intensity = intensity;
}
function updateLights(dt) {
  if (!R.plights) return;
  for (const l of R.plights) { if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = l.userData.i * Math.max(0, l.userData.t / l.userData.dur); } else l.intensity = 0; }
  (R.env.lights || []).forEach(L => { if (L.flicker && L.obj) L.obj.intensity = L.i * (0.8 + Math.random() * 0.35); });
}

/* =====================================================================
   Particles (GPU points, one draw call per system)
   ===================================================================== */
const PART_VS = `
attribute vec4 pcolor; attribute float psize; attribute float pangle;
varying vec4 vColor; varying float vAngle; varying float vFog;
uniform float uScale; uniform float uFogDensity;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
  gl_PointSize=min(psize*uScale/max(-mv.z,0.1),900.);
  vColor=pcolor; vAngle=pangle; float d=length(mv.xyz); vFog=1.-exp(-uFogDensity*uFogDensity*d*d);
}`;
const PART_FS = `
uniform sampler2D map; uniform vec3 uFogColor; uniform float uAdd;
varying vec4 vColor; varying float vAngle; varying float vFog;
void main(){
  vec2 p=gl_PointCoord-.5; float c=cos(vAngle),s=sin(vAngle); p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+.5;
  vec4 t=texture2D(map,p); vec4 col=t*vColor;
  if(uAdd>0.5){ col.rgb*=col.a*(1.-vFog); col.a=0.; }
  else col.rgb=mix(col.rgb,uFogColor,vFog);
  if(uAdd<0.5 && col.a<0.004) discard;
  gl_FragColor=col;
}`;
class Particles {
  constructor(max, tex, additive) {
    this.max = max; this.n = 0; this.add = additive;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.ang = new Float32Array(max);
    const A = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', A(this.pos, 3)); g.setAttribute('pcolor', A(this.col, 4)); g.setAttribute('psize', A(this.size, 1)); g.setAttribute('pangle', A(this.ang, 1));
    this.g = g;
    this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.c0 = new Float32Array(max * 4); this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max); this.grav = new Float32Array(max); this.rot = new Float32Array(max); this.fin = new Float32Array(max);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 500 }, uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0 }, uAdd: { value: additive ? 1 : 0 } },
      vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending
    });
    if (additive) { this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneFactor; this.mat.blendEquation = THREE.AddEquation; }
    this.mat.userData.dispose = true;
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 3 : 2;
  }
  emit(p) {
    if (this.n >= this.max) return; const i = this.n++, i3 = i * 3, i4 = i * 4;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.v[i3] = p.vx || 0; this.v[i3 + 1] = p.vy || 0; this.v[i3 + 2] = p.vz || 0;
    this.life[i] = 0; this.ml[i] = p.life || 1; this.s0[i] = p.s0 || 1; this.s1[i] = p.s1 == null ? this.s0[i] : p.s1;
    const c0 = p.c0 || [1, 1, 1, 1], c1 = p.c1 || c0;
    for (let k = 0; k < 4; k++) { this.c0[i4 + k] = k < 3 ? lin(c0[k]) : c0[k]; this.c1[i4 + k] = k < 3 ? lin(c1[k]) : c1[k]; }
    this.drag[i] = p.drag || 0; this.grav[i] = p.grav || 0; this.rot[i] = p.rot || 0; this.ang[i] = p.ang == null ? Math.random() * TAU : p.ang; this.fin[i] = p.fin == null ? 0.08 : p.fin;
  }
  update(dt) {
    let n = this.n;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.ml[i]) { this._copy(n - 1, i); n--; i--; continue; }
      const i3 = i * 3, i4 = i * 4, t = this.life[i] / this.ml[i], dr = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr - this.grav[i] * dt; this.v[i3 + 2] *= dr;
      this.pos[i3] += this.v[i3] * dt; this.pos[i3 + 1] += this.v[i3 + 1] * dt; this.pos[i3 + 2] += this.v[i3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      const fi = this.fin[i] > 0 ? Math.min(1, t / this.fin[i]) : 1;
      for (let k = 0; k < 4; k++) this.col[i4 + k] = this.c0[i4 + k] + (this.c1[i4 + k] - this.c0[i4 + k]) * t;
      this.col[i4 + 3] *= fi;
      this.ang[i] += this.rot[i] * dt;
    }
    this.n = n;
    const g = this.g; g.attributes.position.needsUpdate = true; g.attributes.pcolor.needsUpdate = true; g.attributes.psize.needsUpdate = true; g.attributes.pangle.needsUpdate = true;
    g.setDrawRange(0, n);
    const u = this.mat.uniforms; u.uScale.value = R.h / (2 * Math.tan(R.camera.fov * DEG / 2));
    if (R.scene && R.scene.fog) { u.uFogColor.value.copy(R.scene.fog.color); u.uFogDensity.value = R.scene.fog.density; }
  }
  _copy(a, b) {
    if (a === b) return;
    const a3 = a * 3, b3 = b * 3, a4 = a * 4, b4 = b * 4;
    for (let k = 0; k < 3; k++) { this.pos[b3 + k] = this.pos[a3 + k]; this.v[b3 + k] = this.v[a3 + k]; }
    for (let k = 0; k < 4; k++) { this.col[b4 + k] = this.col[a4 + k]; this.c0[b4 + k] = this.c0[a4 + k]; this.c1[b4 + k] = this.c1[a4 + k]; }
    this.life[b] = this.life[a]; this.ml[b] = this.ml[a]; this.s0[b] = this.s0[a]; this.s1[b] = this.s1[a]; this.size[b] = this.size[a];
    this.drag[b] = this.drag[a]; this.grav[b] = this.grav[a]; this.rot[b] = this.rot[a]; this.ang[b] = this.ang[a]; this.fin[b] = this.fin[a];
  }
}

/* =====================================================================
   FX — impacts, explosions, tracers, decals, emitters
   ===================================================================== */
const FX = {
  emitters: [], tracers: [], debris: [],
  init(scene, env) {
    this.smoke = new Particles(2600, TEX.smoke, false);
    this.fire = new Particles(1400, TEX.smoke, true);
    this.spark = new Particles(700, TEX.spark, true);
    this.flash = new Particles(60, TEX.flash, true);
    this.dust = new Particles(1500, TEX.smoke, false);
    scene.add(this.smoke.points, this.dust.points, this.fire.points, this.spark.points, this.flash.points);
    this.smokeTint = env.smokeTint || [0.5, 0.49, 0.47];
    this.dustTint = env.dustTint || [0.55, 0.5, 0.42];
    this.emitters = []; this.tracers = []; this.debris = [];
    // tracers
    const tg = new THREE.BoxGeometry(0.035, 0.035, 1); tg.translate(0, 0, -0.5);
    const tm = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.2), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }); tm.userData.dispose = true;
    this.tracerPool = [];
    for (let i = 0; i < 60; i++) { const m = new THREE.Mesh(tg, tm); m.visible = false; m.frustumCulled = false; scene.add(m); this.tracerPool.push(m); }
    // decals
    const dg = new THREE.PlaneGeometry(1, 1);
    const dm = new THREE.MeshStandardMaterial({ map: TEX.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }); dm.userData.dispose = true;
    this.decals = new THREE.InstancedMesh(dg, dm, 240); this.decals.count = 0; this.decals.frustumCulled = false; this.decals.receiveShadow = true; scene.add(this.decals); this.decalI = 0;
    const sm = new THREE.MeshStandardMaterial({ map: TEX.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, roughness: 1 }); sm.userData.dispose = true;
    this.scorch = new THREE.InstancedMesh(dg, sm, 40); this.scorch.count = 0; this.scorch.frustumCulled = false; scene.add(this.scorch); this.scorchI = 0;
    // debris chunks (physical little rocks)
    const cg = new THREE.IcosahedronGeometry(0.06, 0);
    this.chunkMesh = new THREE.InstancedMesh(cg, MAT.stoneDark, 150); this.chunkMesh.count = 0; this.chunkMesh.frustumCulled = false; this.chunkMesh.castShadow = false; scene.add(this.chunkMesh);
  },
  update(dt) {
    for (const e of this.emitters) { if (e.dead) continue; e.acc = (e.acc || 0) + dt * e.rate * (e.intensity == null ? 1 : e.intensity); while (e.acc > 1) { e.acc -= 1; e.fn(e); } if (e.life != null) { e.life -= dt; if (e.life <= 0) e.dead = true; } }
    this.emitters = this.emitters.filter(e => !e.dead);
    this.smoke.update(dt); this.fire.update(dt); this.spark.update(dt); this.flash.update(dt); this.dust.update(dt);
    // tracers
    for (const t of this.tracers) {
      t.d += t.speed * dt; const m = t.m;
      if (t.d - t.len > t.max) { m.visible = false; t.dead = true; continue; }
      const head = Math.min(t.d, t.max), tail = Math.max(0, t.d - t.len);
      m.position.copy(t.o).addScaledVector(t.dir, head); m.scale.set(t.w, t.w, Math.max(0.01, head - tail)); m.visible = true;
    }
    this.tracers = this.tracers.filter(t => !t.dead);
    // debris
    const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), S = new THREE.Vector3();
    let n = 0;
    for (const d of this.debris) {
      d.t += dt; if (d.t > d.life) continue;
      d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
      const g = World.terrain ? World.terrain.h(d.p.x, d.p.z) : 0;
      if (d.p.y < g) { d.p.y = g; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y) * 0.3; }
      d.r.x += d.v.length() * dt * 3;
      Qn.setFromEuler(d.r); S.setScalar(d.s); M.compose(d.p, Qn, S); this.chunkMesh.setMatrixAt(n++, M);
    }
    this.debris = this.debris.filter(d => d.t <= d.life); this.chunkMesh.count = n; this.chunkMesh.instanceMatrix.needsUpdate = true;
  },
  tracer(o, dir, max, opts = {}) {
    const m = this.tracerPool.find(m => !m.visible && !this.tracers.some(t => t.m === m)); if (!m) return;
    m.position.copy(o); m.lookAt(o.x + dir.x, o.y + dir.y, o.z + dir.z);
    this.tracers.push({ m, o: o.clone(), dir: dir.clone(), d: opts.start || 0, max, len: opts.len || 4, speed: opts.speed || 420, w: opts.w || 1 });
  },
  decal(p, nrm, size = 0.12) {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), nrm), r = new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), Math.random() * TAU);
    q.multiply(r); M.compose(p.clone().addScaledVector(nrm, 0.012), q, V3(size, size, size));
    this.decals.setMatrixAt(this.decalI % 240, M); this.decalI++; this.decals.count = Math.min(240, this.decalI); this.decals.instanceMatrix.needsUpdate = true;
  },
  scorchMark(p, size) {
    const M = new THREE.Matrix4(), nrm = World.terrain ? World.terrain.normal(p.x, p.z) : V3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), nrm).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), Math.random() * TAU));
    M.compose(V3(p.x, (World.terrain ? World.terrain.h(p.x, p.z) : p.y) + 0.03, p.z), q, V3(size, size, size));
    this.scorch.setMatrixAt(this.scorchI % 40, M); this.scorchI++; this.scorch.count = Math.min(40, this.scorchI); this.scorch.instanceMatrix.needsUpdate = true;
  },
  muzzle(p, dir, scale = 1, light = true) {
    this.flash.emit({ x: p.x, y: p.y, z: p.z, life: 0.05, s0: 0.5 * scale, s1: 0.7 * scale, c0: [1, 0.85, 0.55, 1], c1: [1, 0.5, 0.2, 0], fin: 0 });
    this.flash.emit({ x: p.x + dir.x * 0.25 * scale, y: p.y + dir.y * 0.25 * scale, z: p.z + dir.z * 0.25 * scale, life: 0.04, s0: 0.35 * scale, s1: 0.5 * scale, c0: [1, 0.8, 0.45, 1], c1: [1, 0.4, 0.1, 0], fin: 0 });
    for (let i = 0; i < 3; i++) this.smoke.emit({ x: p.x, y: p.y, z: p.z, vx: dir.x * 2 + rand(-0.3, 0.3), vy: dir.y * 2 + rand(0, 0.4), vz: dir.z * 2 + rand(-0.3, 0.3), drag: 3, life: rand(0.5, 1.1), s0: 0.1 * scale, s1: 0.6 * scale, c0: [0.7, 0.68, 0.64, 0.22], c1: [0.7, 0.68, 0.64, 0] });
    if (light) flashLight(p, 0xffb060, 3.5 * scale, 0.06, 10);
  },
  impact(p, nrm, surf = 'stone', dir) {
    const tint = surf === 'sand' ? [0.72, 0.64, 0.5] : surf === 'dirt' || surf === 'grass' ? [0.42, 0.36, 0.28] : surf === 'snow' ? [0.9, 0.9, 0.92] : surf === 'wood' ? [0.5, 0.4, 0.3] : surf === 'water' ? [0.85, 0.9, 0.9] : [0.62, 0.6, 0.56];
    if (surf === 'water') { this.splash(p, 0.5); return; }
    if (surf === 'flesh') { for (let i = 0; i < 6; i++) this.dust.emit({ x: p.x, y: p.y, z: p.z, vx: (dir ? dir.x : 0) * 2 + rand(-1, 1), vy: rand(-0.5, 1), vz: (dir ? dir.z : 0) * 2 + rand(-1, 1), drag: 4, grav: 2, life: rand(0.25, 0.5), s0: 0.08, s1: 0.35, c0: [0.35, 0.03, 0.02, 0.8], c1: [0.25, 0.02, 0.02, 0] }); return; }
    for (let i = 0; i < 5; i++) {
      const s = rand(1, 3.5);
      this.dust.emit({ x: p.x, y: p.y, z: p.z, vx: nrm.x * s + rand(-0.6, 0.6), vy: nrm.y * s + rand(0, 1.2), vz: nrm.z * s + rand(-0.6, 0.6), drag: 2.5, grav: 0.6, life: rand(0.6, 1.4), s0: 0.1, s1: rand(0.5, 0.9), c0: [...tint, 0.55], c1: [...tint, 0] });
    }
    for (let i = 0; i < 6; i++) this.dust.emit({ x: p.x, y: p.y, z: p.z, vx: nrm.x * 4 + rand(-2, 2), vy: nrm.y * 4 + rand(1, 4), vz: nrm.z * 4 + rand(-2, 2), grav: 12, life: rand(0.3, 0.6), s0: 0.03, s1: 0.03, c0: [tint[0] * 0.5, tint[1] * 0.5, tint[2] * 0.5, 1], fin: 0 });
    if (surf === 'metal' || surf === 'stone' && Math.random() < 0.3) for (let i = 0; i < 6; i++) this.spark.emit({ x: p.x, y: p.y, z: p.z, vx: nrm.x * 5 + rand(-3, 3), vy: nrm.y * 5 + rand(0, 3), vz: nrm.z * 5 + rand(-3, 3), grav: 9, drag: 1, life: rand(0.1, 0.3), s0: 0.05, s1: 0.02, c0: [1, 0.8, 0.4, 1], c1: [1, 0.4, 0.1, 0], fin: 0 });
    if (surf !== 'grass' && surf !== 'sand' && surf !== 'snow') this.decal(p, nrm, surf === 'metal' ? 0.07 : 0.1);
  },
  splash(p, s = 1) {
    for (let i = 0; i < 10 * s + 4; i++) this.dust.emit({ x: p.x + rand(-0.2, 0.2) * s, y: p.y, z: p.z + rand(-0.2, 0.2) * s, vx: rand(-1, 1) * s, vy: rand(2, 5) * Math.sqrt(s) * (s > 2 ? 3 : 1), vz: rand(-1, 1) * s, grav: 9.8, drag: 0.8, life: rand(0.6, 1.4) * Math.sqrt(s), s0: 0.2 * s, s1: 0.9 * s, c0: [0.9, 0.93, 0.93, 0.7], c1: [0.8, 0.85, 0.86, 0] });
  },
  geyser(p, s = 1) { // shell into water
    for (let i = 0; i < 40; i++) this.dust.emit({ x: p.x + rand(-1, 1), y: p.y, z: p.z + rand(-1, 1), vx: rand(-2, 2), vy: rand(8, 22) * s, vz: rand(-2, 2), grav: 9.8, drag: 0.5, life: rand(1.5, 3), s0: 1 * s, s1: 4 * s, c0: [0.85, 0.88, 0.88, 0.75], c1: [0.8, 0.84, 0.84, 0] });
    SFX.splash(p, true);
  },
  explosion(p, size = 1, opts = {}) {
    const inWater = World.water != null && p.y < World.water + 0.3;
    if (inWater) { this.geyser(V3(p.x, World.water, p.z), size); flashLight(p, 0xff9040, 8 * size, 0.2, 25); return; }
    for (let i = 0; i < 14 * size; i++) this.fire.emit({ x: p.x + rand(-0.5, 0.5) * size, y: p.y + rand(0, 0.8) * size, z: p.z + rand(-0.5, 0.5) * size, vx: rand(-4, 4) * size, vy: rand(2, 8) * size, vz: rand(-4, 4) * size, drag: 4, life: rand(0.25, 0.6), s0: 1.2 * size, s1: 3.2 * size, c0: [1, 0.72, 0.35, 1], c1: [0.8, 0.25, 0.05, 0], fin: 0 });
    for (let i = 0; i < 24 * size; i++) this.smoke.emit({ x: p.x + rand(-1, 1) * size, y: p.y + rand(0, 1.5) * size, z: p.z + rand(-1, 1) * size, vx: rand(-3, 3) * size, vy: rand(1, 6) * size, vz: rand(-3, 3) * size, drag: 1.6, grav: -0.3, life: rand(3, 7), s0: 1.5 * size, s1: rand(5, 9) * size, c0: [0.18, 0.17, 0.16, 0.85], c1: [0.4, 0.39, 0.37, 0], rot: rand(-0.3, 0.3), fin: 0.03 });
    const t = this.dustTint;
    for (let i = 0; i < 30 * size; i++) this.dust.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: rand(-7, 7) * size, vy: rand(4, 14) * size, vz: rand(-7, 7) * size, grav: 9.8, drag: 0.6, life: rand(0.8, 2), s0: 0.3, s1: 1.4 * size, c0: [t[0] * 0.6, t[1] * 0.6, t[2] * 0.6, 0.9], c1: [t[0], t[1], t[2], 0] });
    for (let i = 0; i < 16 * size; i++) this.spark.emit({ x: p.x, y: p.y + 0.3, z: p.z, vx: rand(-12, 12), vy: rand(4, 16), vz: rand(-12, 12), grav: 9.8, life: rand(0.4, 1.2), s0: 0.08, s1: 0.04, c0: [1, 0.75, 0.3, 1], c1: [1, 0.3, 0.05, 0], fin: 0 });
    for (let i = 0; i < 10 * size && this.debris.length < 150; i++) this.debris.push({ p: p.clone().add(V3(0, 0.3, 0)), v: V3(rand(-6, 6), rand(5, 12), rand(-6, 6)).multiplyScalar(size), r: new THREE.Euler(rand(0, 6), rand(0, 6), 0), s: rand(0.6, 2.2), t: 0, life: rand(4, 8) });
    flashLight(V3(p.x, p.y + 1, p.z), 0xff9a50, 14 * size, 0.35, 30 * size);
    if (!opts.noScorch) this.scorchMark(p, 3 * size);
  },
  addEmitter(e) { this.emitters.push(e); return e; },
  smokeColumn(p, o = {}) {
    const s = o.size || 1, dark = o.dark == null ? 0.16 : o.dark;
    return this.addEmitter({
      rate: o.rate || 6, fn: () => this.smoke.emit({ x: p.x + rand(-1, 1) * s, y: p.y + rand(0, 1), z: p.z + rand(-1, 1) * s, vx: (o.wind || 1.2) + rand(-0.5, 0.5), vy: rand(2.5, 4.5) * s, vz: rand(-0.4, 0.4) + (o.windZ || 0), drag: 0.08, grav: -0.1, life: rand(10, 16) * (o.lifeMul || 1), s0: 3 * s, s1: rand(16, 26) * s, c0: [dark, dark * 0.96, dark * 0.92, 0.9], c1: [dark * 2.2, dark * 2.15, dark * 2.1, 0], rot: rand(-0.1, 0.1), fin: 0.05 })
    });
  },
  fireEmitter(p, o = {}) {
    const s = o.size || 1;
    return this.addEmitter({
      rate: (o.rate || 18) * s, fn: () => {
        this.fire.emit({ x: p.x + rand(-0.6, 0.6) * s, y: p.y + rand(0, 0.3), z: p.z + rand(-0.6, 0.6) * s, vx: rand(-0.3, 0.3), vy: rand(1.5, 3) * s, vz: rand(-0.3, 0.3), drag: 1, life: rand(0.4, 0.9), s0: 0.9 * s, s1: 0.2 * s, c0: [1, 0.62, 0.25, 0.9], c1: [0.9, 0.2, 0.05, 0], rot: rand(-2, 2), fin: 0.1 });
        if (Math.random() < 0.25) this.smoke.emit({ x: p.x + rand(-0.5, 0.5) * s, y: p.y + 1.2 * s, z: p.z + rand(-0.5, 0.5) * s, vx: 0.5, vy: rand(1.5, 2.5), vz: 0, drag: 0.2, life: rand(3, 6), s0: 1 * s, s1: 5 * s, c0: [0.12, 0.11, 0.1, 0.7], c1: [0.3, 0.3, 0.3, 0] });
        if (Math.random() < 0.08) this.spark.emit({ x: p.x + rand(-0.5, 0.5) * s, y: p.y + 0.5, z: p.z + rand(-0.5, 0.5) * s, vx: rand(-0.5, 0.5), vy: rand(2, 4), vz: rand(-0.5, 0.5), grav: -0.5, life: rand(1, 2), s0: 0.05, s1: 0.03, c0: [1, 0.7, 0.3, 1], c1: [1, 0.3, 0.1, 0] });
      }
    });
  },
  snow(center) {
    return this.addEmitter({
      rate: 90, fn: (e) => {
        const c = e.center || center, a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 22;
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (e.mask && !e.mask(x, z)) return;
        this.dust.emit({ x, y: c.y + rand(6, 10), z, vx: rand(0.2, 0.7), vy: rand(-1.2, -0.7), vz: rand(-0.2, 0.2), life: 9, s0: 0.035, s1: 0.035, c0: [0.95, 0.96, 1, 0.9], rot: 1, fin: 0.1 });
      }
    });
  },
  motes(center, tint = [0.8, 0.75, 0.6]) {
    return this.addEmitter({ rate: 8, fn: (e) => { const c = e.center || center; this.dust.emit({ x: c.x + rand(-8, 8), y: c.y + rand(0, 3), z: c.z + rand(-8, 8), vx: rand(-0.1, 0.1), vy: rand(-0.02, 0.05), vz: rand(-0.1, 0.1), life: 6, s0: 0.02, s1: 0.02, c0: [...tint, 0.5] }); } });
  },
};

/* =====================================================================
   Static geometry batcher — merges by material, world-projected UVs
   ===================================================================== */
class Batcher {
  constructor() { this.groups = new Map(); }
  add(geom, matrix, mat, o = {}) {
    const key = mat.uuid + '|' + (o.cast !== false) + '|' + (o.receive !== false);
    let g = this.groups.get(key);
    if (!g) { g = { mat, cast: o.cast !== false, receive: o.receive !== false, items: [] }; this.groups.set(key, g); }
    g.items.push({ geom, matrix: matrix.clone(), worldUV: o.worldUV !== false && mat.userData.uvs, color: o.color, uvScale: o.uvScale });
  }
  build(scene) {
    const meshes = [];
    for (const g of this.groups.values()) {
      let total = 0;
      const prepared = g.items.map(it => { const geo = it.geom.index ? it.geom.toNonIndexed() : it.geom; total += geo.attributes.position.count; return { it, geo }; });
      const P = new Float32Array(total * 3), N = new Float32Array(total * 3), U = new Float32Array(total * 2), C = g.mat.vertexColors ? new Float32Array(total * 3) : null;
      let off = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      for (const { it, geo } of prepared) {
        const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ca = geo.attributes.color;
        nm.getNormalMatrix(it.matrix); const s = it.worldUV || 1;
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(it.matrix); const j = (off + i) * 3;
          P[j] = v.x; P[j + 1] = v.y; P[j + 2] = v.z;
          const px = v.x, py = v.y, pz = v.z;
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[j] = v.x; N[j + 1] = v.y; N[j + 2] = v.z; }
          const k = (off + i) * 2;
          if (it.worldUV) {
            const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
            if (ay >= ax && ay >= az) { U[k] = px / s; U[k + 1] = pz / s; }
            else if (ax >= az) { U[k] = pz / s; U[k + 1] = py / s; }
            else { U[k] = px / s; U[k + 1] = py / s; }
          } else if (ua) { const us = it.uvScale || 1; U[k] = ua.getX(i) * us; U[k + 1] = ua.getY(i) * us; }
          if (C) { if (ca) { C[j] = ca.getX(i); C[j + 1] = ca.getY(i); C[j + 2] = ca.getZ(i); } else { const cc = it.color || [1, 1, 1]; C[j] = cc[0]; C[j + 1] = cc[1]; C[j + 2] = cc[2]; } }
        }
        off += pa.count;
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(N, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      if (C) bg.setAttribute('color', new THREE.BufferAttribute(C, 3));
      bg.computeBoundingSphere();
      const m = new THREE.Mesh(bg, g.mat); m.castShadow = g.cast; m.receiveShadow = g.receive; m.matrixAutoUpdate = false;
      if (g.mat.alphaTest > 0 && g.mat.map) m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: g.mat.map, alphaTest: g.mat.alphaTest });
      scene.add(m); meshes.push(m);
    }
    this.groups.clear();
    return meshes;
  }
}

/* =====================================================================
   World: colliders (AABBs in a spatial hash), terrain, raycasts
   ===================================================================== */
const World = { cols: [], grid: new Map(), cs: 8, terrain: null, water: null, stamp: 0, surfaceAt: null, bounds: null };
function resetWorld() { World.cols = []; World.grid = new Map(); World.terrain = null; World.water = null; World.surfaceAt = null; World.bounds = null; }
function gkey(cx, cz) { return (cx + 4096) * 8192 + (cz + 4096); }
function addCol(minx, miny, minz, maxx, maxy, maxz, o = {}) {
  const c = { min: [Math.min(minx, maxx), Math.min(miny, maxy), Math.min(minz, maxz)], max: [Math.max(minx, maxx), Math.max(miny, maxy), Math.max(minz, maxz)], surf: o.surf || 'stone', noBullet: !!o.noBullet, noPlayer: !!o.noPlayer, active: true, tag: o.tag, s: 0 };
  World.cols.push(c);
  const cs = World.cs;
  for (let x = Math.floor(c.min[0] / cs); x <= Math.floor(c.max[0] / cs); x++) for (let z = Math.floor(c.min[2] / cs); z <= Math.floor(c.max[2] / cs); z++) {
    const k = gkey(x, z); let a = World.grid.get(k); if (!a) { a = []; World.grid.set(k, a); } a.push(c);
  }
  return c;
}
function queryCols(minx, minz, maxx, maxz) {
  const cs = World.cs, out = []; const st = ++World.stamp;
  for (let x = Math.floor(minx / cs); x <= Math.floor(maxx / cs); x++) for (let z = Math.floor(minz / cs); z <= Math.floor(maxz / cs); z++) {
    const a = World.grid.get(gkey(x, z)); if (!a) continue;
    for (const c of a) if (c.s !== st) { c.s = st; if (c.active) out.push(c); }
  }
  return out;
}
function collideCircle(p, r, y0, y1, isPlayer = true) {
  const list = queryCols(p.x - r - 0.2, p.z - r - 0.2, p.x + r + 0.2, p.z + r + 0.2);
  let hit = false;
  for (let it = 0; it < 2; it++) for (const c of list) {
    if (isPlayer && c.noPlayer) continue;
    if (c.max[1] <= y0 || c.min[1] >= y1) continue;
    const cx = clamp(p.x, c.min[0], c.max[0]), cz = clamp(p.z, c.min[2], c.max[2]);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
      else {
        const pen = [p.x - c.min[0] + r, c.max[0] - p.x + r, p.z - c.min[2] + r, c.max[2] - p.z + r];
        let mi = 0; for (let i = 1; i < 4; i++) if (pen[i] < pen[mi]) mi = i;
        if (mi === 0) p.x = c.min[0] - r; else if (mi === 1) p.x = c.max[0] + r; else if (mi === 2) p.z = c.min[2] - r; else p.z = c.max[2] + r;
      }
    }
  }
  return hit;
}
function terrainH(x, z) { return World.terrain ? World.terrain.h(x, z) : 0; }
function groundAt(x, z, fromY, r = 0.18) {
  let g = terrainH(x, z), surf = null;
  const list = queryCols(x - r, z - r, x + r, z + r);
  for (const c of list) {
    if (c.noPlayer) continue;
    if (x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2]) {
      if (c.max[1] <= fromY + 0.5 && c.max[1] > g) { g = c.max[1]; surf = c.surf; }
    }
  }
  World._lastSurf = surf;
  return g;
}
function ceilingAt(x, z, fromY, r = 0.2) {
  let cMin = Infinity;
  for (const c of queryCols(x - r, z - r, x + r, z + r)) {
    if (c.noPlayer) continue;
    if (x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2] && c.min[1] >= fromY + 0.3) cMin = Math.min(cMin, c.min[1]);
  }
  return cMin;
}
const _rn = new THREE.Vector3();
function rayBox(o, d, c, maxT) {
  let tmin = 0, tmax = maxT, axis = -1, sign = 0;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    if (Math.abs(da) < 1e-9) { if (oa < c.min[a] || oa > c.max[a]) return -1; continue; }
    let t1 = (c.min[a] - oa) / da, t2 = (c.max[a] - oa) / da, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (axis < 0) return -1; // origin inside
  _rn.set(0, 0, 0); if (axis === 0) _rn.x = sign; else if (axis === 1) _rn.y = sign; else _rn.z = sign;
  return tmin;
}
function raycast(o, d, maxT, opts = {}) {
  let best = maxT, hit = null, surf = null; const nrm = new THREE.Vector3();
  const ex = o.x + d.x * maxT, ez = o.z + d.z * maxT;
  const list = maxT < 90 ? queryCols(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez)) : World.cols;
  for (const c of list) {
    if (!c.active || (opts.bullet && c.noBullet) || (opts.ignore && opts.ignore === c)) continue;
    const t = rayBox(o, d, c, best);
    if (t >= 0 && t < best) { best = t; hit = c; surf = c.surf; nrm.copy(_rn); }
  }
  if (World.terrain) {
    const T = World.terrain; let t = 0.05, prevT = 0;
    while (t < best) {
      const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t, h = T.h(px, pz);
      if (py < h) {
        let a = prevT, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (o.y + d.y * m < T.h(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        if (b < best) { best = b; hit = 'terrain'; const q = o.clone().addScaledVector(d, b); nrm.copy(T.normal(q.x, q.z)); surf = World.surfaceAt ? World.surfaceAt(q.x, q.z) : 'dirt'; }
        break;
      }
      prevT = t; t += clamp((py - h) * 0.5, 0.25, 6);
      if (py > T.maxH + 1 && d.y >= 0) break;
    }
  }
  if (World.water != null && d.y < 0 && !opts.noWater) {
    const t = (World.water - o.y) / d.y;
    if (t > 0 && t < best) { best = t; hit = 'water'; surf = 'water'; nrm.set(0, 1, 0); }
  }
  return { t: best, hit, surf, normal: nrm, point: o.clone().addScaledVector(d, best) };
}
function lineOfSight(a, b, ignoreCol) {
  const d = b.clone().sub(a), len = d.length(); if (len < 0.01) return true; d.divideScalar(len);
  const r = raycast(a, d, len, { bullet: true, noWater: true, ignore: ignoreCol });
  return !r.hit;
}

/* ---------------- heightfield terrain ---------------- */
class Terrain {
  constructor(o) {
    this.x0 = o.x0; this.z0 = o.z0; this.w = o.w; this.d = o.d; this.res = o.res;
    const nx = this.nx = Math.round(o.w / o.res) + 1, nz = this.nz = Math.round(o.d / o.res) + 1;
    const H = this.H = new Float32Array(nx * nz); let maxH = -1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const h = o.h(o.x0 + i * o.res, o.z0 + j * o.res); H[j * nx + i] = h; if (h > maxH) maxH = h; }
    this.maxH = maxH;
    const P = new Float32Array(nx * nz * 3), N = new Float32Array(nx * nz * 3), U = new Float32Array(nx * nz * 2), C = new Float32Array(nx * nz * 3);
    const s = MAT.ground.userData.uvs || 3;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = o.x0 + i * o.res, z = o.z0 + j * o.res, h = H[k];
      P[k * 3] = x; P[k * 3 + 1] = h; P[k * 3 + 2] = z;
      const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)], hu = H[Math.max(0, j - 1) * nx + i], hd = H[Math.min(nz - 1, j + 1) * nx + i];
      const n = V3(hl - hr, 2 * o.res, hu - hd).normalize(); N[k * 3] = n.x; N[k * 3 + 1] = n.y; N[k * 3 + 2] = n.z;
      U[k * 2] = x / s; U[k * 2 + 1] = z / s;
      const c = o.color(x, z, h, n);
      C[k * 3] = lin(c[0]); C[k * 3 + 1] = lin(c[1]); C[k * 3 + 2] = lin(c[2]);
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let t = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    this.mesh = new THREE.Mesh(g, MAT.ground); this.mesh.receiveShadow = true; this.mesh.castShadow = !!o.cast;
  }
  h(x, z) {
    let fx = (x - this.x0) / this.res, fz = (z - this.z0) / this.res;
    fx = clamp(fx, 0, this.nx - 1.001); fz = clamp(fz, 0, this.nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, nx = this.nx, H = this.H;
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    // match triangle split used by the mesh
    if (u + v < 1) return a + (b - a) * u + (c - a) * v;
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  normal(x, z) { const e = this.res; return V3(this.h(x - e, z) - this.h(x + e, z), 2 * e, this.h(x, z - e) - this.h(x, z + e)).normalize(); }
}
