const TARGET_RATE = 16000;

export const PCM_TARGET_RATE = TARGET_RATE;

export class StreamResampler {
  private readonly ratio: number;
  private pending: Float32Array = new Float32Array(0);
  private position = 0;

  public constructor(fromRate: number, toRate: number = TARGET_RATE) {
    this.ratio = fromRate / toRate;
  }

  public push(input: Float32Array): Int16Array<ArrayBuffer> {
    if (input.length === 0) {
      return new Int16Array(0);
    }
    const merged = new Float32Array(this.pending.length + input.length);
    merged.set(this.pending);
    merged.set(input, this.pending.length);
    this.pending = merged;

    const out: number[] = [];
    while (this.position + 1 < this.pending.length) {
      out.push(this.sampleAt(this.position));
      this.position += this.ratio;
    }

    // The read position may overshoot the end of the buffer, and that overshoot is the
    // head start of the next chunk: dropping it would restart every chunk a hair early
    // and quietly stretch the stream.
    const consumed = Math.min(Math.floor(this.position), this.pending.length);
    if (consumed > 0) {
      this.pending = this.pending.subarray(consumed);
      this.position -= consumed;
    }
    return new Int16Array(out);
  }

  public reset(): void {
    this.pending = new Float32Array(0);
    this.position = 0;
  }

  private sampleAt(position: number): number {
    const left = Math.floor(position);
    const right = left + 1;
    const weight = position - left;
    const interpolated = this.pending[left] * (1 - weight) + this.pending[right] * weight;
    return toInt16(interpolated);
  }
}

export function toInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * 32768 : clamped * 32767);
}
