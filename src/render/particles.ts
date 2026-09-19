import * as THREE from "three";

export interface EmitOptions {
  x: number;
  y: number;
  count: number;
  dirX?: number;
  dirY?: number;
  spread?: number;
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  color?: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  gravity?: number;
  drag?: number;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const rand = ([a, b]: [number, number]) => a + Math.random() * (b - a);

export class Particles {
  readonly points: THREE.Points;

  private max: number;
  private alive = 0;
  private geo = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;

  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private startAlpha: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;

  constructor(max: number, additive = false) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 2);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.startAlpha = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);

    const attr = (arr: Float32Array, n: number) =>
      new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", attr(this.pos, 3));
    this.geo.setAttribute("aColor", attr(this.col, 3));
    this.geo.setAttribute("aSize", attr(this.size, 1));
    this.geo.setAttribute("aAlpha", attr(this.alpha, 1));
    this.geo.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  emit(o: EmitOptions) {
    const n = Math.max(1, Math.round(o.count));
    const colors = (Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff]).map((c) => new THREE.Color(c));
    const base = Math.atan2(o.dirY ?? 1, o.dirX ?? 0);
    const spread = o.spread ?? Math.PI * 2;

    for (let k = 0; k < n && this.alive < this.max; k++) {
      const i = this.alive++;
      const angle = base + (Math.random() - 0.5) * spread;
      const speed = rand(o.speed ?? [40, 120]);
      const c = colors[(Math.random() * colors.length) | 0];

      this.pos[i * 3] = o.x;
      this.pos[i * 3 + 1] = o.y;
      this.pos[i * 3 + 2] = 0;
      this.vel[i * 2] = Math.cos(angle) * speed;
      this.vel[i * 2 + 1] = Math.sin(angle) * speed;
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      this.size[i] = rand(o.size ?? [6, 14]);
      this.life[i] = this.maxLife[i] = rand(o.life ?? [0.6, 1.2]);
      this.startAlpha[i] = this.alpha[i] = 1;
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
    }
  }

  update(dt: number) {
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.copy(this.alive - 1, i);
        this.alive--;
        continue;
      }

      const vx = i * 2;
      const vy = vx + 1;
      this.vel[vy] -= this.gravity[i] * dt;
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[vx] *= damp;
      this.vel[vy] *= damp;

      this.pos[i * 3] += this.vel[vx] * dt;
      this.pos[i * 3 + 1] += this.vel[vy] * dt;

      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.startAlpha[i] * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 10 + 0.2);
      i++;
    }

    this.geo.setDrawRange(0, this.alive);
    for (const name of ["position", "aColor", "aSize", "aAlpha"]) {
      (this.geo.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private copy(from: number, to: number) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.vel[to * 2] = this.vel[from * 2];
    this.vel[to * 2 + 1] = this.vel[from * 2 + 1];
    this.size[to] = this.size[from];
    this.alpha[to] = this.alpha[from];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.startAlpha[to] = this.startAlpha[from];
    this.gravity[to] = this.gravity[from];
    this.drag[to] = this.drag[from];
  }
}
