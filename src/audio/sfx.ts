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

  private noiseBurst(duration: number, gainPeak: number, filterType: BiquadFilterType, freq: number, q = 1) {
    const ctx = this.audio;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + duration * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
    return { src, g, filter };
  }

  /** Flint-wheel scratch of a lighter flick. */
  spark() {
    this.noiseBurst(0.09, 0.3, "highpass", 3200, 1.4);
  }

  /** Catching flame: a soft whoosh with a crackle tail. */
  ignite() {
    this.noiseBurst(0.35, 0.18, "bandpass", 900, 0.6);
    this.tone(180, 0.2, "sine", 0.06);
  }

  /** Short pull on the cigarette. */
  inhale() {
    const { filter } = this.noiseBurst(0.5, 0.1, "bandpass", 700, 0.8);
    filter.frequency.exponentialRampToValueAtTime(1400, this.audio.currentTime + 0.5);
  }

  /** Breathing the smoke back out, longer and softer. */
  exhale() {
    const { filter } = this.noiseBurst(1.1, 0.09, "lowpass", 1200, 0.5);
    filter.frequency.exponentialRampToValueAtTime(350, this.audio.currentTime + 1.1);
  }
}
