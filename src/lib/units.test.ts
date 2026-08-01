import { describe, it, expect } from 'vitest';
import { kgToUnit, unitToKg, fmtWeight, KG_TO_LB, LB_TO_KG } from '@/lib/units';

describe('kgToUnit', () => {
  it('passes kg through unchanged', () => {
    expect(kgToUnit(70, 'kg')).toBe(70);
  });

  it('converts kg to lb', () => {
    expect(kgToUnit(100, 'lb')).toBeCloseTo(220.462262, 5);
  });
});

describe('unitToKg', () => {
  it('passes kg through unchanged', () => {
    expect(unitToKg(70, 'kg')).toBe(70);
  });

  it('converts lb to kg', () => {
    expect(unitToKg(220.462262, 'lb')).toBeCloseTo(100, 5);
  });

  it('round-trips kg -> lb -> kg', () => {
    const original = 83.4;
    const roundTripped = unitToKg(kgToUnit(original, 'lb'), 'lb');
    expect(roundTripped).toBeCloseTo(original, 8);
  });
});

describe('KG_TO_LB / LB_TO_KG', () => {
  it('are reciprocals', () => {
    expect(KG_TO_LB * LB_TO_KG).toBeCloseTo(1, 10);
  });
});

describe('fmtWeight', () => {
  it('formats kg with one decimal by default', () => {
    expect(fmtWeight(70, 'kg')).toBe('70.0 kg');
  });

  it('formats lb with converted value', () => {
    expect(fmtWeight(100, 'lb')).toBe('220.5 lb');
  });

  it('honors a custom digits count', () => {
    expect(fmtWeight(70.456, 'kg', 2)).toBe('70.46 kg');
    expect(fmtWeight(70, 'kg', 0)).toBe('70 kg');
  });
});
