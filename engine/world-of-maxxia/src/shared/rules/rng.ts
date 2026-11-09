/** Serializable xorshift32. Never use Math.random in simulation code. */
export interface RngSnapshot { algorithm: 'xorshift32-v1'; state: number; }
export function seedFromText(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash || 0x6d2b79f5;
}
export class SeededRng {
  private state: number;
  constructor(seed: number | string) {
    if (typeof seed === 'number' && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) throw new RangeError('Seed must be an unsigned 32-bit integer.');
    this.state = (typeof seed === 'string' ? seedFromText(seed) : seed >>> 0) || 0x6d2b79f5;
  }
  nextUint32(): number {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  integer(min: number, max: number): number {
    const span = max - min + 1;
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || !Number.isSafeInteger(span) || span < 1 || span > 0x100000000) throw new RangeError('Invalid RNG range.');
    const limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do { value = this.nextUint32(); } while (value >= limit);
    return min + value % span;
  }
  snapshot(): RngSnapshot { return {algorithm: 'xorshift32-v1', state: this.state}; }
  restore(value: unknown): void {
    if (!value || typeof value !== 'object' || !('algorithm' in value) || value.algorithm !== 'xorshift32-v1' || !('state' in value) || typeof value.state !== 'number' || !Number.isInteger(value.state) || value.state <= 0 || value.state > 0xffffffff) throw new TypeError('Invalid RNG snapshot.');
    this.state = value.state;
  }
}
