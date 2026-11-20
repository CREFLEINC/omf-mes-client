/** 수량 글 — 천 단위 쉼표, 소수는 여섯 자리까지. */
export const qtyText = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

/** 수량 숫자만 — 단위는 작게 따로 붙인다. */
export const qtyNumber = (qty: number): string =>
  qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 });

/** 패키징 단위 — 이름이 있으면 이름(「봉지」), 없으면 코드(G1 잔여). */
export const packageUnitOf = (pkg: { uomCode: string; uomName?: string | null }): string => {
  const name = pkg.uomName?.trim() ?? '';

  return name === '' ? pkg.uomCode : name;
};
