import type { FaceSignals } from "../tracking/signals";
import { Gate } from "./gate";

export type TriggerKind = "bite" | "blow";

export interface TriggerResult {
  fired: boolean;
  level: number;
}

const blowScore = (b: Record<string, number>) =>
  Math.min(1, Math.max(b.mouthFunnel ?? 0, b.mouthPucker ?? 0) * 0.8 + (b.cheekPuff ?? 0) * 0.4);

export class TriggerDetector {
  private kind: TriggerKind;
  private gate: Gate;
  private armed = false;
  private lastFire = 0;

  constructor(kind: TriggerKind) {
    this.kind = kind;
    this.gate = kind === "blow" ? new Gate(0.45, 0.3) : new Gate(0.55, 0.4);
  }

  reset() {
    this.armed = false;
    this.gate.on = false;
  }

  update(face: FaceSignals, now: number): TriggerResult {
    const b = face.blend;
    if (this.kind === "bite") {
      const jaw = b.jawOpen ?? 0;
      return this.cycle(jaw, 0.35, 0.12);
    }
    const s = blowScore(b);
    this.gate.update(s);
    return { level: this.gate.on ? s : 0, fired: this.repeat(this.gate.on, now, 0.35) };
  }

  private cycle(v: number, openAt: number, closeAt: number): TriggerResult {
    if (!this.armed && v > openAt) this.armed = true;
    else if (this.armed && v < closeAt) {
      this.armed = false;
      return { fired: true, level: v };
    }
    return { fired: false, level: v };
  }

  private repeat(active: boolean, now: number, interval: number): boolean {
    if (!active || now - this.lastFire < interval) return false;
    this.lastFire = now;
    return true;
  }
}
