import * as THREE from "three";
import type { Stage } from "../render/stage";
import type { Particles } from "../render/particles";
import type { FrameSignals } from "../tracking/signals";
import type { Sfx } from "../audio/sfx";
import { Gate } from "../gestures/gate";
import { FlickDetector } from "../gestures/flick";
import {
  CIGARETTE_STAGES,
  generateCigaretteTexture,
  generateLighterTexture,
  generateFlameTexture,
  generateEmberGlowTexture,
} from "./smokeTextures";

type CigState = "IDLE" | "HELD" | "IN_MOUTH" | "FINISHED";
type LighterState = "IDLE" | "HELD";

const MOUTH_ENTER = 0.3;
const MOUTH_LEAVE = 0.42;
const GRAB_RADIUS = 1.1; // x item length, generous since props are now slim
const FLAME_REACH = 0.4; // x face width, how close the flame must get to the ember
const FLAME_HOLD_S = 2.2; // how long a single flick keeps the flame alive
const SMOKE_COLORS = ["#e9e7e2", "#d7d4cc", "#c9c6bd"];

// Real props are held by one point, touch the mouth at another, and (for the cigarette) burn
// at a third. All three are expressed as fractions of the sprite's length, in local space
// (+y = the "up"/ember end of the source pixel art, since that's what's drawn at row 0).
const CIG_LENGTH_RATIO = 0.5; // cigarette length as a fraction of face width
const CIG_GRIP_LOCAL = -0.16; // where fingers pinch, just past center toward the filter
const CIG_MOUTH_LOCAL = -0.46; // filter end, touches the lips
const CIG_EMBER_LOCAL = 0.46; // lit end

const LIGHTER_LENGTH_RATIO = 0.34;
const LIGHTER_GRIP_LOCAL = -0.12; // held lower on the body
const LIGHTER_NOZZLE_LOCAL = 0.46; // flame emerges just above the cap

const angleLerp = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/** World-space offset of a local point (0, localLen) once the sprite is rotated by `angle`. */
const rotatedOffset = (localLen: number, angle: number): [number, number] => [
  -localLen * Math.sin(angle),
  localLen * Math.cos(angle),
];

/** Sprite [width, height] that makes its long axis equal `length`, preserving texture aspect. */
const sizeFromLength = (length: number, img: { width: number; height: number }): [number, number] => {
  const aspect = img.height / img.width;
  return [length / aspect, length];
};

export class CigaretteExperience {
  private stage: Stage;
  private fx: { soft: Particles; glow: Particles; smoke: Particles };
  private sfx: Sfx;
  private hintEl: HTMLElement;

  private cigMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private lighterMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private flameMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private emberMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private active = false;
  private lastHint = "";

  private cigState: CigState = "IDLE";
  private cigHeldBy: string | null = null;
  private cigX = 0;
  private cigY = 0;
  private cigAngle = 0;
  private cigLength = 40;
  private cigLit = false;
  private cigBurn = 0;
  private cigRespawnAt = 0;

  private lighterState: LighterState = "IDLE";
  private lighterHeldBy: string | null = null;
  private lighterX = 0;
  private lighterY = 0;
  private lighterAngle = 0;
  private lighterLength = 40;
  private flicker = new FlickDetector();
  private flameUntil = 0;

  private puffGate = new Gate(0.4, 0.25);
  private emberPulse = 0;

  constructor(stage: Stage, fx: { soft: Particles; glow: Particles; smoke: Particles }, sfx: Sfx, hintEl: HTMLElement) {
    this.stage = stage;
    this.fx = fx;
    this.sfx = sfx;
    this.hintEl = hintEl;

    const cigTex = generateCigaretteTexture(false, 0);
    this.cigMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: cigTex, transparent: true, depthTest: false, depthWrite: false }),
    );
    this.cigMesh.renderOrder = 1;
    this.cigMesh.visible = false;

    this.lighterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: generateLighterTexture(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.lighterMesh.renderOrder = 1;
    this.lighterMesh.visible = false;

    this.flameMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: generateFlameTexture(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.flameMesh.renderOrder = 3;
    this.flameMesh.visible = false;

    this.emberMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: generateEmberGlowTexture(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.emberMesh.renderOrder = 3;
    this.emberMesh.visible = false;

    stage.scene.add(this.cigMesh, this.lighterMesh, this.flameMesh, this.emberMesh);
  }

  activate() {
    this.active = true;
    this.cigState = "IDLE";
    this.cigHeldBy = null;
    this.cigLit = false;
    this.cigBurn = 0;
    this.lighterState = "IDLE";
    this.lighterHeldBy = null;
    this.flameUntil = 0;
    this.flicker.reset();
    this.puffGate.on = false;
    [this.cigX, this.cigY] = this.cigSpawn();
    [this.lighterX, this.lighterY] = this.lighterSpawn();
    this.cigAngle = 0;
    this.lighterAngle = 0;
    this.cigMesh.material.map = generateCigaretteTexture(false, 0);
    this.cigMesh.material.needsUpdate = true;
    this.cigMesh.visible = true;
    this.lighterMesh.visible = true;
  }

  deactivate() {
    this.active = false;
    this.cigMesh.visible = false;
    this.lighterMesh.visible = false;
    this.flameMesh.visible = false;
    this.emberMesh.visible = false;
  }

  update(sig: FrameSignals, now: number, dt: number) {
    if (!this.active) return;
    const faceW = sig.face?.faceWidth ?? Math.min(this.stage.width, this.stage.height) * 0.35;

    this.updateLighter(sig, now, dt, faceW);
    this.updateCigarette(sig, now, dt, faceW);
    this.updateIgnitionAndPuff(sig, now, faceW);
    this.hint(this.computeHint());
  }

  // ---- Lighter ----

  private updateLighter(sig: FrameSignals, now: number, dt: number, faceW: number) {
    const length = faceW * LIGHTER_LENGTH_RATIO;
    this.lighterLength = length;
    const img = this.lighterMesh.material.map!.image as { width: number; height: number };
    const [w, h] = sizeFromLength(length, img);
    this.lighterMesh.scale.set(w, h, 1);

    let targetX = this.lighterX;
    let targetY = this.lighterY;
    let targetAngle = this.lighterAngle;

    const hand = this.lighterHeldBy ? sig.hands.find((h) => h.key === this.lighterHeldBy) : undefined;

    if (this.lighterState === "IDLE") {
      const [sx, sy] = this.lighterSpawn();
      targetX = sx;
      targetY = sy + Math.sin(now * 1.7 + 1) * 5;
      targetAngle = 0;
      const grabber = sig.hands.find(
        (h) =>
          h.key !== this.cigHeldBy &&
          h.pinchStarted &&
          Math.hypot(h.pinchX - this.lighterX, h.pinchY - this.lighterY) < length * GRAB_RADIUS,
      );
      if (grabber) {
        this.lighterHeldBy = grabber.key;
        this.lighterState = "HELD";
        this.flicker.reset();
        this.sfx.pop();
      }
    } else if (this.lighterState === "HELD") {
      if (!hand || !hand.pinching) {
        this.lighterHeldBy = null;
        this.lighterState = "IDLE";
        this.flicker.reset();
      } else {
        targetAngle = hand.gripAngle - Math.PI / 2;
        const grip = rotatedOffset(LIGHTER_GRIP_LOCAL * length, targetAngle);
        targetX = hand.pinchX - grip[0];
        targetY = hand.pinchY - grip[1];
        if (this.flicker.update(hand.pinchX, hand.pinchY, now)) {
          this.flameUntil = now + FLAME_HOLD_S;
          this.sfx.spark();
        }
      }
    }

    const k = 1 - Math.exp(-dt * (this.lighterState === "HELD" ? 26 : 8));
    this.lighterX += (targetX - this.lighterX) * k;
    this.lighterY += (targetY - this.lighterY) * k;
    this.lighterAngle = angleLerp(this.lighterAngle, targetAngle, k);
    this.lighterMesh.position.set(this.lighterX, this.lighterY, 0);
    this.lighterMesh.rotation.z = this.lighterAngle;

    const flameOn = now < this.flameUntil;
    this.flameMesh.visible = flameOn;
    if (flameOn) {
      const [fx, fy] = this.nozzlePoint();
      const jitter = 1 + Math.sin(now * 40) * 0.06 + (Math.random() - 0.5) * 0.08;
      const flameSize = length * 0.4 * jitter;
      this.flameMesh.position.set(fx, fy + flameSize * 0.3, 0.1);
      this.flameMesh.scale.set(flameSize * 0.8, flameSize, 1);
      if (Math.random() < 0.6) {
        this.fx.glow.emit({
          x: fx,
          y: fy,
          count: 1,
          dirY: 1,
          spread: 0.6,
          speed: [20, 50],
          life: [0.15, 0.3],
          size: [3, 6],
          gravity: -40,
          color: ["#ffcf4a", "#ff8a00"],
        });
      }
    }
  }

  /** World position of the flame, given the lighter's current position/rotation. */
  private nozzlePoint(): [number, number] {
    const [ox, oy] = rotatedOffset(LIGHTER_NOZZLE_LOCAL * this.lighterLength, this.lighterAngle);
    return [this.lighterX + ox, this.lighterY + oy];
  }

  // ---- Cigarette ----

  private updateCigarette(sig: FrameSignals, now: number, dt: number, faceW: number) {
    if (this.cigState === "FINISHED") {
      if (now >= this.cigRespawnAt) {
        this.cigState = "IDLE";
        this.cigLit = false;
        this.cigBurn = 0;
        [this.cigX, this.cigY] = this.cigSpawn();
        this.cigAngle = 0;
        this.cigMesh.material.map = generateCigaretteTexture(false, 0);
        this.cigMesh.material.needsUpdate = true;
        this.cigMesh.visible = true;
      } else {
        return;
      }
    }

    const length = faceW * CIG_LENGTH_RATIO;
    this.cigLength = length;
    const img = this.cigMesh.material.map!.image as { width: number; height: number };
    const [w, h] = sizeFromLength(length, img);
    this.cigMesh.scale.set(w, h, 1);

    let targetX = this.cigX;
    let targetY = this.cigY;
    let targetAngle = this.cigAngle;
    const face = sig.face;
    const hand = this.cigHeldBy ? sig.hands.find((h) => h.key === this.cigHeldBy) : undefined;

    switch (this.cigState) {
      case "IDLE": {
        const [sx, sy] = this.cigSpawn();
        targetX = sx;
        targetY = sy + Math.sin(now * 2) * 6;
        targetAngle = 0;
        const grabber = sig.hands.find(
          (h) =>
            h.key !== this.lighterHeldBy &&
            h.pinchStarted &&
            Math.hypot(h.pinchX - this.cigX, h.pinchY - this.cigY) < length * GRAB_RADIUS,
        );
        if (grabber) {
          this.cigHeldBy = grabber.key;
          this.cigState = "HELD";
          this.sfx.pop();
        }
        break;
      }

      case "HELD": {
        if (!hand || !hand.pinching) {
          this.cigHeldBy = null;
          this.cigState = "IDLE";
          break;
        }
        targetAngle = hand.gripAngle;
        const grip = rotatedOffset(CIG_GRIP_LOCAL * length, targetAngle);
        targetX = hand.pinchX - grip[0];
        targetY = hand.pinchY - grip[1];

        const [mouthPtX, mouthPtY] = this.mouthPoint();
        const near = !!face && Math.hypot(mouthPtX - face.mouthX, mouthPtY - face.mouthY) < faceW * MOUTH_ENTER;
        if (near) {
          this.cigState = "IN_MOUTH";
          this.cigHeldBy = null;
        }
        break;
      }

      case "IN_MOUTH": {
        if (face) {
          targetAngle = -0.55; // dangles down from the corner of the mouth
          const toMouth = rotatedOffset(CIG_MOUTH_LOCAL * length, targetAngle);
          targetX = face.mouthX - toMouth[0];
          targetY = face.mouthY - toMouth[1];
        }
        // Pinching near the cigarette pulls it back out for repositioning.
        const grabber = sig.hands.find(
          (h) => h.pinchStarted && Math.hypot(h.pinchX - this.cigX, h.pinchY - this.cigY) < length * GRAB_RADIUS,
        );
        if (grabber) {
          this.cigHeldBy = grabber.key;
          this.cigState = "HELD";
        } else {
          const [mouthPtX, mouthPtY] = this.mouthPoint();
          const stillNear = !!face && Math.hypot(mouthPtX - face.mouthX, mouthPtY - face.mouthY) < faceW * MOUTH_LEAVE;
          if (!stillNear) this.cigState = "IDLE"; // face moved away and no hand is holding it
        }
        break;
      }
    }

    const speed = this.cigState === "HELD" || this.cigState === "IN_MOUTH" ? 24 : 8;
    const k = 1 - Math.exp(-dt * speed);
    this.cigX += (targetX - this.cigX) * k;
    this.cigY += (targetY - this.cigY) * k;
    this.cigAngle = angleLerp(this.cigAngle, targetAngle, k);
    this.cigMesh.position.set(this.cigX, this.cigY, 0);
    this.cigMesh.rotation.z = this.cigAngle;

    // Ember glow, pulsing gently while lit.
    this.emberMesh.visible = this.cigLit;
    if (this.cigLit) {
      this.emberPulse += dt * 5;
      const [emberX, emberY] = this.emberPoint();
      const pulse = 0.85 + Math.sin(this.emberPulse) * 0.15;
      const glowSize = length * 0.22 * pulse;
      this.emberMesh.position.set(emberX, emberY, 0.05);
      this.emberMesh.scale.set(glowSize, glowSize, 1);

      if (Math.random() < 0.15) {
        this.fx.smoke.emit({
          x: emberX,
          y: emberY,
          count: 1,
          dirY: 1,
          spread: 0.5,
          speed: [4, 10],
          life: [1, 1.8],
          size: [3, 6],
          alpha: 0.25,
          gravity: -12,
          drag: 0.3,
          grow: 6,
          wobble: 10,
          color: ["#cfcac0"],
        });
      }
    }
  }

  /** World position of the cigarette's lit (ember) end. */
  private emberPoint(): [number, number] {
    const [ox, oy] = rotatedOffset(CIG_EMBER_LOCAL * this.cigLength, this.cigAngle);
    return [this.cigX + ox, this.cigY + oy];
  }

  /** World position of the filter end, which is what actually touches the lips. */
  private mouthPoint(): [number, number] {
    const [ox, oy] = rotatedOffset(CIG_MOUTH_LOCAL * this.cigLength, this.cigAngle);
    return [this.cigX + ox, this.cigY + oy];
  }

  // ---- Ignition + puffing ----

  private updateIgnitionAndPuff(sig: FrameSignals, now: number, faceW: number) {
    const flameOn = now < this.flameUntil;
    if (flameOn && !this.cigLit && this.cigState !== "IDLE" && this.cigState !== "FINISHED") {
      const [fx, fy] = this.nozzlePoint();
      const [emberX, emberY] = this.emberPoint();
      const reach = faceW * FLAME_REACH;
      if (Math.hypot(fx - emberX, fy - emberY) < reach) {
        this.cigLit = true;
        this.cigMesh.material.map = generateCigaretteTexture(true, this.cigBurn);
        this.cigMesh.material.needsUpdate = true;
        this.sfx.ignite();
        this.fx.glow.emit({
          x: emberX,
          y: emberY,
          count: 14,
          spread: Math.PI * 2,
          speed: [30, 90],
          life: [0.2, 0.4],
          size: [4, 8],
          color: ["#ffcf4a", "#ff8a00"],
        });
      }
    }

    if (!this.cigLit || this.cigState !== "IN_MOUTH" || !sig.face) {
      if (this.puffGate.on) this.puffGate.on = false;
      return;
    }

    const pucker = sig.face.blend.mouthPucker ?? 0;
    const changed = this.puffGate.update(pucker);
    if (changed && this.puffGate.on) {
      this.sfx.inhale();
    }
    if (changed && !this.puffGate.on) {
      this.exhale(sig.face.mouthX, sig.face.mouthY, now);
    }
  }

  private exhale(mouthX: number, mouthY: number, now: number) {
    this.fx.smoke.emit({
      x: mouthX,
      y: mouthY,
      count: 34,
      dirX: 0,
      dirY: 1,
      spread: 0.9,
      speed: [30, 90],
      life: [1.6, 2.6],
      size: [10, 20],
      alpha: 0.5,
      gravity: -18,
      drag: 0.35,
      grow: 22,
      wobble: 18,
      color: SMOKE_COLORS,
    });
    this.sfx.exhale();

    this.cigBurn += 1;
    if (this.cigBurn >= CIGARETTE_STAGES) {
      this.cigState = "FINISHED";
      this.cigMesh.visible = false;
      this.emberMesh.visible = false;
      this.cigLit = false;
      this.cigRespawnAt = now + 2.5;
    } else {
      this.cigMesh.material.map = generateCigaretteTexture(true, this.cigBurn);
      this.cigMesh.material.needsUpdate = true;
    }
  }

  // ---- UI + spawn points ----

  private computeHint(): string {
    if (this.cigState === "FINISHED") return "That one's done 🚬";
    if (this.cigState === "IDLE") return "Pinch the cigarette to hold it 🤏";
    if (this.cigState === "HELD") return "Bring it to your lips";
    if (this.cigState === "IN_MOUTH" && !this.cigLit) {
      return this.lighterState === "IDLE"
        ? "Now grab the lighter with your other hand"
        : "Flick your wrist to spark it, then touch the flame to the tip 🔥";
    }
    if (this.cigState === "IN_MOUTH" && this.cigLit) return "Purse your lips to draw, then release to exhale 💨";
    return "";
  }

  private hint(text: string) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    this.hintEl.textContent = text;
  }

  private cigSpawn(): [number, number] {
    const { width: w, height: h } = this.stage;
    return [w * 0.28, -h * 0.14];
  }

  private lighterSpawn(): [number, number] {
    const { width: w, height: h } = this.stage;
    return [-w * 0.28, -h * 0.14];
  }
}
