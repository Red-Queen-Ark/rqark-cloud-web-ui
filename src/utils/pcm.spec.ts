import { describe, expect, it } from 'vitest';
import { PCM_TARGET_RATE, StreamResampler, toInt16 } from './pcm';

function sine(count: number, rate: number, hz = 440): Float32Array {
  const out = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    out[index] = Math.sin((2 * Math.PI * hz * index) / rate);
  }
  return out;
}

describe('toInt16', () => {
  it('keeps silence at zero', () => {
    expect(toInt16(0)).toBe(0);
  });

  it('maps the top of the range to 32767', () => {
    expect(toInt16(1)).toBe(32767);
  });

  it('maps the bottom of the range to -32768', () => {
    expect(toInt16(-1)).toBe(-32768);
  });

  it('clamps past the range instead of wrapping', () => {
    expect(toInt16(3)).toBe(32767);
    expect(toInt16(-3)).toBe(-32768);
  });
});

describe('StreamResampler', () => {
  it('turns 48k into 16k at a third of the samples', () => {
    const resampler = new StreamResampler(48000);
    const pcm = resampler.push(sine(4800, 48000));

    expect(pcm.length).toBeGreaterThan(1580);
    expect(pcm.length).toBeLessThan(1620);
  });

  it('leaves 16k input at the same length', () => {
    const resampler = new StreamResampler(PCM_TARGET_RATE);
    const pcm = resampler.push(sine(1600, 16000));

    expect(pcm.length).toBeGreaterThan(1590);
    expect(pcm.length).toBeLessThan(1610);
  });

  it('produces the same samples whether the audio arrives in one chunk or many', () => {
    const input = sine(4800, 48000);
    const whole = new StreamResampler(48000).push(input);

    const split = new StreamResampler(48000);
    const pieces: number[] = [];
    for (let start = 0; start < input.length; start += 128) {
      pieces.push(...split.push(input.subarray(start, start + 128)));
    }

    expect(pieces.length).toBe(whole.length);
    pieces.forEach((sample, index) => {
      expect(Math.abs(sample - whole[index])).toBeLessThanOrEqual(1);
    });
  });

  it('ignores an empty chunk', () => {
    expect(new StreamResampler(48000).push(new Float32Array(0)).length).toBe(0);
  });

  it('forgets the carried tail on reset', () => {
    const resampler = new StreamResampler(48000);
    resampler.push(sine(100, 48000));
    resampler.reset();

    expect(resampler.push(new Float32Array(0)).length).toBe(0);
  });
});
