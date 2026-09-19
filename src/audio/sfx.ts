/** Tiny synthesized sound effects. No audio files to fetch, no mobile-unlock asset loading. */
export class Sfx {
  private ctx: AudioContext | null = null;

  private get audio() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number) {
    const ctx = this.audio;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  pop() {
    this.tone(520, 0.12, "sine", 0.25);
  }

  crunch() {
    const ctx = this.audio;
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    src.connect(g).connect(ctx.destination);
    src.start();
  }

  chime() {
    [660, 880, 990].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, "sine", 0.2), i * 90));
  }

  woosh() {
    this.tone(220, 0.25, "sawtooth", 0.08);
  }
}
