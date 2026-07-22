import type { WeightUnit } from '@/types';

export const KG_TO_LB = 2.20462262;
export const LB_TO_KG = 1 / KG_TO_LB;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * KG_TO_LB : kg;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * LB_TO_KG : value;
}

export function fmtWeight(kg: number, unit: WeightUnit, digits = 1): string {
  const v = kgToUnit(kg, unit);
  return `${v.toFixed(digits)} ${unit}`;
}
