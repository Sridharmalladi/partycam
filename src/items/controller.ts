import * as THREE from "three";
import type { Stage } from "../render/stage";
import type { Particles } from "../render/particles";
import type { FrameSignals } from "../tracking/signals";
import { TriggerDetector, type TriggerResult } from "../gestures/triggers";
import type { Sfx } from "../audio/sfx";
import type { ItemContext, ItemDef, ItemInstance } from "./types";

const MOUTH_ENTER = 0.25; // x face width
const MOUTH_LEAVE = 0.35;

export class ItemController {
  private active: ItemInstance | null = null;
  private detector: TriggerDetector | null = null;
  private heldKey: string | null = null;
  private lastHint = "";
  private stage: Stage;
  private fx: { soft: Particles; glow: Particles };
  private sfx: Sfx;
  private hintEl: HTMLElement;

  constructor(stage: Stage, fx: { soft: Particles; glow: Particles }, sfx: Sfx, hintEl: HTMLElement) {
    this.stage = stage;
    this.fx = fx;
    this.sfx = sfx;
    this.hintEl = hintEl;
  }

  select(def: ItemDef) {
    this.clear();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: def.textures[0], transparent: true, depthTest: false, depthWrite: false }),
    );
    mesh.renderOrder = 1;
    this.stage.scene.add(mesh);

    const [x, y] = this.spawnPoint(def);
    this.active = {
      def,
      mesh,
      state: def.anchor === "screen" ? "READY" : "IDLE",
      x,
      y,
      usesLeft: def.uses,
      stage: 0,
      data: {},
      respawnAt: 0,
    };
    this.detector = new TriggerDetector(def.trigger);
    this.heldKey = null;
    def.init?.(this.buildCtx(this.active, { t: 0, face: null, hands: [] }, { fired: false, level: 0 }, 0, 0, 0, 0));
  }

  update(sig: FrameSignals, now: number, dt: number) {
    const it = this.active;
    const detector = this.detector;
    if (!it || !detector) return;
    const def = it.def;
    const face = sig.face;

    const faceW = face?.faceWidth ?? Math.min(this.stage.width, this.stage.height) * 0.35;
    const size = faceW * def.widthInFaces;
    const height = size; // square canvas textures
    it.mesh.scale.set(size, height, 1);

    let targetX = it.x;
    let targetY = it.y;
    let trigger: TriggerResult = { fired: false, level: 0 };
    const hand = this.heldKey ? sig.hands.find((h) => h.key === this.heldKey) : undefined;

    switch (it.state) {
      case "IDLE": {
        const [sx, sy] = this.spawnPoint(def);
        targetX = sx;
        targetY = sy + Math.sin(now * 2) * 6;
        const grabber = sig.hands.find(
          (h) => h.pinchStarted && Math.hypot(h.pinchX - it.x, h.pinchY - it.y) < size * 0.8,
        );
        if (grabber) {
          this.heldKey = grabber.key;
          it.state = "HELD";
          this.sfx.pop();
        }
        this.hint(def.hints.idle);
        break;
      }

      case "HELD":
      case "AT_MOUTH": {
        if (!hand || !hand.pinching) {
          this.heldKey = null;
          it.state = "IDLE";
          detector.reset();
          break;
        }
        targetX = hand.pinchX - def.gripPoint[0] * size;
        targetY = hand.pinchY - def.gripPoint[1] * height;

        const mx = it.x + def.mouthPoint[0] * size;
        const my = it.y + def.mouthPoint[1] * height;
        const radius = faceW * (it.state === "AT_MOUTH" ? MOUTH_LEAVE : MOUTH_ENTER);
        const near = !!face && Math.hypot(mx - face.mouthX, my - face.mouthY) < radius;

        it.state = near ? "AT_MOUTH" : "HELD";
        if (near && face) trigger = detector.update(face, now);
        this.hint(near ? def.hints.ready : (def.hints.held ?? def.hints.idle));
        break;
      }

      case "READY": {
        const [sx, sy] = this.spawnPoint(def);
        targetX = sx;
        targetY = sy;
        if (face) trigger = detector.update(face, now);
        this.hint(face ? def.hints.ready : "Look at the camera 👀");
        break;
      }

      case "FINISHED": {
        if (now >= it.respawnAt) this.reset(it);
        break;
      }
    }

    const speed = it.state === "HELD" || it.state === "AT_MOUTH" ? 22 : 8;
    const k = 1 - Math.exp(-dt * speed);
    it.x += (targetX - it.x) * k;
    it.y += (targetY - it.y) * k;
    it.mesh.position.set(it.x, it.y, 0);

    if (it.state === "FINISHED") return;

    const ctx = this.buildCtx(it, sig, trigger, size, height, now, dt);
    def.onUpdate?.(ctx);

    if (trigger.fired) {
      def.onUse?.(ctx);
      if (def.uses > 0 && --it.usesLeft <= 0) this.finish(it, now);
    }
  }

  private buildCtx(
    it: ItemInstance,
    sig: FrameSignals,
    trigger: TriggerResult,
    size: number,
    height: number,
    now: number,
    dt: number,
  ): ItemContext {
    return {
      item: it,
      signals: sig,
      face: sig.face,
      trigger,
      fx: this.fx,
      sfx: this.sfx,
      size,
      height,
      now,
      dt,
      setStage: (n) => this.setStage(it, n),
      setTexture: (tex) => {
        it.mesh.material.map = tex;
        it.mesh.material.needsUpdate = true;
      },
      hint: (text) => this.hint(text),
      finish: (opts) => this.finish(it, now, opts),
    };
  }

  private finish(it: ItemInstance, now: number, opts: { respawnAfter?: number } = {}) {
    if (it.state === "FINISHED") return;
    it.state = "FINISHED";
    it.respawnAt = now + (opts.respawnAfter ?? 1.5);
    it.mesh.visible = false;
    this.heldKey = null;
    this.sfx.chime();
    this.hint("🎉");
  }

  private reset(it: ItemInstance) {
    it.state = it.def.anchor === "screen" ? "READY" : "IDLE";
    it.usesLeft = it.def.uses;
    it.data = {};
    it.mesh.visible = true;
    const [x, y] = this.spawnPoint(it.def);
    it.x = x;
    it.y = y;
    this.setStage(it, 0);
    this.detector?.reset();
    it.def.init?.(this.buildCtx(it, { t: 0, face: null, hands: [] }, { fired: false, level: 0 }, 0, 0, 0, 0));
  }

  private setStage(it: ItemInstance, n: number) {
    it.stage = Math.max(0, Math.min(n, it.def.textures.length - 1));
    it.mesh.material.map = it.def.textures[it.stage];
    it.mesh.material.needsUpdate = true;
  }

  private spawnPoint(def: ItemDef): [number, number] {
    const { width: w, height: h } = this.stage;
    if (def.anchor === "screen" && def.screenAnchor) {
      const [ax, ay] = def.screenAnchor;
      return [(ax - 0.5) * w, (0.5 - ay) * h];
    }
    return [w * 0.25, -h * 0.12];
  }

  /** Removes whatever item is currently active. Safe to call when nothing is selected. */
  clear() {
    const it = this.active;
    if (!it) return;
    this.stage.scene.remove(it.mesh);
    it.mesh.geometry.dispose();
    it.mesh.material.dispose();
    this.active = null;
  }

  private hint(text: string) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hintEl.textContent = text;
  }
}
