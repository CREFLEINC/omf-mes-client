/** 단위 자릿수의 정수로 나눠 분할 전후 수량 합계를 보존한다. */
export const splitPlanQuantity = (
  total: number,
  quantity: number,
  decimalScale = 6,
): { remaining: number; split: number } | null => {
  if (!Number.isInteger(decimalScale) || decimalScale < 0 || decimalScale > 6) return null;
  const scale = 10 ** decimalScale;
  const scaled = (value: number): number | null => {
    const units = value * scale;
    const rounded = Math.round(units);
    if (
      !Number.isFinite(value) ||
      !Number.isSafeInteger(rounded) ||
      Number(value.toFixed(decimalScale)) !== value
    )
      return null;
    return rounded;
  };
  const whole = scaled(total),
    part = scaled(quantity);
  if (whole === null || part === null || part <= 0 || part >= whole) return null;
  return { remaining: (whole - part) / scale, split: part / scale };
};

export interface PlanSplitPart {
  plannedQty: string;
  planDate: string;
}
export const validPlanSplit = (
  total: number,
  parts: readonly PlanSplitPart[],
  decimalScale = 6,
): boolean => {
  const scale = 10 ** decimalScale;
  const units = (value: number) =>
    Number.isFinite(value) &&
    value > 0 &&
    Number.isSafeInteger(Math.round(value * scale)) &&
    Number(value.toFixed(decimalScale)) === value;
  return (
    Number.isInteger(decimalScale) &&
    decimalScale >= 0 &&
    decimalScale <= 6 &&
    units(total) &&
    parts.length >= 2 &&
    parts.length <= 12 &&
    parts.every(
      (part) =>
        units(Number(part.plannedQty)) &&
        /^\d{4}-\d{2}-\d{2}$/.test(part.planDate) &&
        Number.isFinite(Date.parse(part.planDate)) &&
        new Date(part.planDate).toISOString().slice(0, 10) === part.planDate,
    ) &&
    parts.reduce((sum, part) => sum + Math.round(Number(part.plannedQty) * scale), 0) ===
      Math.round(total * scale)
  );
};
