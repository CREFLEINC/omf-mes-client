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
