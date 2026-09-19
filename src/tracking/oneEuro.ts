const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** One Euro filter (Casiez et al., 2012). Smooths jitter without adding lag. */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(minCutoff = 1.5, beta = 0.01, dCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }

  filter(value: number, tSec: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tSec;
      return value;
    }
    const dt = Math.max(tSec - this.t, 1e-3);
    this.t = tSec;

    const rawDx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (rawDx - this.dx);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

export class OneEuro2D {
  private fx: OneEuro;
  private fy: OneEuro;

  constructor(minCutoff = 1.5, beta = 0.01) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
  }

  filter(x: number, y: number, tSec: number): [number, number] {
    return [this.fx.filter(x, tSec), this.fy.filter(y, tSec)];
  }
}
