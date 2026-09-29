import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, generateCode } from '../src/lib/shortCode.js';

describe('generateCode', () => {
  it('returns a code of the default length', () => {
    expect(generateCode()).toHaveLength(CODE_LENGTH);
  });

  it('only uses base62 characters', () => {
    for (let i = 0; i < 1000; i++) {
      expect(generateCode()).toMatch(/^[0-9a-zA-Z]+$/);
    }
  });

  it('does not repeat itself in practice', () => {
    const codes = new Set(Array.from({ length: 10_000 }, () => generateCode()));
    expect(codes.size).toBe(10_000);
  });
});
