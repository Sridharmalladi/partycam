/** Detects a quick back-and-forth "flick" (tick-tick) motion, like striking a lighter wheel. */
export class FlickDetector {
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private lastSign = 0;
  private flips: number[] = [];
  private cooldownUntil = 0;
  private windowSec: number;
  private minSpeed: number;

  constructor(windowSec = 0.7, minSpeed = 220) {
    this.windowSec = windowSec;
    this.minSpeed = minSpeed;
  }

  reset() {
    this.lastT = 0;
    this.lastSign = 0;
    this.flips = [];
  }

  /** Feed the current tracked position; returns true the instant enough quick reversals stack up. */
  update(x: number, y: number, now: number): boolean {
    if (this.lastT === 0) {
      this.lastX = x;
      this.lastY = y;
      this.lastT = now;
      return false;
    }
    const dt = Math.max(now - this.lastT, 1e-3);
    const vx = (x - this.lastX) / dt;
    const vy = (y - this.lastY) / dt;
    const speed = Math.hypot(vx, vy);
    this.lastX = x;
    this.lastY = y;
    this.lastT = now;

    if (speed > this.minSpeed) {
      const sign = Math.sign(vx) || Math.sign(vy);
      if (this.lastSign !== 0 && sign !== this.lastSign) this.flips.push(now);
      this.lastSign = sign;
    }

    this.flips = this.flips.filter((t) => now - t < this.windowSec);

    if (this.flips.length >= 2 && now > this.cooldownUntil) {
      this.cooldownUntil = now + 1.2;
      this.flips = [];
      return true;
    }
    return false;
  }
}
