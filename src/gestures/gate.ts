/** Hysteresis on/off switch so signals near a threshold don't flicker. */
export class Gate {
  on = false;
  private onAt: number;
  private offAt: number;

  constructor(onAt: number, offAt: number) {
    this.onAt = onAt;
    this.offAt = offAt;
  }

  /** Returns true if the state changed. */
  update(v: number): boolean {
    const below = this.onAt < this.offAt;
    const prev = this.on;
    if (!this.on) this.on = below ? v < this.onAt : v > this.onAt;
    else this.on = below ? v < this.offAt : v > this.offAt;
    return prev !== this.on;
  }
}
