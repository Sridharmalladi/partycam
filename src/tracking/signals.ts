import type { FaceLandmarkerResult, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { OneEuro, OneEuro2D } from "./oneEuro";
import { FACE, HAND } from "./landmarks";
import { Gate } from "../gestures/gate";
import type { Stage } from "../render/stage";

export interface FaceSignals {
  mouthX: number;
  mouthY: number;
  faceWidth: number;
  blend: Record<string, number>;
}

export interface HandSignals {
  key: string;
  pinchX: number;
  pinchY: number;
  pinching: boolean;
  pinchStarted: boolean;
  /** Angle (radians) of the thumb->index line, for orienting held props naturally. */
  gripAngle: number;
  wristX: number;
  wristY: number;
}

export interface FrameSignals {
  t: number;
  face: FaceSignals | null;
  hands: HandSignals[];
}

const BLENDS = ["jawOpen", "mouthPucker", "mouthFunnel", "cheekPuff"];
const LOST_RESET_S = 0.3;
const PINCH_ON = 0.35;
const PINCH_OFF = 0.5;

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export class SignalBuilder {
  private stage: Stage;
  private f2 = new Map<string, OneEuro2D>();
  private f1 = new Map<string, OneEuro>();
  private gates = new Map<string, Gate>();
  private lastSeen = new Map<string, number>();

  constructor(stage: Stage) {
    this.stage = stage;
  }

  private point(key: string) {
    let f = this.f2.get(key);
    if (!f) this.f2.set(key, (f = new OneEuro2D()));
    return f;
  }

  private scalar(key: string, minCutoff: number, beta: number) {
    let f = this.f1.get(key);
    if (!f) this.f1.set(key, (f = new OneEuro(minCutoff, beta)));
    return f;
  }

  private gate(key: string) {
    let g = this.gates.get(key);
    if (!g) this.gates.set(key, (g = new Gate(PINCH_ON, PINCH_OFF)));
    return g;
  }

  private seen(prefix: string, t: number) {
    const last = this.lastSeen.get(prefix) ?? -Infinity;
    if (t - last > LOST_RESET_S) {
      for (const [k, f] of this.f2) if (k.startsWith(prefix)) f.reset();
      for (const [k, f] of this.f1) if (k.startsWith(prefix)) f.reset();
      for (const [k, g] of this.gates) if (k.startsWith(prefix)) g.on = false;
    }
    this.lastSeen.set(prefix, t);
  }

  update(face: FaceLandmarkerResult | undefined, hands: HandLandmarkerResult | undefined, t: number): FrameSignals {
    const map = (x: number, y: number) => this.stage.mapPoint(x, y);

    let faceSig: FaceSignals | null = null;
    const lm = face?.faceLandmarks?.[0];
    if (face && lm) {
      this.seen("face", t);
      const [ux, uy] = map(lm[FACE.upperLip].x, lm[FACE.upperLip].y);
      const [lx, ly] = map(lm[FACE.lowerLip].x, lm[FACE.lowerLip].y);
      const [mx, my] = this.point("face.mouth").filter((ux + lx) / 2, (uy + ly) / 2, t);

      const [flx, fly] = map(lm[FACE.faceLeft].x, lm[FACE.faceLeft].y);
      const [frx, fry] = map(lm[FACE.faceRight].x, lm[FACE.faceRight].y);
      const faceWidth = this.scalar("face.width", 1, 0).filter(dist(flx, fly, frx, fry), t);

      const blend: Record<string, number> = {};
      for (const c of face.faceBlendshapes?.[0]?.categories ?? []) {
        if (BLENDS.includes(c.categoryName)) {
          blend[c.categoryName] = this.scalar(`face.b.${c.categoryName}`, 3, 0).filter(c.score, t);
        }
      }
      faceSig = { mouthX: mx, mouthY: my, faceWidth, blend };
    }

    const handSigs: HandSignals[] = [];
    (hands?.landmarks ?? []).forEach((h, i) => {
      const key = `hand.${hands?.handedness?.[i]?.[0]?.categoryName ?? i}`;
      this.seen(key, t);

      const [rawThx, rawThy] = map(h[HAND.thumbTip].x, h[HAND.thumbTip].y);
      const [rawIx, rawIy] = map(h[HAND.indexTip].x, h[HAND.indexTip].y);
      const [wx, wy] = map(h[HAND.wrist].x, h[HAND.wrist].y);
      const [mcx, mcy] = map(h[HAND.middleMcp].x, h[HAND.middleMcp].y);

      const handSize = Math.max(dist(wx, wy, mcx, mcy), 1);
      const ratio = dist(rawThx, rawThy, rawIx, rawIy) / handSize;
      const gate = this.gate(key);
      const changed = gate.update(ratio);

      const [thx, thy] = this.point(`${key}.thumb`).filter(rawThx, rawThy, t);
      const [ix, iy] = this.point(`${key}.index`).filter(rawIx, rawIy, t);
      const [px, py] = this.point(`${key}.pinch`).filter((thx + ix) / 2, (thy + iy) / 2, t);
      const gripAngle = Math.atan2(iy - thy, ix - thx);
      handSigs.push({
        key,
        pinchX: px,
        pinchY: py,
        pinching: gate.on,
        pinchStarted: changed && gate.on,
        gripAngle,
        wristX: wx,
        wristY: wy,
      });
    });

    return { t, face: faceSig, hands: handSigs };
  }
}
