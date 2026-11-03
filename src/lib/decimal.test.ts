import { describe, it, expect } from 'vitest';
import { cleanDecimal, parseDecimal } from '@/lib/decimal';

describe('parseDecimal', () => {
  it('reads a decimal comma as well as a point', () => {
    expect(parseDecimal('79,5')).toBe(79.5);
    expect(parseDecimal('79.5')).toBe(79.5);
    expect(parseDecimal(' 80 ')).toBe(80);
  });
  it('is NaN for nothing usable', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal(',')).toBeNaN();
  });
});

describe('cleanDecimal', () => {
  it('keeps digits and one separator while typing', () => {
    expect(cleanDecimal('79,5')).toBe('79,5');
    expect(cleanDecimal('7a9.5.')).toBe('79.5');
    expect(cleanDecimal('1,2,3')).toBe('1,23');
  });
});
