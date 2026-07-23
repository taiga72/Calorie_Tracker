import type { WeightUnit } from '@/types';

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * 0.45359237 : value;
}

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / 0.45359237 : kg;
}

export function fmtWeight(kg: number, unit: WeightUnit): string {
  const v = kgToUnit(kg, unit);
  return unit === 'lb' ? `${v.toFixed(1)} lb` : `${v.toFixed(1)} kg`;
}
