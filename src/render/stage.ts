import * as THREE from "three";

/** Orthographic canvas: 1 world unit = 1 CSS pixel, origin at screen center, +y up. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  readonly video: HTMLVideoElement;
  width = 0;
  height = 0;

  private videoMesh: THREE.Mesh;
  private cover = { dw: 1, dh: 1, ox: 0, oy: 0 };

  constructor(canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    this.video = video;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.z = 10;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.videoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, depthWrite: false, depthTest: false }),
    );
    this.videoMesh.renderOrder = -1;
    this.scene.add(this.videoMesh);

    this.resize();
    window.addEventListener("resize", () => this.resize());
    video.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);

    const c = this.camera;
    c.left = -this.width / 2;
    c.right = this.width / 2;
    c.top = this.height / 2;
    c.bottom = -this.height / 2;
    c.updateProjectionMatrix();

    const vw = this.video.videoWidth || 960;
    const vh = this.video.videoHeight || 720;
    const s = Math.max(this.width / vw, this.height / vh);
    const dw = vw * s;
    const dh = vh * s;
    this.cover = { dw, dh, ox: (this.width - dw) / 2, oy: (this.height - dh) / 2 };
    this.videoMesh.scale.set(-dw, dh, 1); // negative x = mirrored selfie view
  }

  /** MediaPipe normalized coords (0..1, unmirrored) -> world coords matching the mirrored video. */
  mapPoint(nx: number, ny: number): [number, number] {
    const { dw, dh, ox, oy } = this.cover;
    const px = ox + (1 - nx) * dw;
    const py = oy + ny * dh;
    return [px - this.width / 2, this.height / 2 - py];
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
